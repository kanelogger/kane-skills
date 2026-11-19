import { dlopen, read as memory, type Pointer } from "bun:ffi"
import { randomUUID } from "node:crypto"
import { closeSync, constants, fchmodSync, fstatSync, fsyncSync, openSync, readSync, writeFileSync } from "node:fs"
import { lstat, readdir, realpath } from "node:fs/promises"
import { join, resolve } from "node:path"

export type Change = { path: string; before: string | null; after: string | null }
type Entry = Change & { mode: number }
const journal = ".kane-harness-pending.json"
const limit = 4 * 1024 * 1024
const markdownLimit = 32 * 1024 * 1024
const directory = constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW
const readable = constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK
const exclusive = constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW
const bytes = (text: string) => Buffer.from(text + "\0")
const folded = (name: string) => name.normalize("NFD").toLowerCase()
const conflict = (path: string) => new Error("内容已变化，请重新生成计划：" + path)

function native() {
  const mac = process.platform === "darwin"
  if (!mac && process.platform !== "linux") throw new Error("文件操作需要 macOS 或 Linux（可使用 WSL）")
  const errno = mac ? "__error" : "__errno_location"
  const lib = dlopen(mac ? "/usr/lib/libSystem.B.dylib" : "libc.so.6", {
    openat: { args: ["i32", "cstring", "i32", "i32"], returns: "i32" },
    mkdirat: { args: ["i32", "cstring", "i32"], returns: "i32" },
    renameat: { args: ["i32", "cstring", "i32", "cstring"], returns: "i32" },
    linkat: { args: ["i32", "cstring", "i32", "cstring", "i32"], returns: "i32" },
    unlinkat: { args: ["i32", "cstring", "i32"], returns: "i32" },
    flock: { args: ["i32", "i32"], returns: "i32" },
    [errno]: { args: [], returns: "ptr" },
  } as const)
  const lastError = () => {
    const ptr = lib.symbols[errno]!() as Pointer | null
    if (!ptr) throw new Error("无法读取系统错误状态")
    return memory.i32(ptr)
  }
  return { f: lib.symbols, lastError }
}
let api: ReturnType<typeof native> | undefined
const sys = () => api ??= native()

export function pathParts(path: string): string[] {
  const parts = path.split("/")
  if (!path || /[\\:\x00-\x1f\x7f]/.test(path) || parts.some(p => !p || p === "." || p === "..")) throw new Error("需要规范的项目相对路径：" + path)
  const names = parts.map(folded)
  const forbidden = new Set([".git", ".hg", ".svn", ".aws", ".ssh", ".gnupg", "private", "secrets", "credentials", "credentials.json", "id_rsa", "id_ed25519"])
  if (names.some((p, i) => forbidden.has(p) || p.startsWith("private-") || p.startsWith(".kane-harness-") ||
      (/^\.env(?:\.|$)/.test(p) && !/\.(example|sample|template)$/.test(p)) || /\.(?:pem|key|p12|pfx|keystore)$/.test(p) ||
      (names[i-1] === ".agents" && (p === "state" || p === "cache" || p.includes(".local."))))) {
    throw new Error("拒绝操作私有路径：" + path)
  }
  return parts
}

function opened(dir: number, name: string, flags: number, mode = 0): number | null {
  const api = sys()
  const fd = api.f.openat!(dir, bytes(name), flags, mode)
  if (fd >= 0) return fd
  const code = api.lastError()
  if (code === 2) return null
  throw new Error("文件不可用、类型不符或经过符号链接：" + name + " (errno " + code + ")")
}

function snapshot(dir: number, name: string, max = limit) {
  const fd = opened(dir, name, readable)
  if (fd === null) return null
  try {
    const before = fstatSync(fd)
    if (!before.isFile()) throw new Error("需要普通文件：" + name)
    if (before.size > max) throw new Error("文件超过 " + max / (1024 * 1024) + " MiB：" + name)
    const data = Buffer.alloc(before.size + 1)
    let size = 0
    while (size < data.length) {
      const count = readSync(fd, data, size, data.length - size, size)
      if (!count) break
      size += count
    }
    const after = fstatSync(fd)
    if (size !== before.size || size !== after.size || after.ctimeMs !== before.ctimeMs) throw conflict(name)
    const body = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(data.subarray(0, size))
    if (body.includes("\0")) throw new Error("目标为二进制文件：" + name)
    return { body, mode: before.mode & 0o777 }
  } finally { closeSync(fd) }
}

