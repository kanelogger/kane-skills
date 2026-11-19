import { createHash } from "node:crypto"
import { basename } from "node:path/posix"
import { loadCatalog, readBody, validTargetPath as publicPath, type Component, type Part } from "./catalog.ts"
import { type Project, type Change } from "./io.ts"
import { routeBody } from "./routing.ts"

export type Reader = Pick<Project, "read"> & Partial<Pick<Project, "readExact">>
export type Action = "init" | "adopt" | "add" | "upgrade" | "remove"
export type Decision = {
  key: string
  mode: "append" | "reference" | "merge" | "keep" | "detach" | "drop"
  path?: string
  from?: string
  fromExpected?: string | null
  fromBaseline?: string
  body?: string
  reason: string
  expected: string | null
  incoming: string | null
  base: string | null
}
type Mode = "block" | "file" | "reference"
type Entry = {
  key: string
  path: string
  sourcePath: string
  mode: Mode
  previous: string
  installed: string | null
  referenceHash: string | null
  custom: boolean
  decision?: string
  reason: string
  prefix: string
}
type Nav = { installed: string; prefix: string }
type State = { version: 1; disabled: string[]; parts: Entry[]; created: string[]; navigation: Nav | null }
type Material = { part: Part; body: string }
type Snapshot = { expected: string | null; base: string | null; incoming: string | null }
export type Issue = Snapshot & Pick<Decision, "from" | "fromExpected" | "fromBaseline"> & { key: string; path: string; reason: string }

const ledger = ".agents/harness.json"
const rootDoc = "AGENTS.md"
const identifier = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/
const fingerprint = /^[a-f0-9]{64}$/
const reserved = "kane-agent-harness:"
const hash = (s: string | null) => s === null ? null : createHash("sha256").update(s).digest("hex")
const owner = (key: string) => key.split("/")[0]!
const markdown = (path: string) => /\.(?:md|markdown)$/i.test(path)
const hasBlocks = (path: string) => markdown(path) || basename(path) === ".gitignore"
const empty = (): State => ({ version: 1, disabled: [], parts: [], created: [], navigation: null })
const order = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0
const componentsOf = (state: State) => [...new Set(state.parts.map(p => owner(p.key)))].sort()
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v)
const validKey = (s: unknown): s is string => typeof s === "string" && s.split("/").length === 2 && s.split("/").every(v => identifier.test(v))
const validHash = (h: unknown) => h === null || typeof h === "string" && fingerprint.test(h)
const prefixOK = (s: unknown) => s === "" || s === "\n"

function receipt(d: Decision) {
  const fields = [d.key, d.mode, d.path ?? null, d.body ?? null, d.reason, d.expected, d.incoming, d.base]
  if (d.from !== undefined) fields.push(d.from, d.fromExpected ?? null, d.fromBaseline!)
  return hash(JSON.stringify(fields))!
}

const baseline = (entry: Entry) => (entry.mode === "reference" ? entry.referenceHash : hash(entry.installed))!

function parseState(raw: string | null): State {
  if (raw === null) return empty()
  const s: unknown = JSON.parse(raw)
  if (!object(s) || s.version !== 1 || !Array.isArray(s.parts) || !Array.isArray(s.created) ||
      !s.created.every(publicPath) || new Set(s.created).size !== s.created.length) throw Error("无效的 harness 采用记录")
  const disabled = s.disabled ?? []
  if (!Array.isArray(disabled) || disabled.some(id => typeof id !== "string" || !identifier.test(id)) || new Set(disabled).size !== disabled.length) throw Error("无效的停用记录")
  const keys = new Set<string>()
  const paths = new Map<string, Mode>()
  for (const p of s.parts) {
    if (!object(p) || !validKey(p.key) || keys.has(p.key) || !publicPath(p.path) || !publicPath(p.sourcePath) ||
      p.decision !== undefined && (typeof p.decision !== "string" || !fingerprint.test(p.decision)) ||
      typeof p.previous !== "string" || typeof p.custom !== "boolean" || typeof p.reason !== "string" || !prefixOK(p.prefix) ||
      !(p.mode === "file" || p.mode === "block" || p.mode === "reference") ||
      (p.mode === "reference" ? p.installed !== null || typeof p.referenceHash !== "string" || !fingerprint.test(p.referenceHash)
        : typeof p.installed !== "string" || p.referenceHash !== null || p.installed.includes(reserved) || (p.mode === "block") !== hasBlocks(p.path))) {
      throw Error("无效或重复的 harness 片段记录")
    }
    if (disabled.includes(owner(p.key))) throw Error("部件同时标为采用及停用")
    keys.add(p.key)
    if (p.mode !== "reference") {
      if (paths.get(p.path) === "file" || (p.mode === "file" && paths.has(p.path))) throw Error("文件存在重复所有权：" + p.path)
      paths.set(p.path, p.mode)
    }
  }
  if (s.navigation !== null && !(object(s.navigation) && typeof s.navigation.installed === "string" && prefixOK(s.navigation.prefix))) {
    throw Error("无效的 harness 导航记录")
  }
  if (s.created.some(p => !paths.has(p) && !(p === rootDoc && s.navigation))) throw Error("缺少文件所有权记录")
  return { ...s, disabled } as State
}

