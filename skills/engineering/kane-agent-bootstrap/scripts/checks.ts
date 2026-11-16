import { lstat, readdir, realpath } from "node:fs/promises"
import { basename, dirname, extname, join, relative } from "node:path"
import { parseDocument } from "yaml"
import { assessContext, finding, insidePath, nonempty, privatePath, readBounded, record, sha256, type Finding, type Status } from "./context.ts"

export type Report = { schema_version: 1; command: string; scope: string; status: Status; findings: Finding[]; [key: string]: unknown }
type Source = { path: string; raw: Uint8Array; text: string }
type Link = { value?: string; missing_reference?: boolean; line: number }
const limits = { files: 3000, file_bytes: 512 * 1024, total_bytes: 8 * 1024 * 1024, entries: 20000 }
const skip = new Set([".git", ".hg", ".svn", "node_modules", ".venv", "venv", "__pycache__", ".cache", ".next", ".nuxt", ".pnpm-store", ".pytest_cache", ".mypy_cache", ".ruff_cache", ".tox", "dist", "build", "target", "coverage", "vendor", ".aws", ".ssh", ".gnupg", "private", "secrets"])
const manifests = new Set(["package.json", "pyproject.toml", "requirements.txt", "go.mod", "Cargo.toml", "Gemfile", "pom.xml", "build.gradle", "build.gradle.kts", "composer.json", "deno.json", "deno.jsonc", "mix.exs", "Package.swift", "CMakeLists.txt", "Makefile", "makefile", "Justfile", "justfile", "Taskfile.yml", "Taskfile.yaml"])
const locks = new Set(["package-lock.json", "pnpm-lock.yaml", "yarn.lock", "bun.lock", "bun.lockb", "uv.lock", "poetry.lock", "Cargo.lock", "Gemfile.lock", "composer.lock", "go.sum", "deno.lock"])
const placeholder = /【[^】\n]+】|<(?:[^>\n]*[\u4e00-\u9fff][^>\n]*|project-name|store_name|engine|framework|warehouse-dir)>/
const exampleEnv = (name: string) => /^\.env\.(?:.*\.)?(?:example|sample|template)$/i.test(name)
const status = (items: Finding[]): Status => items.some(f => f.status === "failed") ? "failed" : items.some(f => f.status === "unverified") ? "unverified" : "passed"

async function scan(root: string) {
  const records: Source[] = []
  const findings: Finding[] = []
  const stack = [root]
  let total = 0
  let entries = 0
  let truncated = false
  while (stack.length && !truncated) {
    const dir = stack.pop()!
    let children
    try {
      if ((await lstat(dir)).isSymbolicLink()) continue
      children = (await readdir(dir, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name, "en"))
    } catch {
      findings.push(finding(relative(root, dir) || ".", "unreadable_directory", "Directory could not be read.", "unverified"))
      continue
    }
    for (const child of children) {
      if (++entries > limits.entries) { truncated = true; break }
      const path = join(dir, child.name)
      const rel = relative(root, path).split("\\").join("/")
      if (child.isSymbolicLink() || privatePath(rel)) continue
      if (child.isDirectory()) {
        if (!skip.has(child.name) && !skip.has(child.name.toLowerCase())) stack.push(path)
        continue
      }
      if (!child.isFile()) continue
      if (records.length >= limits.files) { truncated = true; break }
      try {
        const safe = await insidePath(root, root, rel)
        const meta = await lstat(safe)
        if (meta.size > limits.file_bytes) {
          findings.push(finding(rel, "file_size_limit", "File exceeded the read limit.", "unverified"))
          continue
        }
        if (total + meta.size > limits.total_bytes) { truncated = true; break }
        total += meta.size
        const data = await readBounded(safe, limits.file_bytes)
        if (!data.text.includes("\0")) records.push({ path: rel, ...data })
      } catch (err) {
        if (err instanceof TypeError) continue
        findings.push(finding(rel, "unreadable_file", "File could not be read as stable bounded text.", "unverified"))
      }
    }
  }
  if (truncated) findings.push(finding(".", "scan_truncated", "Scan reached a configured limit; inspect omitted paths separately.", "unverified"))
  return { records, findings, truncated }
}

