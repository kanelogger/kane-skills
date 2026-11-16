import { dlopen, read as memory } from "bun:ffi"
import { constants, close, fstat, read, write, fchmod, fsync } from "node:fs"
import { realpath } from "node:fs/promises"
import { promisify } from "node:util"
import { randomUUID, createHash } from "node:crypto"
import { isAbsolute } from "node:path"

export class BootstrapError extends Error {
  constructor(public code: string, message: string, public path?: string) { super(message) }
  detail() { return { code: this.code, message: this.message, ...(this.path ? { path: this.path } : {}) } }
}

export const hash = (data: Uint8Array | string) => createHash("sha256").update(data).digest("hex")
export const limit = 4 * 1024 * 1024
const shut = promisify(close)
const info = promisify(fstat)
const pull = promisify(read)
const push = promisify(write)
const chmod = promisify(fchmod)
const sync = promisify(fsync)

function native() {
  if (process.platform !== "darwin" && process.platform !== "linux") throw new BootstrapError("unsupported_platform", "File changes require supported POSIX file APIs.")
  const errno = process.platform === "darwin" ? "__error" : "__errno_location"
  const lib = dlopen(process.platform === "darwin" ? "/usr/lib/libSystem.B.dylib" : "libc.so.6", {
    openat: { args: ["i32", "cstring", "i32", "i32"], returns: "i32" },
    mkdirat: { args: ["i32", "cstring", "i32"], returns: "i32" },
    linkat: { args: ["i32", "cstring", "i32", "cstring", "i32"], returns: "i32" },
    renameat: { args: ["i32", "cstring", "i32", "cstring"], returns: "i32" },
    unlinkat: { args: ["i32", "cstring", "i32"], returns: "i32" },
    [errno]: { args: [], returns: "ptr" },
  } as const)
  const number = () => {
    const ptr = lib.symbols[errno]!()
    if (!ptr) throw new BootstrapError("native_error", "Unable to read the file API error state.")
    return memory.i32(ptr, 0)
  }
  return { lib, number }
}

let api: ReturnType<typeof native> | undefined
const ffi = () => api ??= native()
const cstr = (name: string) => Buffer.from(name + "\0")

function result(fd: number, path: string) {
  if (fd >= 0) return fd
  const err = ffi().number()
  if (err === 2) return null
  throw new BootstrapError("unsafe_or_unavailable_path", "Path is unavailable, symbolic, or not permitted (errno " + err + ").", path)
}

export function parts(path: unknown) {
  if (typeof path !== "string" || !path || path.includes("\\") || path.includes("\0") || isAbsolute(path)) throw new BootstrapError("invalid_path", "Use project-relative POSIX paths.")
  const names = path.split("/")
  if (names.some(name => !name || name === "." || name === ".." || name.toLowerCase() === ".git")) throw new BootstrapError("unsafe_path", "Traversal and Git metadata paths are refused.", path)
  return names
}