function makeFile(dir: number, name: string, content: string, mode: number) {
  const fd = opened(dir, name, exclusive, 0o600)
  if (fd === null) throw new Error("无法创建文件：" + name)
  try {
    writeFileSync(fd, content, "utf8")
    fchmodSync(fd, mode)
    fsyncSync(fd)
  } catch (err) {
    sys().f.unlinkat!(dir, bytes(name), 0)
    throw err
  } finally { closeSync(fd) }
}

function remove(dir: number, name: string, isDir = false) {
  const flag = isDir ? process.platform === "darwin" ? 0x80 : 0x200 : 0
  return sys().f.unlinkat!(dir, bytes(name), flag) === 0
}

class Recovery extends Error {}

function replace(dir: number, name: string, entry: Entry) {
  const { f } = sys()
  const current = snapshot(dir, name)
  if ((current?.body ?? null) !== entry.before || (current && current.mode !== entry.mode)) throw conflict(entry.path)
  const base = ".kane-harness-" + randomUUID()
  const staged = base + ".new"
  const backup = base + ".old"
  let held = false
  let ready = false
  try {
    if (entry.after !== null) {
      makeFile(dir, staged, entry.after, entry.mode)
      ready = true
    }
    if (entry.before !== null) {
      if (f.renameat!(dir, bytes(name), dir, bytes(backup)) !== 0) throw conflict(entry.path)
      held = true
      const prior = snapshot(dir, backup)
      if (prior?.body !== entry.before || prior.mode !== current?.mode) throw conflict(entry.path)
    }
    if (ready && f.linkat!(dir, bytes(staged), dir, bytes(name), 0) !== 0) throw conflict(entry.path)
  } catch (err) {
    if (held && f.linkat!(dir, bytes(backup), dir, bytes(name), 0) !== 0) {
      held = false
      throw new Recovery("请核对原件 " + join(entry.path, "..", backup) + " 和 " + entry.path)
    }
    throw err
  } finally {
    if (ready) remove(dir, staged)
    if (held) remove(dir, backup)
  }
}

export class Project {
  private constructor(readonly root: string, private dev: number, private ino: number) {}

  static async open(path: string): Promise<Project> {
    const stat = await lstat(resolve(path))
    if (!stat.isDirectory()) throw new Error("项目根必须是普通目录")
    return new Project(await realpath(path), stat.dev, stat.ino)
  }

  private async withRoot<T>(work: (root: number) => Promise<T>): Promise<T> {
    const fd = openSync(this.root, directory)
    try {
      const actual = fstatSync(fd)
      if (actual.dev !== this.dev || actual.ino !== this.ino) throw conflict(this.root)
      return await work(fd)
    } finally { closeSync(fd) }
  }

  private async at<T>(root: number, path: string, created: string[] | null, work: (dir: number, name: string) => T, missingCaseAlias = false): Promise<T | null> {
    const parts = pathParts(path)
    const owned: number[] = []
    let parent = this.root
    let dir = root
    try {
      for (const [index, name] of parts.entries()) {
        const actual = await realpath((process.platform === "darwin" ? "/dev/fd/" : "/proc/self/fd/") + dir)
        if (actual.normalize("NFD") !== parent.normalize("NFD")) throw conflict(path)
        const aliases = (await readdir(actual, { withFileTypes: true })).filter(entry => folded(entry.name) === folded(name))
        if (aliases.length > 1) throw new Error("路径大小写冲突：" + path)
        const entry = aliases[0]
        if (missingCaseAlias && !entry) return null
        if (entry && entry.name.normalize("NFD") !== name.normalize("NFD")) {
          if (!missingCaseAlias) throw new Error("路径大小写冲突：" + path)
          if (entry.isSymbolicLink()) throw new Error("路径经过符号链接：" + path)
          return null
        }
        if (index === parts.length - 1) return work(dir, name)
        let next = opened(dir, name, directory)
        if (next === null && created) {
          if (sys().f.mkdirat!(dir, bytes(name), 0o755) === 0) created.push(parts.slice(0, index + 1).join("/"))
          else if (sys().lastError() !== 17) throw new Error("无法创建目录：" + name)
          next = opened(dir, name, directory)
        }
        if (next === null) return null
        owned.push(next)
        dir = next
        parent = join(parent, name)
      }
      return null
    } finally { for (const fd of owned.reverse()) closeSync(fd) }
  }