function kind(path: string) {
  const name = basename(path)
  if (["AGENTS.md", "CLAUDE.md", "GEMINI.md"].includes(name)) return "instruction"
  if (manifests.has(name)) return "manifest"
  if (locks.has(name) || name.endsWith(".lock")) return "lockfile"
  if (exampleEnv(name)) return "variable_example"
  if (/^(?:compose\.|docker-compose\.)/.test(name) || name === "Dockerfile") return "service_configuration"
  if (extname(path).toLowerCase() === ".md") return "documentation"
  if ([".json", ".yaml", ".yml", ".toml", ".ini", ".cfg", ".xml"].includes(extname(path).toLowerCase())) return "configuration"
  return "source_or_resource"
}

export async function inspectProject(dir: string): Promise<Report> {
  const root = await realpath(dir)
  const data = await scan(root)
  const files: { path: string; sha256: string; size: number; kind: string }[] = []
  const commands: { name: string; source: string; working_directory: string }[] = []
  const variables: { name: string; source: string }[] = []
  const groups: Record<string, string[]> = { instructions: [], configuration: [], documentation: [], tests: [], samples: [], history: [] }
  for (const src of data.records) {
    const name = basename(src.path)
    const type = kind(src.path)
    files.push({ path: src.path, sha256: sha256(src.raw), size: src.raw.byteLength, kind: type })
    if (type === "instruction") groups.instructions!.push(src.path)
    if (["manifest", "lockfile", "configuration", "service_configuration", "variable_example"].includes(type)) groups.configuration!.push(src.path)
    if (type === "documentation") groups.documentation!.push(src.path)
    if (/(?:^|\/)(?:tests?|__tests__|specs?)(?:\/|$)|(?:^|[._-])(?:test|spec)[._-]/i.test(src.path)) groups.tests!.push(src.path)
    if (/(?:^|\/)(?:examples?|samples?|fixtures?|testdata|seeds?)(?:\/|$)/i.test(src.path)) groups.samples!.push(src.path)
    if (/(?:^|\/)(?:adr|decisions?)(?:\/|$)|(?:^|\/)(?:CHANGELOG|HISTORY)(?:\.|$)/i.test(src.path)) groups.history!.push(src.path)
    if (name === "package.json") {
      try {
        const val: unknown = JSON.parse(src.text)
        if (record(val) && record(val.scripts)) {
          for (const [name, cmd] of Object.entries(val.scripts)) if (typeof cmd === "string") commands.push({ name, source: src.path, working_directory: dirname(src.path) })
        }
      } catch {
        data.findings.push(finding(src.path, "unparsed_manifest", "Manifest could not be parsed; inspect its source separately.", "warning"))
      }
    }
    if (["Makefile", "makefile", "Justfile", "justfile"].includes(name)) {
      for (const match of src.text.matchAll(/^([A-Za-z0-9_][A-Za-z0-9_.-]*)\s*:(?!=)/gm)) commands.push({ name: match[1]!, source: src.path, working_directory: dirname(src.path) })
    }
    if (exampleEnv(name)) {
      for (const match of src.text.matchAll(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/gm)) variables.push({ name: match[1]!, source: src.path })
    }
  }
  for (const key of Object.keys(groups)) groups[key]!.sort()
  let git = false
  try { git = (await lstat(join(root, ".git"))).isDirectory() || (await lstat(join(root, ".git"))).isFile() } catch {}
  return { schema_version: 1, command: "inspect", scope: "read_only", status: status(data.findings), root, files: files.sort((a, b) => a.path.localeCompare(b.path, "en")), commands, variables, source_groups: groups, findings: data.findings, truncated: data.truncated, limits, version_control: { git_marker_present: git }, commands_executed: 0 }
}