export async function readState(project: Reader) {
  return parseState(await project.read(ledger))
}

class Draft {
  private files = new Map<string, Change>()
  constructor(private project: Reader) {}
  async file(path: string, historical = false) {
    if (!this.files.has(path)) {
      const before = historical && this.project.readExact ? await this.project.readExact(path) : await this.project.read(path)
      this.files.set(path, { path, before, after: before })
    }
    return this.files.get(path)!
  }
  result(absencesCoveredByRename: Set<string>) {
    const files = [...this.files.values()]
    const changes = files.filter(f => f.before !== f.after)
    return { changes, guards: changes.length ? files.filter(f => f.before === f.after &&
      !(f.before === null && absencesCoveredByRename.has(f.path))) : [] }
  }
}

function tokens(path: string, key: string) {
  const token = (type: string) => basename(path) === ".gitignore"
    ? "# " + reserved + type + " " + key
    : "<!-- " + reserved + type + " " + key + " -->"
  return [token("begin"), token("end")] as const
}

type Span = { body: string; start: number; end: number; bodyStart: number; bodyEnd: number }
function spans(text: string, path: string) {
  const result = new Map<string, Span>()
  if (!hasBlocks(path)) return result
  let open: { key: string; start: number; bodyStart: number } | undefined
  const pattern = basename(path) === ".gitignore" ? /^# kane-agent-harness:(begin|end) ([\w/-]+)$/ : /^<!-- kane-agent-harness:(begin|end) ([\w/-]+) -->$/
  for (const line of text.matchAll(/[^\n]*(?:\n|$)/g)) {
    const raw = line[0]
    if (!raw.startsWith(basename(path) === ".gitignore" ? "# " + reserved : "<!-- " + reserved)) continue
    const marker = pattern.exec(raw.replace(/\r?\n$/, ""))
    if (!marker) throw Error("托管边界格式无效：" + path)
    const [, kind, key] = marker
    if (kind === "begin" && !open && !result.has(key!)) {
      open = { key: key!, start: line.index, bodyStart: line.index + raw.length }
    } else if (kind === "end" && open?.key === key) {
      const between = text.slice(open!.bodyStart, line.index)
      const body = between.replace(/\r?\n$/, "")
      result.set(key!, { start: open!.start, end: line.index + raw.length, bodyStart: open!.bodyStart,
        bodyEnd: open!.bodyStart + body.length, body })
      open = undefined
    } else throw Error("托管边界重复、嵌套或不完整：" + path)
  }
  if (open) throw Error("缺少托管结束边界：" + path)
  return result
}

function teamBody(text: string | null, path: string) {
  if (text === null) return null
  let body = text
  for (const s of [...spans(text, path).values()].reverse()) body = body.slice(0, s.start) + body.slice(s.end)
  return body.trimEnd()
}

function current(entry: Entry, text: string | null) {
  if (entry.mode === "reference") return teamBody(text, entry.path)
  if (entry.mode === "file" || text === null) return text
  return spans(text, entry.path).get(entry.key)?.body ?? null
}

function append(file: Change, key: string, body: string) {
  const text = file.after ?? ""
  if (spans(text, file.path).has(key)) throw Error("目标中存在未记录的同名托管段：" + key)
  const [begin, end] = tokens(file.path, key)
  const prefix = text ? "\n" : ""
  file.after = text + prefix + begin + "\n" + body + "\n" + end + "\n"
  return prefix
}