export class Files {
  constructor(public root: string, private fd: number) {}
  static async at(root: string) {
    const path = await realpath(root)
    const fd = result(ffi().lib.symbols.openat!(process.platform === "darwin" ? -2 : -100, cstr(path), constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW, 0) as number, path)
    if (fd === null) throw new BootstrapError("invalid_target", "Target directory does not exist.")
    return new Files(path, fd)
  }
  async close() { await shut(this.fd) }
  async parent(path: string, create = false) {
    let fd = this.fd
    let handed = false
    const owned: number[] = []
    try {
      for (const name of parts(path).slice(0, -1)) {
        let child = result(ffi().lib.symbols.openat!(fd, cstr(name), constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW, 0) as number, path)
        if (child === null && create) {
          const made = ffi().lib.symbols.mkdirat!(fd, cstr(name), 0o700) as number
          if (made < 0 && ffi().number() !== 17) throw new BootstrapError("directory_failed", "Unable to create an owned parent directory.", path)
          child = result(ffi().lib.symbols.openat!(fd, cstr(name), constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW, 0) as number, path)
        }
        if (child === null) return null
        owned.push(child)
        fd = child
      }
      handed = true
      return { fd, name: parts(path).at(-1)!, close: async () => { for (const num of owned.reverse()) await shut(num) } }
    } finally {
      if (!handed) for (const num of owned.reverse()) await shut(num)
    }
  }
  async readAt(fd: number, name: string, max = limit) {
    const num = result(ffi().lib.symbols.openat!(fd, cstr(name), constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK, 0) as number, name)
    if (num === null) return null
    try {
      const before = await info(num)
      if (!before.isFile() || before.size > max) throw new BootstrapError("file_type_or_size", "Only bounded ordinary files can be changed.", name)
      const data = Buffer.alloc(Math.min(max + 1, Number(before.size) + 1))
      let size = 0
      while (size < data.length) {
        const out = await pull(num, data, size, data.length - size, size)
        if (!out.bytesRead) break
        size += out.bytesRead
      }
      const after = await info(num)
      if (size > max || size !== after.size || before.mtimeMs !== after.mtimeMs || before.ctimeMs !== after.ctimeMs) throw new BootstrapError("concurrent_change", "File changed while being read.", name)
      return { data: data.subarray(0, size), mode: Number(after.mode) & 0o777 }
    } finally { await shut(num) }
  }
  async read(path: string, max = limit) {
    const dir = await this.parent(path)
    if (!dir) return null
    try { return await this.readAt(dir.fd, dir.name, max) } finally { await dir.close() }
  }
  async identity(path: string) {
    const dir = await this.parent(path)
    if (!dir) return null
    try {
      const fd = result(ffi().lib.symbols.openat!(dir.fd, cstr(dir.name), constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK, 0) as number, path)
      if (fd === null) return null
      try {
        const meta = await info(fd)
        if (!meta.isFile()) throw new BootstrapError("file_type", "Context identity requires an ordinary file.", path)
        return String(meta.dev) + ":" + String(meta.ino)
      } finally { await shut(fd) }
    } finally { await dir.close() }
  }
  async write(path: string, data: Buffer, expected: string | null, mode = 0o644, expectedMode = expected === null ? undefined : mode) {
    const dir = await this.parent(path, true)
    if (!dir) throw new BootstrapError("directory_failed", "Unable to access parent directory.", path)
    const temp = ".bootstrap-" + randomUUID() + ".tmp"
    let made = false
    try {
      const fd = result(ffi().lib.symbols.openat!(dir.fd, cstr(temp), constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600) as number, path)
      if (fd === null) throw new BootstrapError("write_failed", "Unable to create a temporary file.", path)
      made = true
      try {
        let size = 0
        while (size < data.length) {
          const out = await push(fd, data, size, data.length - size, size)
          if (!out.bytesWritten) throw new BootstrapError("write_failed", "File write made no progress.", path)
          size += out.bytesWritten
        }
        await chmod(fd, mode)
        await sync(fd)
      } finally { await shut(fd) }
      const latest = await this.readAt(dir.fd, dir.name, 32 * 1024 * 1024)
      if ((latest ? hash(latest.data) : null) !== expected) throw new BootstrapError("concurrent_change", "Target changed before publication.", path)
      if (expectedMode !== undefined && latest?.mode !== expectedMode) throw new BootstrapError("concurrent_change", "Target permissions changed before publication.", path)
      const code = expected === null
        ? ffi().lib.symbols.linkat!(dir.fd, cstr(temp), dir.fd, cstr(dir.name), 0)
        : ffi().lib.symbols.renameat!(dir.fd, cstr(temp), dir.fd, cstr(dir.name))
      if (code !== 0) throw new BootstrapError("publish_failed", "Unable to publish file; preserve the current target.", path)
      const actual = await this.readAt(dir.fd, dir.name, 32 * 1024 * 1024)
      if (!actual || !actual.data.equals(data)) throw new BootstrapError("readback_mismatch", "Written content could not be confirmed.", path)
    } finally {
      if (made) ffi().lib.symbols.unlinkat!(dir.fd, cstr(temp), 0)
      await dir.close()
    }
  }
  async remove(path: string, expected: string, expectedMode?: number) {
    const dir = await this.parent(path)
    if (!dir) throw new BootstrapError("concurrent_change", "Owned file is missing.", path)
    try {
      const current = await this.readAt(dir.fd, dir.name)
      if (!current || hash(current.data) !== expected) throw new BootstrapError("concurrent_change", "Owned file changed before removal.", path)
      if (expectedMode !== undefined && current.mode !== expectedMode) throw new BootstrapError("concurrent_change", "Owned file permissions changed before removal.", path)
      if (ffi().lib.symbols.unlinkat!(dir.fd, cstr(dir.name), 0) !== 0) throw new BootstrapError("remove_failed", "Unable to remove the owned file.", path)
    } finally { await dir.close() }
  }
}