function blankCode(text: string, inline = true) {
  let char = ""
  let size = 0
  const out: string[] = []
  for (const line of text.split(/(?<=\n)/)) {
    const mark = line.match(/^ {0,3}(`{3,}|~{3,})/)
    if (char) {
      out.push(line.replace(/[^\n]/g, " "))
      if (new RegExp(`^ {0,3}${char}{${size},}\\s*$`).test(line)) { char = ""; size = 0 }
    } else if (mark) {
      char = mark[1]![0]!
      size = mark[1]!.length
      out.push(line.replace(/[^\n]/g, " "))
    } else out.push(line)
  }
  const body = out.join("")
  return inline ? body.replace(/(`+)(.*?)\1/g, val => " ".repeat(val.length)) : body
}

function headings(text: string) {
  const body = blankCode(text, false)
  const lines = body.split("\n")
  const out = new Set<string>()
  const seen = new Map<string, number>()
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!
    const atx = line.match(/^#{1,6}\s+(.+?)\s*#*\s*$/)
    let val = atx?.[1]
    if (!val && i && /^ {0,3}(?:=+|-+)\s*$/.test(line) && lines[i - 1]!.trim()) {
      val = lines[i - 1]!.trim()
      if (/^(?:#{1,6}\s|[-*+]\s|>\s|\d+[.)]\s)/.test(val)) continue
    }
    if (!val) continue
    val = val.replace(/!?\[([^\]]+)\]\([^)]*\)/g, "$1").replace(/<[^>]+>/g, "").toLowerCase().replace(/[\p{P}\p{S}]/gu, ch => "-_".includes(ch) ? ch : "").replace(/\s/g, "-")
    const count = seen.get(val) ?? 0
    seen.set(val, count + 1)
    out.add(count ? `${val}-${count}` : val)
  }
  for (const match of body.matchAll(/\b(?:id|name)=["']([^"']+)["']/g)) out.add(match[1]!)
  return out
}

function links(text: string): Link[] {
  let body = blankCode(text)
  const out: Link[] = []
  const defs = new Map<string, string>()
  const def = /^ {0,3}\[([^\]\n]+)\]:[ \t]*(?:<([^>\n]+)>|(\S+)).*$/gm
  const label = (val: string) => val.trim().replace(/\s+/g, " ").toLowerCase()
  for (const match of body.matchAll(def)) if (!defs.has(label(match[1]!))) defs.set(label(match[1]!), match[2] || match[3]!)
  body = body.replace(def, val => " ".repeat(val.length))
  const spans: [number, number][] = []
  for (const match of body.matchAll(/!?\[[^\]\n]*\]\(/g)) {
    const start = match.index! + match[0].length
    let end = start
    let value = ""
    if (body[start] === "<") {
      end = body.indexOf(">", start + 1)
      if (end >= 0) value = body.slice(start + 1, end)
    } else {
      let depth = 0
      while (end < body.length) {
        const ch = body[end]!
        if (ch === "(" && body[end - 1] !== "\\") depth++
        else if (ch === ")" && body[end - 1] !== "\\") { if (!depth) break; depth-- }
        else if (/\s/.test(ch) && !depth) break
        end++
      }
      value = body.slice(start, end)
    }
    const line = body.slice(0, match.index).split("\n").length
    if (value) out.push({ value, line })
    const close = body[end] === ")" ? end : body.indexOf(")", end)
    spans.push([match.index!, close < 0 ? body.length : close + 1])
  }
  for (const match of body.matchAll(/!?\[([^\]\n]+)\](?:\[([^\]\n]*)\])?/g)) {
    if (spans.some(([start, end]) => start <= match.index! && match.index! < end)) continue
    const value = defs.get(label(match[2] || match[1]!))
    const line = body.slice(0, match.index).split("\n").length
    if (value) out.push({ value, line })
    else if (match[2] !== undefined) out.push({ missing_reference: true, line })
  }
  return out
}

async function checkReference(root: string, base: string, ref: string, path: string, items: Finding[], code: string, line?: number) {
  if (/^[a-z][a-z0-9+.-]*:/i.test(ref) || ref.startsWith("//")) return
  try {
    const index = ref.indexOf("#")
    const file = decodeURIComponent((index < 0 ? ref : ref.slice(0, index)).split("?")[0]!)
    const anchor = index < 0 ? "" : decodeURIComponent(ref.slice(index + 1))
    const target = file ? await insidePath(root, base, file) : base
    const meta = await lstat(target)
    if (meta.isSymbolicLink() || privatePath(relative(root, target))) throw new Error("unsafe_reference")
    if (anchor && meta.isFile() && extname(target).toLowerCase() === ".md") {
      try {
        if (!headings((await readBounded(target)).text).has(anchor)) items.push(finding(path, "missing_anchor", "Referenced Markdown heading or anchor does not exist.", "failed", { line }))
      } catch {
        items.push(finding(path, "anchor_unverified", "Referenced heading could not be checked as bounded text.", "unverified", { line }))
      }
    }
  } catch {
    items.push(finding(path, code, "Referenced path is missing, outside the project, private or unreadable.", "failed", { line }))
  }
}

function configuration(text: string): unknown {
  const doc = parseDocument(text, { uniqueKeys: true })
  if (doc.errors.length) throw new Error("configuration_parse")
  return doc.toJS({ maxAliasCount: 100 })
}