function replace(file: Change, key: string, body: string) {
  const text = file.after!
  const span = spans(text, file.path).get(key)
  if (!span) throw Error("找不到托管片段：" + key)
  file.after = text.slice(0, span.bodyStart) + body + text.slice(span.bodyEnd)
}

function removeBlock(file: Change, key: string, prefix: string, detach: boolean) {
  const text = file.after ?? ""
  const s = spans(text, file.path).get(key)
  if (!s) return
  const start = prefix && text.slice(s.start - prefix.length, s.start) === prefix ? s.start - prefix.length : s.start
  const before = text.slice(0, start)
  const after = text.slice(s.end)
  const needsBreak = before && after && !before.endsWith("\n") && !/^\r?\n/.test(after)
  let retained = needsBreak ? "\n" : ""
  if (detach && s.body) {
    retained = text.slice(start, s.start) + s.body + (s.body.endsWith("\n") ? "" : "\n")
  }
  file.after = before + retained + after
}

async function materials(catalog: Component[], assets: string) {
  const map = new Map<string, Material>()
  for (const c of catalog) for (const part of c.parts) {
    const body = await readBody(assets, part)
    if (!publicPath(part.path) || body.includes(reserved)) throw Error("正式正本使用了保留路径或边界：" + part.path)
    map.set(c.id + "/" + part.id, { part, body })
  }
  return map
}

function snapshots(file: Change, entry?: Entry, material?: Material): Snapshot {
  return { expected: hash(file.before), base: hash(entry?.previous ?? null), incoming: hash(material?.body ?? null) }
}

function referenceConflict(entry: Entry, entries: Entry[]) {
  if (entry.mode !== "reference") return
  const path = entry.path.normalize("NFC").toLowerCase()
  const owner = entries.find(p => p.mode === "file" && p.path.normalize("NFC").toLowerCase() === path)
  if (owner) return "此处整文件由 " + owner.key + " 托管。等价引用须指向项目自有正文，请另选来源；已有交叠记录可用 reference 换源决策重新指定实际来源"
}

function summary(state: State, catalog: Component[]) {
  const components = componentsOf(state)
  const orphans = components.filter(id => !catalog.some(c => c.id === id))
  return { components, orphans, disabled: state.disabled }
}

function navText(state: State, catalog: Component[]) {
  const lines = ["## 协作规范导航", ""]
  for (const id of componentsOf(state)) {
    const paths = [...new Set(state.parts.filter(p => owner(p.key) === id).map(p => p.path))].sort()
    const links = paths.map(p => "[" + p.replace(/[\\[\]]/g, "\\$&") + "](<" +
      p.split("/").map(encodeURIComponent).join("/") + ">)")
    const title = catalog.find(c => c.id === id)?.title ?? id
    lines.push("- " + title + " — " + links.join("、"))
  }
  return lines.join("\n")
}

function navView(state: State, text: string | null) {
  const stored = state.navigation?.installed ?? null
  try {
    const actual = spans(text ?? "", rootDoc).get("navigation")?.body ?? null
    const status = stored === null ? actual === null ? "absent" : "invalid" :
      actual === null ? "missing" : stored === actual ? "current" : "local-change"
    return { path: rootDoc, status, current: actual, installed: stored }
  } catch { return { path: rootDoc, status: "invalid", current: null, installed: stored } }
}

