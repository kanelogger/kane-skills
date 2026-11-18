import { basename, dirname, posix } from "node:path"
import { parseDocument } from "yaml"
import { finding, nonempty, privatePath, record, type Finding } from "./context.ts"
import { BootstrapError, Files, parts } from "./files.ts"
import type { ContextEntry, ContextIndex } from "./routes.ts"

type CheckCommand = { key: string; name: string; source: string }
type Selection = { kind: "manifest" | "package"; name?: string }

const indexFile = ".agents/context/index.json"
const invalidCode = "adoption_check_invalid"
const fileLimit = 512 * 1024
const totalLimit = 8 * 1024 * 1024
const commandName = /^[a-z0-9][a-z0-9:._-]{0,127}$/i
const conventional = /(?:^|[:._-])(?:checks?|tests?|lint|verify|validat(?:e|ion)|type[-_]?check)(?=$|[:._-])/i
const decode = (raw: Uint8Array) => new TextDecoder("utf-8", { fatal: true }).decode(raw)

function invalid(message: string): never {
  throw new BootstrapError(invalidCode, message)
}

function publicPath(value: string) {
  const path = value.replace(/^\.\//, "")
  if (path.length > 4096 || /[\x00-\x1f\x7f:?#]/.test(path) || privatePath(path) || path.toLowerCase() === indexFile) {
    return invalid("Command definitions and working directories must use public project-relative paths.")
  }
  parts(path)
  return path
}

function field(value: unknown, key: string): unknown {
  return record(value) && Object.hasOwn(value, key) ? value[key] : undefined
}

class Sources {
  private bytes = 0
  private files = new Map<string, Promise<{ data: Buffer; mode: number }>>()
  private mappings = new Map<string, Promise<unknown>>()

  constructor(private fs: Files) {}

  read(path: string) {
    if (!this.files.has(path)) this.files.set(path, this.readFile(path))
    return this.files.get(path)!
  }

  private async readFile(path: string) {
    const raw = await this.fs.read(path, Math.min(fileLimit, totalLimit - this.bytes))
    if (!raw || !raw.data.byteLength) return invalid("The command definition must be a nonempty ordinary project file.")
    this.bytes += raw.data.byteLength
    return raw
  }

  mapping(path: string) {
    if (!this.mappings.has(path)) this.mappings.set(path, this.parseFile(path))
    return this.mappings.get(path)!
  }

  private async parseFile(path: string): Promise<unknown> {
    const text = decode((await this.read(path)).data)
    const doc = parseDocument(text, { uniqueKeys: true })
    if (doc.errors.length) return invalid("The command source must use valid structured data with unique keys.")
    return basename(path) === "package.json" ? JSON.parse(text) : doc.toJS({ maxAliasCount: 100 })
  }

  async directory(path: string) {
    if (path === ".") return
    const dir = await this.fs.parent(`${path}/definition`)
    if (!dir) return invalid("The command working directory must be an existing project directory without symbolic links.")
    await dir.close()
  }
}

function selection(entry: ContextEntry): Selection | undefined {
  const path = entry.select
  if (!path) return
  if (entry.file === "project.yml" && path[0] === "environment" && path[1] === "commands"
    && (path.length === 2 || path.length === 3 || (path.length === 4 && path[3] === "run"))) {
    return { kind: "manifest", name: path[2] }
  }
  if (basename(entry.file) === "package.json" && path[0] === "scripts" && path.length <= 2) {
    return { kind: "package", name: path[1] }
  }
}

function isCheck(name: string, explicit: boolean) {
  return commandName.test(name) && (explicit || conventional.test(name))
}

async function packageScript(path: string, name: string, sources: Sources) {
  const value = field(field(await sources.mapping(path), "scripts"), name)
  if (!nonempty(value)) return invalid("The selected package script is missing or empty.")
  return `${path}#scripts.${name}`
}

function invokedScript(run: string) {
  const match = /^(npm|pnpm|bun|yarn)[ \t]+(?:(run|run-script)[ \t]+)?([A-Za-z0-9][A-Za-z0-9:._-]{0,127})$/.exec(run)
  if (!match) return
  const [, tool, action, name] = match
  if (action === "run-script" && tool !== "npm") return
  if (!action && ((tool === "npm" && name !== "test") || (tool === "bun" && name === "test"))) return
  return name
}

function invokesLocalFile(run: string, directory: string, path: string, mode: number) {
  const interpreter = /^(?:(?:sh|bash|zsh|bun|node|tsx|ts-node|python(?:[0-9.]+)?|ruby|perl|php|pytest)[ \t]+|(?:deno|go)[ \t]+run[ \t]+)/.exec(run)
  const args = run.slice(interpreter?.[0].length ?? 0)
  const token = /^(?:"([^"\r\n$`\\]+)"|'([^'\r\n]+)'|([\w./-]+))(?=[ \t]|$)/.exec(args)
  const file = token?.[1] ?? token?.[2] ?? token?.[3]
  return Boolean(file && !posix.isAbsolute(file) && (interpreter || (file.includes("/") && (mode & 0o111))) && posix.join(directory, file) === path)
}

async function manifestCommand(value: unknown, sources: Sources) {
  const run = field(value, "run")
  const directory = field(value, "working_directory")
  const definition = field(value, "definition_source")
  if (!nonempty(run) || !nonempty(directory) || !nonempty(definition) || run.includes("\0") || /^\s*<[^<>]+>\s*$/.test(run)) {
    return invalid("A project command requires nonempty run, working_directory and definition_source fields.")
  }
  const dir = directory === "." ? directory : publicPath(directory)
  await sources.directory(dir)
  const [file, selector, extra] = definition.split("#", 3)
  if (!file || (selector !== undefined && !/^[\p{L}\p{N}_.:%/-]{1,256}$/u.test(selector)) || extra !== undefined) {
    return invalid("The command definition must identify a project file with an optional valid fragment.")
  }
  const path = publicPath(file)
  const filename = basename(path)
  if (path === "project.yml") return invalid("The command declaration must point to its definition outside project.yml.")
  if (filename === "package.json") {
    const name = invokedScript(run.trim())
    if (!name || dirname(path) !== dir || (selector !== undefined && selector !== `scripts.${name}`)) {
      return invalid("The package definition must match a single package script invoked from its working directory.")
    }
    return packageScript(path, name, sources)
  }
  const raw = await sources.read(path)
  if (/^(?:makefile|justfile)$/i.test(filename)) {
    const tool = filename.toLowerCase() === "makefile" ? "make" : "just"
    const invocation = /^(make|just)[ \t]+([A-Za-z0-9_][A-Za-z0-9_.-]*)$/.exec(run.trim())
    const name = invocation?.[2]
    const targets = decode(raw.data).matchAll(/^([a-z0-9_][a-z0-9_.-]*)[ \t]*:(?![=:]*=)/gmi)
    if (!name || invocation[1] !== tool || dirname(path) !== dir || (selector !== undefined && selector !== name)
      || !Array.from(targets).some(target => target[1] === name)) {
      return invalid("The command must invoke a target that exists in its Makefile or Justfile.")
    }
    return `${path}#${name}`
  }
  if (selector !== undefined || /\.md$/i.test(path) || !invokesLocalFile(run.trim(), dir, path, raw.mode)) {
    return invalid("The command must name its project-local definition file directly or use a supported named script or target.")
  }
  return path
}

export async function findAdoptionCommand(root: string, index: ContextIndex, findings: Finding[]): Promise<CheckCommand | undefined> {
  const fs = await Files.at(root)
  const sources = new Sources(fs)
  const issues: Finding[] = []
  try {
    for (const key of Object.keys(index.entries).sort()) {
      const entry = index.entries[key]!
      const selected = selection(entry)
      if (!selected) continue
      const explicit = selected.name !== undefined && entry.when?.includes("verify") === true
      if (selected.name !== undefined && !isCheck(selected.name, explicit)) continue
      let problem: unknown
      try {
        const path = publicPath(entry.file)
        const data = await sources.mapping(path)
        const commands = selected.kind === "package" ? field(data, "scripts") : field(field(data, "environment"), "commands")
        if (!record(commands)) invalid("The selected commands or scripts must be a mapping.")
        const names = selected.name === undefined ? Object.keys(commands).sort() : [selected.name]
        for (const name of names) {
          if (!isCheck(name, explicit)) continue
          try {
            const source = selected.kind === "package"
              ? await packageScript(path, name, sources)
              : await manifestCommand(field(commands, name), sources)
            return { key, name, source }
          } catch (err) { problem ??= err }
        }
      } catch (err) { problem = err }
      if (problem && issues.length < 32) {
        const message = problem instanceof BootstrapError && problem.code === invalidCode ? problem.message : "The selected check command or definition could not be read as bounded local data."
        issues.push(finding(entry.file, invalidCode, `Index entry ${key}: ${message}`))
      }
    }
    findings.push(...issues, finding(indexFile, "adoption_check_missing", "The context index does not resolve a project-defined check command."))
  } finally { await fs.close() }
}