async function checkProject(root: string, data: unknown, path: string, findings: Finding[]) {
  const issue = (code: string, msg: string, level: Finding["status"] = "failed") => findings.push(finding(path, code, msg, level))
  const unknown = (name: string) => issue("undeclared", `${name} is not declared; this is not an empty collection.`, "warning")
  if (!record(data)) { issue("configuration_type", "Project configuration must be a mapping."); return }
  if (data.schema_version !== 1) issue("schema_version", "Project configuration must use schema_version 1.")
  if (!record(data.project) || !nonempty(data.project.name)) issue("project_identity", "Project must declare a nonempty name.")
  else for (const name of ["purpose", "language", "timezone"]) if (data.project[name] != null && !nonempty(data.project[name])) issue("project_field_type", "Project fields must be strings when declared.")
  const env = data.environment
  if (!record(env)) { issue("environment_type", "Environment must be a mapping."); return }
  for (const name of ["supported_platforms", "toolchains", "services", "tools", "variables", "commands", "local_paths"]) {
    if (env[name] == null) unknown(`environment.${name}`)
    else if (["commands", "local_paths"].includes(name) ? !record(env[name]) : !Array.isArray(env[name])) issue("environment_field_type", `environment.${name} has the wrong collection type.`)
  }
  if (Array.isArray(env.supported_platforms) && env.supported_platforms.some(val => !nonempty(val))) issue("platform_type", "Supported platform entries must be nonempty strings.")
  if (record(env.commands)) {
    for (const cmd of Object.values(env.commands)) {
      if (!record(cmd)) { issue("command_type", "Each command declaration must be a mapping."); continue }
      for (const key of ["run", "working_directory", "definition_source"]) if (!nonempty(cmd[key])) issue("command_field", `Each command must declare a nonempty ${key}.`)
      if (nonempty(cmd.working_directory)) {
        try { if (!(await lstat(await insidePath(root, root, cmd.working_directory))).isDirectory()) throw new Error("not_directory") }
        catch { issue("command_directory", "Command working directory must be a directory inside the project without symbolic links.") }
      }
      if (nonempty(cmd.definition_source)) await checkReference(root, root, cmd.definition_source, path, findings, "command_source")
      for (const key of ["prerequisites", "side_effects"]) {
        if (cmd[key] == null) unknown(`command.${key}`)
        else if (!Array.isArray(cmd[key])) issue("command_field_type", `Command ${key} must be a list or null.`)
      }
    }
  }
  for (const key of ["toolchains", "services", "tools", "variables"]) {
    if (!Array.isArray(env[key])) continue
    for (const val of env[key]) {
      if (!record(val) || !nonempty(val.name)) { issue("named_entry", `Each environment.${key} entry must declare a name.`); continue }
      if (key === "variables" && Object.hasOwn(val, "value")) issue("variable_value", "Variable declarations must reference names and sources, not store values.")
    }
  }
  if (record(env.local_paths)) for (const val of Object.values(env.local_paths)) {
    if (!record(val) || !nonempty(val.path)) { issue("local_path_type", "Each local path needs a project-relative path."); continue }
    try { await insidePath(root, root, val.path) } catch { issue("local_path_boundary", "Local paths must stay inside the project without symbolic links.") }
  }
  if (data.requirements == null) unknown("requirements")
  else if (!record(data.requirements)) issue("requirements_type", "Requirements must be a mapping or null.")
  else {
    for (const key of ["filesystem", "network"]) {
      if (data.requirements[key] == null) unknown(`requirements.${key}`)
      else if (!Array.isArray(data.requirements[key])) issue("requirements_field_type", `requirements.${key} must be a list or null.`)
    }
    if (Array.isArray(data.requirements.filesystem)) for (const val of data.requirements.filesystem) {
      if (!record(val) || !nonempty(val.path)) { issue("filesystem_requirement", "Filesystem requirements need project-relative paths."); continue }
      try { await insidePath(root, root, val.path) } catch { issue("filesystem_boundary", "Filesystem requirements must stay inside the project.") }
      if (!Array.isArray(val.access) || val.access.some(item => !nonempty(item))) issue("filesystem_access", "Filesystem access must be a list of capability names.")
    }
  }
  if (data.guides != null && !record(data.guides)) issue("guides_type", "Guides must be a mapping or null.")
  else if (record(data.guides)) for (const val of Object.values(data.guides)) {
    if (!nonempty(val)) issue("guide_type", "Guide references must be nonempty strings.")
    else await checkReference(root, root, val, path, findings, "guide_reference")
  }
}