export async function inspectAdoption(project: Reader, assets: string) {
  const draft = new Draft(project)
  const state = parseState((await draft.file(ledger)).before)
  const catalog = await loadCatalog(assets)
  const source = await materials(catalog, assets)
  const issues: Issue[] = []
  const parts = []
  for (const entry of state.parts) {
    const file = await draft.file(entry.path, true)
    const material = source.get(entry.key)
    const stamp = snapshots(file, entry, material)
    const status: string[] = []
    const conflict = referenceConflict(entry, state.parts)
    if (conflict) {
      status.push("ownership-conflict")
      issues.push({ key: entry.key, path: entry.path, reason: conflict, ...stamp })
    }
    let actual: string | null = null
    try { actual = current(entry, file.before) } catch (err) {
      status.push("invalid")
      issues.push({ key: entry.key, path: entry.path, reason: String(err), ...stamp })
    }
    if (actual === null || (entry.mode === "reference" && !actual.trim())) status.push("missing")
    else if (entry.mode === "reference" ? hash(actual) !== entry.referenceHash : actual !== entry.installed) status.push("local-change")
    if (entry.mode === "reference") status.push("reference")
    if (entry.custom) status.push("exception")
    if (!material) status.push("retired")
    else if (material.body !== entry.previous || material.part.path !== entry.sourcePath) status.push("update")
    if (!status.length) status.push("current")
    parts.push({ key: entry.key, path: entry.path, mode: entry.mode, status, reason: entry.reason, fromBaseline: baseline(entry),
      ...stamp, previous: entry.previous, current: actual, installed: entry.installed, next: material?.body ?? null })
  }
  const details = summary(state, catalog)
  for (const [key, material] of source) {
    if (!details.components.includes(owner(key)) || state.parts.some(p => p.key === key)) continue
    const file = await draft.file(material.part.path)
    parts.push({ key, path: material.part.path, mode: "pending", status: ["new"], reason: "",
      ...snapshots(file, undefined, material), previous: null, current: null, installed: null, next: material.body })
  }
  const navigation = navView(state, (await draft.file(rootDoc)).before)
  return { ...details, parts, navigation, issues }
}

function decisionMap(rows: Decision[] = []) {
  if (!Array.isArray(rows)) throw Error("decisions 须为数组")
  const map = new Map<string, Decision>()
  for (const row of rows) {
    if (!object(row) || !validKey(row.key) || map.has(row.key) || !["append", "reference", "merge", "keep", "detach", "drop"].includes(row.mode)
      || typeof row.reason !== "string" || !row.reason.trim() || ![row.expected, row.base, row.incoming].every(validHash)
      || row.path !== undefined && !publicPath(row.path) || row.body !== undefined && (typeof row.body !== "string" || !row.body.trim() || row.body.includes(reserved))
      || (row.from !== undefined || row.fromExpected !== undefined || row.fromBaseline !== undefined) &&
        (row.mode !== "reference" || !publicPath(row.path) || !publicPath(row.from) || row.path.normalize("NFC") === row.from.normalize("NFC") ||
          !validHash(row.fromExpected) || typeof row.fromBaseline !== "string" || !fingerprint.test(row.fromBaseline))
      || row.mode === "merge" && row.body === undefined || row.body !== undefined && !["append", "merge"].includes(row.mode)) {
      throw Error("无效或重复的片段决策：" + String(row?.key))
    }
    map.set(row.key, row)
  }
  return map
}

function routeMap(state: State, source: Map<string, Material>, prior: Entry[]) {
  const routes = new Map<string, string>()
  for (const {part} of source.values()) routes.set(part.path, "")
  for (const e of prior) routes.set(e.sourcePath, "")
  const targets = new Map<string, Set<string>>()
  for (const e of state.parts) {
    const paths = targets.get(e.sourcePath) ?? new Set<string>()
    paths.add(e.path)
    targets.set(e.sourcePath, paths)
  }
  for (const [origin, paths] of targets) routes.set(origin, paths.size === 1 ? [...paths][0]! : rootDoc)
  return routes
}

function routed(body: string, sourcePath: string, path: string, routes: Map<string, string>) {
  return markdown(sourcePath) ? routeBody(body, sourcePath, path, routes) : body
}

async function rebind(draft: Draft, entry: Entry, material: Material, d: Decision) {
  const old = await draft.file(entry.path, true)
  const next = await draft.file(d.path!)
  const stamp = snapshots(next, entry, material)
  const evidence = { key: d.key, path: next.path, from: old.path, fromExpected: hash(old.before), fromBaseline: baseline(entry), ...stamp }
  const target = teamBody(next.before, next.path)
  if (entry.path === next.path && entry.mode === "reference" && entry.decision === receipt(d) &&
      entry.previous === material.body && entry.sourcePath === material.part.path && entry.referenceHash === hash(target)) return
  if (d.from !== old.path || d.fromExpected !== evidence.fromExpected || d.fromBaseline !== evidence.fromBaseline ||
      d.expected !== stamp.expected || d.base !== stamp.base || d.incoming !== stamp.incoming) {
    return { ...evidence, reason: "换源依据已过期或旧位置有误，请核对两处全文、上次采用结果及本版正本" }
  }
  if (!target?.trim()) return { ...evidence, reason: "新来源须已存在，并含有团队自有正文" }
  if (entry.mode === "block") {
    const body = current(entry, old.after)
    removeBlock(old, entry.key, entry.prefix, entry.custom || body !== entry.installed)
  }
  Object.assign(entry, { mode: "reference", path: next.path, sourcePath: material.part.path, previous: material.body,
    installed: null, referenceHash: hash(target), custom: false, prefix: "", reason: d.reason, decision: receipt(d) })
}