  private async readText(path: string, max: number, missingCaseAlias = false): Promise<string | null> {
    return this.withRoot(root => this.at(root, path, null, (dir, name) => snapshot(dir, name, max)?.body ?? null, missingCaseAlias))
  }

  async read(path: string): Promise<string | null> {
    return this.readText(path, limit)
  }

  async readExact(path: string): Promise<string | null> {
    return this.readText(path, limit, true)
  }

  async readMarkdown(path: string): Promise<string | null> {
    if (!/\.(?:md|markdown)$/i.test(path)) throw new Error("扫描需要 Markdown 文件：" + path)
    return this.readText(path, markdownLimit)
  }

  async exists(path: string): Promise<boolean> {
    if (path === ".") return true
    return this.withRoot(async root => !!await this.at(root, path, null, (dir, name) => {
      const fd = opened(dir, name, readable)
      if (fd === null) return false
      try {
        const meta = fstatSync(fd)
        return meta.isFile() || meta.isDirectory()
      } finally { closeSync(fd) }
    }))
  }

  async commit(changes: Change[]): Promise<void> {
    if (!changes.length) return
    await this.withRoot(async root => {
      if (sys().f.flock!(root, 6) !== 0) throw new Error("另一项变更正在写入项目，请重新运行计划")
      const pending = opened(root, journal, readable)
      if (pending !== null) {
        closeSync(pending)
        throw new Error("请先核对上次中断的写入记录：" + journal)
      }
      const names = new Map<string, string>()
      const entries: Entry[] = []
      for (const change of changes) {
        const parts = pathParts(change.path)
        if (change.after !== null && (Buffer.byteLength(change.after) > limit || change.after.includes("\0"))) throw new Error("待写入正文过大或包含空字节：" + change.path)
        for (let i = 1; i <= parts.length; i++) {
          const key = folded(parts.slice(0, i).join("/"))
          const desc = parts.slice(0, i).join("/") + (i === parts.length ? "" : "/")
          const other = names.get(key)
          if (other && (other !== desc || i === parts.length)) throw new Error("变更路径重复或冲突：" + change.path)
          names.set(key, desc)
        }
        const original = await this.at(root, change.path, null, snapshot)
        if ((original?.body ?? null) !== change.before) throw conflict(change.path)
        if (change.before !== change.after) entries.push({ ...change, mode: original?.mode ?? (0o666 & ~process.umask()) })
      }
      if (!entries.length) return
      makeFile(root, journal, JSON.stringify({ version: 1, files: entries }, null, 2) + "\n", 0o600)
      const applied: Entry[] = []
      const created: string[] = []
      let keep = false
      try {
        for (const entry of entries) {
          await this.at(root, entry.path, created, (dir, name) => replace(dir, name, entry))
          applied.push(entry)
        }
        for (const change of changes) {
          const actual = await this.at(root, change.path, null, snapshot)
          if ((actual?.body ?? null) !== change.after) throw conflict(change.path)
        }
      } catch (err) {
        keep = err instanceof Recovery
        const issues: string[] = []
        for (const entry of applied.reverse()) {
          try {
            const undone = await this.at(root, entry.path, null, (dir, name) => {
              replace(dir, name, { ...entry, before: entry.after, after: entry.before })
              return true
            })
            if (!undone) throw conflict(entry.path)
          } catch { keep = true; issues.push(entry.path) }
        }
        for (const path of created.reverse()) {
          try { await this.at(root, path, null, (dir, name) => remove(dir, name, true)) } catch {}
        }
        if (keep) throw new Recovery(String(err) + "；请保留并本地核对 " + journal + " " + issues.join(", "))
        throw err
      } finally {
        if (!keep && !remove(root, journal)) throw new Recovery("请本地核对写入结果并清理 " + journal)
      }
    })
  }
}