function checkAgents(data: unknown, path: string, items: Finding[]) {
  const issue = (code: string, msg: string) => items.push(finding(path, code, msg))
  if (!record(data) || data.schema_version !== 1) { issue("agents_schema", "Role configuration needs schema_version 1."); return }
  const defaults = data.defaults ?? {}
  const agents = data.agents ?? []
  if (!record(defaults) || !Array.isArray(agents)) { issue("agents_type", "Defaults must be a mapping and agents a list."); return }
  const roles = new Set<string>()
  for (const val of [defaults, ...agents]) {
    if (!record(val)) { issue("role_type", "Each role must be a mapping."); continue }
    if (val !== defaults) {
      if (!nonempty(val.role) || roles.has(val.role)) issue("role_identity", "Role names must be nonempty and unique.")
      else roles.add(val.role)
    }
    for (const key of ["agent", "model", "prompt"]) if (val[key] != null && !nonempty(val[key])) issue("role_field", "Declared role fields must be nonempty strings or null.")
  }
}

export async function verifyProject(dir: string, paths?: string[], contextPath?: string): Promise<Report> {
  const root = await realpath(dir)
  const findings: Finding[] = []
  const selected = new Set<string>()
  if (paths === undefined) {
    const data = await scan(root)
    findings.push(...data.findings)
    for (const src of data.records) if (src.path.endsWith(".md") || ["project.yml", "agents.yml"].includes(src.path)) selected.add(join(root, src.path))
    for (const name of ["AGENTS.md", "project.yml"]) {
      try { const meta = await lstat(join(root, name)); if (meta.isSymbolicLink() || !meta.isFile()) throw new Error("not_file") }
      catch { findings.push(finding(name, "missing_entry", "Required adoption entry is missing or not an ordinary file.")) }
    }
  } else for (const rel of paths) {
    try {
      const path = await insidePath(root, root, rel)
      if (privatePath(relative(root, path)) || !(await lstat(path)).isFile()) throw new Error("private_or_missing")
      selected.add(path)
    } catch { findings.push(finding(rel, "path_boundary", "Selected path must be a nonprivate ordinary file inside the project.")) }
  }
  const checked: string[] = []
  let count = 0
  for (const path of [...selected].sort()) {
    const rel = relative(root, path)
    let text: string
    try { text = (await readBounded(path)).text }
    catch { findings.push(finding(rel, "unreadable_file", "Selected file could not be read as bounded text.", "unverified")); continue }
    checked.push(rel)
    if (extname(path).toLowerCase() === ".md") {
      for (const link of links(text)) {
        count++
        if (link.missing_reference) { findings.push(finding(rel, "missing_reference_definition", "Markdown reference link has no definition.", "failed", { line: link.line })); continue }
        await checkReference(root, link.value!.startsWith("#") ? path : dirname(path), link.value!, rel, findings, "markdown_reference", link.line)
      }
      if (basename(path) === "AGENTS.md" && placeholder.test(blankCode(text))) findings.push(finding(rel, "placeholder", "Adopted collaboration entry contains an unfinished placeholder."))
    } else if (["project.yml", "agents.yml"].includes(basename(path))) {
      try {
        const data = configuration(text)
        if (basename(path) === "project.yml") {
          if (placeholder.test(text)) findings.push(finding(rel, "placeholder", "Project configuration contains an unfinished placeholder."))
          await checkProject(root, data, rel, findings)
        } else checkAgents(data, rel, findings)
      } catch { findings.push(finding(rel, "configuration_parse", "Configuration is malformed, unsupported or contains duplicate mapping keys.")) }
    }
  }
  const context = contextPath ? await assessContext(root, contextPath) : undefined
  if (context) {
    findings.push(...context.findings)
    if (context.blocked_stages.includes("apply")) findings.push(finding("context", "context_blocked", "An unresolved fact blocks file adoption."))
  }
  return { schema_version: 1, command: "verify", scope: "static_only", status: status(findings), checked_files: checked, checks: { files: checked.length, markdown_links: count }, findings, commands_executed: 0, runtime_verified: false, business_verified: false, ...(context ? { context } : {}) }
}