export async function operate(project: Reader, assets: string, action: Action, options: { ids?: string[]; decisions?: Decision[] } = {}) {
  const catalog = await loadCatalog(assets)
  const source = await materials(catalog, assets)
  const decisions = decisionMap(options.decisions)
  const draft = new Draft(project)
  const record = await draft.file(ledger)
  const state = parseState(record.before)
  const prior = structuredClone(state.parts)
  const ids = options.ids ?? (action === "upgrade" ? componentsOf(state) :
    ["init", "adopt"].includes(action) ? catalog.filter(c => c.default && !state.disabled.includes(c.id)).map(c => c.id) : [])
  if (!Array.isArray(ids) || !ids.length && (action === "remove" || action === "add") ||
      ids.some(id => typeof id !== "string" || !identifier.test(id))) throw Error("请指定有效的部件标识")
  const selected = new Set(ids)
  for (const id of selected) {
    if (!catalog.some(c => c.id === id) && !(action === "remove" && state.disabled.includes(id) || ["remove", "upgrade"].includes(action) && prior.some(p => owner(p.key) === id))) {
      throw Error("没有此部件：" + id)
    }
    if (action === "upgrade" && !prior.some(p => owner(p.key) === id)) throw Error("部件尚未采用：" + id)
  }
  const issues: Issue[] = []
  const consumed = new Set<string>()
  const pending = new Set<string>()
  const detached = new Set<string>()
  const removed = new Set<string>()
  const rebound = new Set<string>()
  const missingSources = new Set<string>()
  const absencesCoveredByRename = new Set<string>()
  const destinations = new Map<string, Set<string>>()
  for (const entry of prior) {
    const id = owner(entry.key)
    if (!selected.has(id)) continue
    if (action === "remove" || action === "upgrade" && catalog.some(c => c.id === id) && !source.has(entry.key)) removed.add(entry.key)
  }
  state.parts = state.parts.filter(e => !removed.has(e.key))
  if (action === "remove") {
    if (record.before !== null) {
      for (const id of selected) if (!state.disabled.includes(id)) state.disabled.push(id)
    }
  } else {
    state.disabled = state.disabled.filter(id => !selected.has(id))
  }
  if (action !== "remove") for (const [key, material] of source) {
    if (!selected.has(owner(key)) || state.parts.some(e => e.key === key)) continue
    const d = decisions.get(key)
    const path = d?.path ?? material.part.path
    const mode = d?.mode === "reference" ? "reference" : hasBlocks(path) ? "block" : "file"
    state.parts.push({ key, path, sourcePath: material.part.path, mode, previous: material.body,
      installed: null, referenceHash: null, custom: false, reason: "", prefix: "" })
    pending.add(key)
  }
  const issuesFor = (key: string, path: string, reason: string, stamp: Snapshot) => issues.push({ key, path, reason, ...stamp })
  for (const d of decisions.values()) {
    if (d.from === undefined) continue
    consumed.add(d.key)
    const entry = state.parts.find(p => p.key === d.key)
    const material = source.get(d.key)
    if (!entry || !material || pending.has(d.key) || !selected.has(owner(d.key)) || !["adopt", "upgrade"].includes(action)) {
      issuesFor(d.key, d.path!, "换源适用于 adopt 或 upgrade 选中的已采用片段", snapshots(await draft.file(d.path!), entry, material))
      continue
    }
    const from = entry.path
    const issue = await rebind(draft, entry, material, d)
    if (issue) issues.push(issue)
    else {
      rebound.add(d.key)
      if (from !== entry.path) {
        if (d.fromExpected === null) {
          missingSources.add(from)
          if (from.normalize("NFD").toLowerCase() === entry.path.normalize("NFD").toLowerCase()) absencesCoveredByRename.add(from)
        }
        const paths = destinations.get(from) ?? new Set<string>()
        paths.add(entry.path)
        destinations.set(from, paths)
      }
    }
  }
  for (const entry of state.parts) {
    const conflict = referenceConflict(entry, state.parts)
    if (conflict) issuesFor(entry.key, entry.path, conflict, snapshots(await draft.file(entry.path), prior.find(p => p.key === entry.key), source.get(entry.key)))
  }
  if (issues.length) return { changes: [] as Change[], guards: [] as Change[], ...summary(state, catalog), issues, missingSources: [] as string[] }
  const check = (key: string, path: string, stamp: Snapshot, allowed: Decision["mode"][]) => {
    const d = decisions.get(key)
    if (!d) return
    consumed.add(key)
    if (d.path && d.path !== path || !allowed.includes(d.mode) || d.expected !== stamp.expected || d.base !== stamp.base || d.incoming !== stamp.incoming) {
      issuesFor(key, path, "决策已过期、位置有误或不适用于此次操作，请依据当前三方内容重做决策", stamp)
      return
    }
    return d
  }
  for (const entry of prior.filter(p => removed.has(p.key))) {
    const file = await draft.file(entry.path, true)
    const stamp = snapshots(file, entry, source.get(entry.key))
    let actual: string | null
    try { actual = current(entry, file.after) } catch (err) {
      issuesFor(entry.key, entry.path, String(err), stamp)
      continue
    }
    const d = check(entry.key, entry.path, stamp, entry.mode === "reference" ? ["detach"] : ["detach", "drop"])
    if (d?.mode === "detach") detached.add(entry.path)
    if (entry.mode === "reference") continue
    if ((actual !== entry.installed || entry.custom) && !d) {
      issuesFor(entry.key, entry.path, "项目片段含适配、已更改或缺失；保留现状请选择 detach，确认删除已审阅的内容请选择 drop", stamp)
      continue
    }
    if (entry.mode === "block") removeBlock(file, entry.key, entry.prefix, d?.mode === "detach")
    else if (d?.mode !== "detach" && file.after !== null) file.after = ""
  }
  const owns = (path: string) => state.parts.some(p => p.path === path && p.mode !== "reference") || path === rootDoc && !!state.navigation
  const deleteEmpty = (file: Change) => file.after === "" && !detached.has(file.path) && state.created.includes(file.path)
  const mapped = state.parts.map(e => action === "upgrade" && selected.has(owner(e.key)) && source.has(e.key)
    ? { ...e, sourcePath: source.get(e.key)!.part.path } : e)
  const routes = routeMap({ ...state, parts: mapped }, source, prior)
  const oldRoutes = routeMap({ ...state, parts: prior }, source, prior)
  const moves = new Map<string, string>()
  const ambiguous = new Map<string, string>()
  for (const [from, paths] of destinations) {
    const file = await draft.file(from, true)
    if (paths.size === 1 && !owns(from) && (file.after === null || deleteEmpty(file))) moves.set(from, [...paths][0]!)
    else ambiguous.set(from, "")
  }
  const rebinds = [...rebound].sort().map(key => receipt(decisions.get(key)!))
  const companionReceipt = (d: Decision) => hash(JSON.stringify([receipt(d), rebinds]))!
  for (const entry of prior) {
    const key = entry.key
    if (rebound.has(key) || removed.has(key)) continue
    const file = await draft.file(entry.path, true)
    const material = source.get(key)
    const stamp = snapshots(file, entry, material)
    const updating = action === "upgrade" && selected.has(owner(key))
    let actual: string | null
    try { actual = current(entry, file.after) } catch (err) {
      issuesFor(key, entry.path, String(err), stamp)
      continue
    }
    const retained = state.parts.find(p => p.key === key)!
    const nextBase = updating && material ? material.body : entry.previous
    const nextPath = updating && material ? material.part.path : entry.sourcePath
    const rendered = routed(nextBase, nextPath, entry.path, routes)
    const previousRendered = routed(entry.previous, entry.sourcePath, entry.path, oldRoutes)
    const routeChange = rendered !== previousRendered && nextBase === entry.previous
    const update = nextBase !== entry.previous || nextPath !== entry.sourcePath
    const custom = entry.custom || actual !== entry.installed
    const ambiguousLinks = ambiguous.size > 0 && entry.mode === "block" && actual !== null && custom &&
      [actual, entry.installed!].some(body => routed(body, entry.path, entry.path, ambiguous) !== body)
    let affected = ambiguousLinks
    if (moves.size && entry.mode === "block" && actual !== null) {
      const installed = routed(entry.installed!, entry.path, entry.path, moves)
      const body = routed(actual, entry.path, entry.path, moves)
      const linksMoved = installed !== entry.installed || body !== actual
      if (linksMoved && !update && !ambiguousLinks && !decisions.has(key) &&
          routed(previousRendered, entry.path, entry.path, moves) === rendered) {
        if (body !== actual) replace(file, key, body)
        retained.installed = installed
        retained.custom = installed !== rendered
        continue
      }
      affected ||= custom && linksMoved
    }
    const replay = decisions.get(key)
    if (replay && !update && !routeChange && !affected && replay.incoming === stamp.incoming &&
        (selected.has(owner(key)) && entry.decision === receipt(replay) || rebinds.length && entry.decision === companionReceipt(replay)) &&
        (entry.mode === "reference" ? hash(actual) === entry.referenceHash : actual === entry.installed)) {
      consumed.add(key)
      continue
    }
    if (!updating && (!routeChange && !affected || entry.mode === "reference" && !decisions.has(key))) continue
    const d = check(key, entry.path, stamp, entry.mode === "reference" ? ["keep"] : ["merge", "keep"])
    if (actual === null || entry.mode === "reference" && !actual.trim()) {
      issuesFor(key, entry.path, "采用位置或受管边界缺失，请恢复后复核、用 reference 换源决策指向已核实的团队文档，或单独撤除该部件", stamp)
      continue
    }
    if (entry.mode === "reference") {
      if ((update || hash(actual) !== entry.referenceHash) && !d) {
        issuesFor(key, entry.path, "既有引用或正本已变化，核对等价性后选择 keep", stamp)
        continue
      }
      retained.referenceHash = hash(actual)
    } else {
      if (!d) {
        if (!update && !routeChange && !affected) {
          if (actual !== entry.installed) {
            issuesFor(key, entry.path, "包内正本同版，项目正文相对上次采用结果已有修改。选择 keep 记录当前正文，或用 merge 提交已核对的正文", stamp)
          }
          continue
        }
        if (custom) {
          const reason = ambiguousLinks ? "项目片段含自定义链接，无法判定是否随来源迁移。保留全文请选择 keep；指定现行与历史链接请选择 merge 并提供完整正文" :
            "项目片段含本地修改或例外，比较旧版、现状及新版后选择 merge 或 keep"
          issuesFor(key, entry.path, reason, stamp)
          continue
        }
      }
      const body = d?.mode === "merge" ? d.body! : d?.mode === "keep" ? actual : rendered
      if (body !== actual) {
        if (entry.mode === "block") replace(file, key, body)
        else file.after = body
      }
      retained.installed = body
      retained.custom = body !== rendered
    }
    retained.previous = nextBase
    retained.sourcePath = nextPath
    if (d) {
      retained.reason = d.reason
      retained.decision = !selected.has(owner(key)) && rebinds.length ? companionReceipt(d) : receipt(d)
    }
  }
  for (const entry of state.parts.filter(p => pending.has(p.key))) {
    const { key, path } = entry
    const material = source.get(key)!
    const file = await draft.file(path)
    const stamp = snapshots(file, undefined, material)
    const d = check(key, path, stamp, ["append", "reference"])
    if (!decisions.has(key) && action !== "init" && material.part.preferReference) {
      issuesFor(key, path, "先查阅项目实际使用的文档。已有来源时用 reference 指向原文；查明尚无来源时用 append 创建模板。", stamp)
      continue
    }
    if (file.before !== null && !d) {
      issuesFor(key, path, "目标已存在，请审阅后引用已有等价规则，或显式追加适配后的片段", stamp)
      continue
    }
    if (entry.mode === "reference") {
      const body = teamBody(file.before, path)
      if (!body?.trim()) { issuesFor(key, path, "引用须指向已有且包含项目正文的文件", stamp); continue }
      entry.referenceHash = hash(body)
    } else {
      if (entry.mode === "file" && file.after !== null && file.after !== "") {
        issuesFor(key, path, "已有结构化文件归项目维护，请核实配置后引用或选择独立路径", stamp)
        continue
      }
      if (entry.mode === "file" && state.parts.some(p => p.key !== key && p.mode !== "reference" && p.path === path)) {
        issuesFor(key, path, "结构化文件不能有多个正文维护方", stamp)
        continue
      }
      if (!hasBlocks(material.part.path) && hasBlocks(path) && !d?.body ||
          hasBlocks(material.part.path) && !hasBlocks(path) && !d?.body) {
        issuesFor(key, path, "格式不同，映射到新位置需提供适配后的 body", stamp)
        continue
      }
      const body = routed(material.body, material.part.path, path, routes)
      entry.installed = d?.body ?? body
      entry.custom = entry.installed !== body
      if (entry.mode === "block") entry.prefix = append(file, key, entry.installed)
      else file.after = entry.installed
      if (file.before === null && !state.created.includes(path)) state.created.push(path)
    }
    entry.reason = d?.reason ?? ""
    if (d) entry.decision = receipt(d)
  }
  for (const [key, d] of decisions) {
    if (consumed.has(key)) continue
    if (action === "remove" && selected.has(owner(key)) && state.disabled.includes(owner(key)) && !prior.some(e => e.key === key)) continue
    const entry = prior.find(p => p.key === key)
    const material = source.get(key)
    const path = d.path ?? entry?.path ?? material?.part.path
    if (!path) throw Error("决策指向未知片段：" + key)
    issuesFor(key, path, "决策不属于此次操作，请移除或重新选择动作及部件", snapshots(await draft.file(path), entry, material))
  }
  const root = await draft.file(rootDoc)
  const nav = navView(state, root.after)
  if (state.parts.length || state.navigation) {
    const stamp = { expected: hash(root.before), base: hash(nav.installed), incoming: state.parts.length ? hash(navText(state, catalog)) : null }
    if (nav.status !== "absent" && nav.status !== "current") {
      issuesFor("navigation", rootDoc, "导航边界或正文已更改，请保留团队内容并修复原有导航后再执行", stamp)
    } else if (!state.parts.length) {
      removeBlock(root, "navigation", state.navigation!.prefix, false)
      state.navigation = null
    } else {
      const body = navText(state, catalog)
      if (!state.navigation) {
        const prefix = append(root, "navigation", body)
        state.navigation = { installed: body, prefix }
        if (root.before === null && !state.created.includes(rootDoc)) state.created.push(rootDoc)
      } else if (state.navigation.installed !== body) {
        replace(root, "navigation", body)
        state.navigation.installed = body
      }
    }
  }
  for (const path of [...state.created]) {
    if (owns(path)) continue
    const file = await draft.file(path)
    if (deleteEmpty(file)) file.after = null
    state.created = state.created.filter(p => p !== path)
  }
  for (const entry of state.parts.filter(e => e.mode === "reference")) {
    const file = await draft.file(entry.path)
    const body = teamBody(file.after, entry.path)
    const stamp = snapshots(file, prior.find(p => p.key === entry.key), source.get(entry.key))
    if (!body?.trim()) issuesFor(entry.key, entry.path, "操作将使已采用的等价引用失效", stamp)
    else if (referenceConflict(entry, prior) && hash(body) !== entry.referenceHash) {
      issuesFor(entry.key, entry.path, "原有交叠引用与当前文件内容已有差异，请先撤除引用部件再核实项目来源", stamp)
    }
  }
  state.parts.sort((a,b) => order(a.key,b.key))
  state.created.sort()
  state.disabled.sort()
  if (!issues.length) {
    record.after = state.parts.length || state.disabled.length ? JSON.stringify(state, null, 2) + "\n" : null
    if (record.after !== null) parseState(record.after)
  }
  return { ...(issues.length ? { changes: [] as Change[], guards: [] as Change[] } : draft.result(absencesCoveredByRename)), ...summary(state, catalog), issues, missingSources: [...missingSources] }
}
