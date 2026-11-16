import { basename, dirname, extname, resolve } from "node:path"
import { parseDocument } from "yaml"
import { privatePath, record, sha256, type Status } from "./context.ts"
import { BootstrapError, Files, parts } from "./files.ts"

export type ContextNode = "start" | "plan" | "implement" | "verify" | "handoff"
export type ContextSource = { file: string; sha256: string }
export type ContextEntry = { file: string; section?: string; select?: string[]; aliases?: string[]; summary?: string; when?: ContextNode[]; sources?: ContextSource[]; sha256?: string }
export type ContextIndex = { schema_version: 1; entries: Record<string, ContextEntry> }
type Issue = { code: string; message: string; key?: string; file?: string }
type Route = ContextEntry & { id: string }
type Item = Route & { status: Status; stale: boolean; changed: boolean; content?: string; format?: string; issues: Issue[] }
export type ContextMetrics = { index_bytes: number; source_bytes_read: number; returned_bytes: number; files_read: number; duration_ms: number }
export type ContextReport = { schema_version: 1; command: string; scope: "indexed_context"; status: Status; metrics: ContextMetrics; index_sha256: string | null; entries: Route[] | Item[]; findings: Issue[]; omitted: number; uncovered: string[]; [key: string]: unknown }
type LoadedIndex = { index: ContextIndex; index_bytes: number; sha256: string | null; root: string; content: string | null }
type FileData = { raw: Uint8Array; sha256: string }
type Plan = { schema_version: 1; files: { path: string; expected_sha256: string | null; content: string }[] }
const indexPath = ".agents/context/index.json"
const indexLimit = 256 * 1024
const fileLimit = 512 * 1024
const totalLimit = 8 * 1024 * 1024
const defaultBudget = 16 * 1024
const maxItems = 32
const stages: ContextNode[] = ["start", "plan", "implement", "verify", "handoff"]
const reserved = new Set(["__proto__", "prototype", "constructor"])
const hex = (value: unknown): value is string => typeof value === "string" && /^[a-fA-F0-9]{64}$/.test(value)
const id = (value: unknown): value is string => typeof value === "string" && /^[a-z0-9._-]{1,128}$/.test(value) && !reserved.has(value)
const issue = (code: string, message: string, key?: string, file?: string): Issue => ({ code, message, ...(key ? { key } : {}), ...(file ? { file } : {}) })
const fail = (code: string, message: string, path?: string): never => { throw new BootstrapError(code, message, path) }
const decode = (raw: Uint8Array) => new TextDecoder("utf-8", { fatal: true }).decode(raw)
const own = (value: object, key: string) => Object.hasOwn(value, key)

function publicPath(value: unknown, allowIndex = false): string {
  if (typeof value !== "string") return fail("context_path", "Context paths must be project-relative POSIX paths.")
  parts(value)
  if (privatePath(value) || (!allowIndex && value.toLowerCase() === indexPath)) return fail("context_path", "Context cannot refer to private files or its own index.", value)
  return value
}

function boundedStrings(value: unknown, limit: number, length: number, name: string): string[] {
  if (!Array.isArray(value) || value.length > limit || value.some(item => typeof item !== "string" || !item.trim() || item.length > length) || new Set(value).size !== value.length) return fail("context_shape", `${name} must be a bounded list of unique nonempty strings.`)
  return value as string[]
}

function selectorParts(value: string[]) {
  if (!value.length || value.length > 32 || value.some(part => !part || part.length > 512 || reserved.has(part))) return fail("context_select", "Selection must be one bounded path of own-property segments without prototype keys.")
  return value
}

function entryShape(value: unknown): ContextEntry {
  if (!record(value) || Object.keys(value).some(key => !["file", "section", "select", "aliases", "summary", "when", "sources", "sha256"].includes(key))) return fail("context_shape", "Each context entry must use the documented fields.")
  const out: ContextEntry = { file: publicPath(value.file) }
  if (value.section !== undefined) {
    if (typeof value.section !== "string" || !value.section.trim() || value.section.length > 256) return fail("context_section", "A Markdown section must be a nonempty bounded heading or anchor.")
    if (extname(out.file).toLowerCase() !== ".md") return fail("context_section", "Sections are supported only for Markdown files.")
    out.section = value.section
  }
  if (value.select !== undefined) {
    if (value.section !== undefined || ![".json", ".yaml", ".yml"].includes(extname(out.file).toLowerCase())) return fail("context_select", "Selection applies to JSON or YAML and cannot be combined with a section.")
    if (!Array.isArray(value.select) || value.select.some(part => typeof part !== "string")) return fail("context_select", "Selection must be one path expressed as string segments.")
    out.select = selectorParts(value.select as string[])
  }
  if (value.aliases !== undefined) out.aliases = boundedStrings(value.aliases, 16, 128, "aliases")
  if (value.summary !== undefined) {
    if (typeof value.summary !== "string" || value.summary.length > 2048) return fail("context_shape", "Summary must be routing text of at most 2048 characters.")
    out.summary = value.summary
  }
  if (value.when !== undefined) {
    const when = boundedStrings(value.when, stages.length, 16, "when")
    if (when.some(node => !stages.includes(node as ContextNode))) return fail("context_node", "Context nodes must be start, plan, implement, verify or handoff.")
    out.when = when as ContextNode[]
  }
  if (value.sources !== undefined) {
    if (!Array.isArray(value.sources) || value.sources.length > 16) return fail("context_sources", "Sources must be a bounded list of files with explicit SHA-256 digests.")
    const seen = new Set<string>()
    out.sources = value.sources.map(source => {
      if (!record(source) || Object.keys(source).sort().join() !== "file,sha256" || !hex(source.sha256)) return fail("context_sources", "Each source requires a file and an explicit SHA-256 digest.")
      const file = publicPath(source.file)
      if (seen.has(file)) return fail("context_sources", "A source file can appear only once in an entry.", file)
      seen.add(file)
      return { file, sha256: source.sha256.toLowerCase() }
    })
  }
  if (value.sha256 !== undefined) {
    if (!hex(value.sha256)) return fail("context_shape", "Entry SHA-256 must be a digest.")
    out.sha256 = value.sha256.toLowerCase()
  }
  return out
}

function indexShape(value: unknown): ContextIndex {
  if (!record(value) || Object.keys(value).sort().join() !== "entries,schema_version" || value.schema_version !== 1 || !record(value.entries) || Object.keys(value.entries).length > 512) return fail("context_index", "Context index requires schema_version 1 and at most 512 entries.")
  const entries: Record<string, ContextEntry> = Object.create(null)
  for (const [key, valueEntry] of Object.entries(value.entries)) {
    if (!id(key)) return fail("context_id", "Context IDs must be lowercase ASCII letters, digits, dots, underscores or hyphens without prototype keys.")
    entries[key] = entryShape(valueEntry)
  }
  return { schema_version: 1, entries }
}

function json(text: string): unknown {
  const doc = parseDocument(text, { uniqueKeys: true })
  if (doc.errors.length) return fail("context_parse", "JSON must be valid and must not contain duplicate keys.")
  try { return JSON.parse(text) as unknown } catch { return fail("context_parse", "Context data must be valid JSON.") }
}

async function readIndex(fs: Files): Promise<LoadedIndex> {
  const data = await fs.read(indexPath, indexLimit)
  if (!data) return { index: { schema_version: 1, entries: Object.create(null) }, index_bytes: 0, sha256: null, root: fs.root, content: null }
  const content = decode(data.data)
  const index = indexShape(json(content))
  return { index, index_bytes: data.data.byteLength, sha256: sha256(data.data), root: fs.root, content }
}

export async function loadIndex(root: string): Promise<LoadedIndex> {
  const fs = await Files.at(root)
  try { return await readIndex(fs) } finally { await fs.close() }
}

class Reader {
  bytes = 0
  count = 0
  cache = new Map<string, Promise<FileData>>()
  constructor(public fs: Files) {}
  read(path: string): Promise<FileData> {
    const existing = this.cache.get(path)
    if (existing) return existing
    const pending = this.readFile(path)
    this.cache.set(path, pending)
    return pending
  }
  private async readFile(path: string): Promise<FileData> {
    publicPath(path)
    if (this.bytes >= totalLimit) return fail("context_read_limit", "Context source reads reached the total byte limit.", path)
    const data = await this.fs.read(path, Math.min(fileLimit, totalLimit - this.bytes))
    if (!data) return fail("context_missing", "Context source file is missing.", path)
    this.bytes += data.data.byteLength
    this.count++
    return { raw: data.data, sha256: sha256(data.data) }
  }
}

function report(command: string, loaded: LoadedIndex, reader: Reader, start: number, entries: Route[] | Item[], findings: Issue[], extra: Record<string, unknown> = {}): ContextReport {
  return { schema_version: 1, command, scope: "indexed_context", status: findings.some(item => ["unknown_key", "ambiguous_alias"].includes(item.code)) ? "failed" : findings.length ? "unverified" : "passed", index_sha256: loaded.sha256, metrics: { index_bytes: loaded.index_bytes, source_bytes_read: reader.bytes, returned_bytes: 0, files_read: reader.count, duration_ms: Math.max(0, Math.round(performance.now() - start)) }, entries, findings: findings.slice(0, maxItems), findings_omitted: Math.max(0, findings.length - maxItems), omitted: 0, uncovered: [], ...extra }
}

function aliases(index: ContextIndex) {
  const out = new Map<string, string[]>()
  for (const [key, entry] of Object.entries(index.entries)) for (const alias of entry.aliases ?? []) out.set(alias, [...(out.get(alias) ?? []), key])
  return out
}

function resolveKeys(index: ContextIndex, keys: string[]) {
  const mapping = aliases(index)
  const selected = new Set<string>()
  const findings: Issue[] = []
  const uncovered: string[] = []
  for (const key of keys) {
    if (own(index.entries, key)) selected.add(key)
    else {
      const matches = mapping.get(key) ?? []
      if (matches.length === 1) selected.add(matches[0]!)
      else {
        findings.push(issue(matches.length ? "ambiguous_alias" : "unknown_key", matches.length ? "Alias matches multiple context entries; choose an explicit ID." : "No context entry or exact alias covers this key.", key))
        uncovered.push(key)
      }
    }
  }
  return { selected, findings, uncovered }
}

function route(key: string, entry: ContextEntry): Route { return { id: key, ...entry } }

function inputKeys(value: string[]) {
  if (!Array.isArray(value) || value.length > 512 || value.some(key => typeof key !== "string" || !key || key.length > 128)) return fail("context_keys", "Use at most 512 nonempty context IDs or aliases.")
}

function budget(value: number | undefined) {
  if (value === undefined) return defaultBudget
  if (!Number.isSafeInteger(value) || value < 1 || value > 64 * 1024) return fail("context_budget", "Content byte budget must be an integer from 1 to 65536.")
  return value
}

function cap(value: number | undefined) {
  if (value === undefined) return maxItems
  if (!Number.isSafeInteger(value) || value < 1 || value > maxItems) return fail("context_limit", "Result limit must be an integer from 1 to 32.")
  return value
}

export async function searchContext(root: string, query: string, opts: { limit?: number } = {}): Promise<ContextReport> {
  if (typeof query !== "string" || query.length > 512) return fail("context_query", "Search query must be text of at most 512 characters.")
  const start = performance.now()
  const fs = await Files.at(root)
  try {
    const loaded = await readIndex(fs)
    const reader = new Reader(fs)
    const limit = cap(opts.limit)
    const normalized = query.trim().toLowerCase()
    const terms = normalized.split(/\s+/).filter(Boolean)
    const matches = Object.entries(loaded.index.entries).filter(([key, entry]) => terms.every(term => [key, ...(entry.aliases ?? []), entry.summary ?? ""].join("\n").toLowerCase().includes(term))).sort(([a, av], [b, bv]) => {
      const score = (key: string, entry: ContextEntry) => key === query ? 3 : entry.aliases?.includes(query) ? 2 : key.toLowerCase() === normalized ? 1 : 0
      return score(b, bv) - score(a, av) || a.localeCompare(b, "en")
    })
    const findings = matches.length ? [] : [issue("uncovered_query", "No indexed ID, alias or summary covers this search.")]
    return report("context search", loaded, reader, start, matches.slice(0, limit).map(([key, entry]) => route(key, entry)), findings, { query, matches: matches.length, omitted: Math.max(0, matches.length - limit), uncovered: matches.length ? [] : [query], index_present: loaded.sha256 !== null, body_read: false })
  } finally { await fs.close() }
}

function headingSlug(value: string) {
  return value.replace(/!?\[([^\]]+)\]\([^)]*\)/g, "$1").replace(/<[^>]+>/g, "").toLowerCase().replace(/[\p{P}\p{S}]/gu, char => "-_".includes(char) ? char : "").replace(/\s/g, "-")
}

function htmlBoundary(line: string, generic: boolean): RegExp | "blank" | undefined {
  const raw = line.match(/^ {0,3}<(script|pre|style|textarea)(?:[ \t>]|$)/i)
  if (raw) return new RegExp(`</${raw[1]}[ \\t]*>`, "i")
  if (/^ {0,3}<\?/.test(line)) return /\?>/
  if (/^ {0,3}<!\[CDATA\[/.test(line)) return /\]\]>/
  if (/^ {0,3}<![A-Z]/.test(line)) return />/
  if (/^ {0,3}<\/?(?:address|article|aside|base|basefont|blockquote|body|caption|center|col|colgroup|dd|details|dialog|dir|div|dl|dt|fieldset|figcaption|figure|footer|form|frame|frameset|h[1-6]|head|header|hr|html|iframe|legend|li|link|main|menu|menuitem|nav|noframes|ol|optgroup|option|p|param|search|section|summary|table|tbody|td|tfoot|th|thead|title|tr|track|ul)(?:[ \t/>]|$)/i.test(line)) return "blank"
  if (generic && /^ {0,3}(?:<[a-z][a-z0-9-]*(?:[ \t]+[a-z_:][a-z0-9_.:-]*(?:[ \t]*=[ \t]*(?:[^"'=<>`\s]+|'[^']*'|"[^"]*"))?)*[ \t]*\/?>|<\/[a-z][a-z0-9-]*[ \t]*>)[ \t]*$/i.test(line)) return "blank"
}

function markdownSection(text: string, selected: string) {
  const lines = text.split(/(?<=\n)/)
  const headers: { title: string; slug: string; level: number; start: number }[] = []
  const seen = new Map<string, number>()
  let fence = ""
  let size = 0
  let html: RegExp | "blank" | undefined
  let comment = false
  let offset = 0
  let previous: { line: string; start: number } | undefined
  for (const raw of lines) {
    let line = raw.replace(/\r?\n$/, "")
    const marker = line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/)
    if (fence) {
      if (new RegExp(`^ {0,3}${fence}{${size},}\\s*$`).test(line)) { fence = ""; size = 0 }
      previous = undefined
    } else if (html) {
      if (html === "blank" ? !line.trim() : html.test(line)) html = undefined
      previous = undefined
    } else {
      const boundary = comment ? undefined : htmlBoundary(line, !previous?.line.trim())
      if (boundary) {
        if (boundary === "blank" || !boundary.test(line)) html = boundary
        previous = undefined
      } else if (!comment && marker && !(marker[1]![0] === "`" && marker[2]!.includes("`"))) {
        fence = marker[1]![0]!
        size = marker[1]!.length
        previous = undefined
      } else {
        const commentBlock = comment || /^ {0,3}<!--/.test(line)
        let cursor = 0
        let visible = ""
        while (cursor < line.length) {
          const start = comment ? cursor : line.indexOf("<!--", cursor)
          if (start < 0) { visible += line.slice(cursor); break }
          visible += line.slice(cursor, start)
          const end = line.indexOf("-->", start + (comment ? 0 : 4))
          const until = end < 0 ? line.length : end + 3
          visible += " ".repeat(until - start)
          comment = end < 0
          cursor = until
        }
        line = visible
        if (commentBlock) previous = undefined
        else {
          const atx = line.match(/^ {0,3}(#{1,6})(?:[ \t]+(.*)|[ \t]*)$/)
          const setext = line.match(/^ {0,3}(=+|-+)[ \t]*$/)
          let title: string | undefined
          let level = 0
          let start = offset
          if (atx) { title = (atx[2] ?? "").replace(/[ \t]+#+[ \t]*$/, "").trim(); level = atx[1]!.length }
          else if (setext && previous && previous.line.trim() && !/^(?: {4}|\t| {0,3}(?:>|[-*+]\s|\d+[.)]\s|#{1,6}(?:\s|$)))/.test(previous.line)) { title = previous.line.trim(); level = setext[1]![0] === "=" ? 1 : 2; start = previous.start }
          if (title !== undefined) {
            const slug = headingSlug(title)
            const count = seen.get(slug) ?? 0
            seen.set(slug, count + 1)
            headers.push({ title, slug: count ? `${slug}-${count}` : slug, level, start })
            previous = undefined
          } else previous = { line, start: offset }
        }
      }
    }
    offset += raw.length
  }
  const titleMatches = selected.startsWith("#") ? [] : headers.filter(header => header.title === selected)
  const matches = titleMatches.length ? titleMatches : headers.filter(header => header.slug === selected.replace(/^#/, ""))
  if (matches.length !== 1) return fail(matches.length ? "ambiguous_section" : "missing_section", matches.length ? "Markdown heading is ambiguous; choose its numbered anchor." : "Markdown section does not exist.")
  const chosen = matches[0]!
  const next = headers.find(header => header.start > chosen.start && header.level <= chosen.level)
  return text.slice(chosen.start, next?.start ?? text.length)
}

function safeTree(value: unknown) {
  let nodes = 0
  const stack = new Set<object>()
  const visit = (node: unknown, depth: number) => {
    if (++nodes > 100000 || depth > 64) return fail("context_select", "Selected data exceeds structural limits.")
    if (!node || typeof node !== "object") return
    if (stack.has(node)) return fail("context_select", "Circular YAML data cannot be selected.")
    if (!Array.isArray(node) && (!record(node) || ![Object.prototype, null].includes(Object.getPrototypeOf(node)))) return fail("context_select", "Selected data must contain plain mappings and arrays.")
    stack.add(node)
    for (const [key, child] of Object.entries(node)) {
      if (reserved.has(key)) return fail("context_select", "Prototype keys cannot be selected.")
      visit(child, depth + 1)
    }
    stack.delete(node)
  }
  visit(value, 0)
}

function selection(text: string, file: string, paths: string[]) {
  let data: unknown
  if (extname(file).toLowerCase() === ".json") data = json(text)
  else {
    const doc = parseDocument(text, { uniqueKeys: true })
    if (doc.errors.length) return fail("context_select", "YAML selection requires valid mappings with unique keys.")
    try { data = doc.toJS({ maxAliasCount: 100 }) as unknown } catch { return fail("context_select", "YAML aliases exceed selection limits.") }
  }
  safeTree(data)
  let current = data
  for (const segment of selectorParts(paths)) {
    if (!current || typeof current !== "object" || !own(current, segment) || (Array.isArray(current) && !/^(?:0|[1-9]\d*)$/.test(segment))) return fail("missing_selection", "The selected own-property path does not exist.")
    current = (current as Record<string, unknown>)[segment]
  }
  return JSON.stringify(current, null, 2) + "\n"
}

async function assess(key: string, entry: ContextEntry, reader: Reader, includeContent: boolean): Promise<Item> {
  const issues: Issue[] = []
  let stale = false
  let changed = false
  for (const source of entry.sources ?? []) {
    try {
      if ((await reader.read(source.file)).sha256 !== source.sha256) {
        stale = true
        issues.push(issue("stale_source", "Source content changed; review the derived knowledge against its current sources before updating the recorded digest.", key, source.file))
      }
    } catch {
      stale = true
      issues.push(issue("missing_source", "Source is unavailable or exceeds safe read limits; derived knowledge is not covered.", key, source.file))
    }
  }
  let file: FileData | undefined
  if (!stale || !includeContent) {
    try {
      file = await reader.read(entry.file)
      changed = entry.sha256 !== undefined && file.sha256 !== entry.sha256
      if (changed) issues.push(issue("changed_reference", "Entry file changed since indexing; current content requires agent review and an explicit index update.", key, entry.file))
    } catch { issues.push(issue("unavailable_reference", "Entry file is unavailable or exceeds safe read limits.", key, entry.file)) }
  }
  const item: Item = { ...route(key, entry), status: issues.length ? "unverified" : "passed", stale, changed, issues }
  if (file && (!includeContent || !stale) && (includeContent || entry.section || entry.select)) {
    try {
      const text = decode(file.raw)
      const selected = entry.section ? markdownSection(text, entry.section) : entry.select ? selection(text, entry.file, entry.select) : text
      if (includeContent) {
        item.content = selected
        item.format = entry.select ? "json" : extname(entry.file).slice(1) || "text"
      }
    } catch (err) {
      issues.push(issue(err instanceof BootstrapError ? err.code : "unreadable_text", err instanceof BootstrapError ? err.message : "Entry could not be decoded as bounded UTF-8 text.", key, entry.file))
      item.status = "unverified"
    }
  }
  return item
}

function reverse(index: ContextIndex) {
  const map = new Map<string, Set<string>>()
  for (const [key, entry] of Object.entries(index.entries)) for (const file of [entry.file, ...(entry.sources ?? []).map(source => source.file)]) {
    const keys = map.get(file) ?? new Set<string>()
    keys.add(key)
    map.set(file, keys)
  }
  return map
}

async function changedKeys(index: ContextIndex, changed: string[], fs: Files) {
  if (!Array.isArray(changed) || changed.length > 512) return fail("context_changed", "Use at most 512 explicit changed paths.")
  const dependencies = reverse(index)
  const keys = new Set<string>()
  const uncovered: string[] = []
  const identities = new Map<string, Promise<string | null | undefined>>()
  const identity = (file: string) => {
    let value = identities.get(file)
    if (!value) {
      value = fs.identity(file).catch(() => undefined)
      identities.set(file, value)
    }
    return value
  }
  const folded = (file: string) => file.normalize("NFD").toLowerCase()
  const foldedPaths = new Map<string, string[]>()
  for (const path of dependencies.keys()) foldedPaths.set(folded(path), [...(foldedPaths.get(folded(path)) ?? []), path])
  const identityKeys = new Map<string, Set<string>>()
  let indexedIdentities = false
  const indexIdentities = async () => {
    if (indexedIdentities) return
    for (const [path, dependent] of dependencies) {
      const indexed = await identity(path)
      if (typeof indexed !== "string") continue
      const matches = identityKeys.get(indexed) ?? new Set<string>()
      for (const key of dependent) matches.add(key)
      identityKeys.set(indexed, matches)
    }
    indexedIdentities = true
  }
  for (const value of new Set(changed)) {
    const file = publicPath(value, true)
    const matches = new Set(dependencies.get(file) ?? [])
    const current = await identity(file)
    if (typeof current === "string") {
      await indexIdentities()
      for (const key of identityKeys.get(current) ?? []) matches.add(key)
    } else if (current === null) {
      for (const path of foldedPaths.get(folded(file)) ?? []) if (await identity(path) === null) for (const key of dependencies.get(path) ?? []) matches.add(key)
    }
    if (!matches.size) uncovered.push(file)
    else for (const key of matches) keys.add(key)
  }
  return { keys, uncovered }
}

async function retrieve(command: string, loaded: LoadedIndex, reader: Reader, start: number, keys: string[], maxBytes: number, extra: Record<string, unknown> = {}, reserved: { bytes: number; items: number } = { bytes: 0, items: 0 }): Promise<ContextReport> {
  const selected = resolveKeys(loaded.index, keys)
  const entries: Item[] = []
  const capacity = maxItems - reserved.items
  let returned = reserved.bytes
  let omitted = Math.max(0, selected.selected.size - capacity)
  const uncovered = [...selected.uncovered]
  const findings = [...selected.findings]
  if (!selected.selected.size && !findings.length) findings.push(issue("uncovered_context", "No indexed context route covers this request."))
  for (const key of [...selected.selected].slice(0, capacity)) {
    const item = await assess(key, loaded.index.entries[key]!, reader, true)
    if (item.content !== undefined) {
      const bytes = Buffer.byteLength(item.content)
      if (returned + bytes > maxBytes) {
        delete item.content
        item.status = "unverified"
        item.issues.push(issue("content_budget", "The complete entry exceeds the remaining byte budget and was omitted; narrow its section or selection, or raise the budget.", key, item.file))
        omitted++
      } else returned += bytes
    }
    if (item.content === undefined) uncovered.push(key)
    findings.push(...item.issues)
    entries.push(item)
  }
  for (const key of [...selected.selected].slice(capacity)) uncovered.push(key)
  if (selected.selected.size > capacity) findings.push(issue("item_limit", "The context item limit was reached; request omitted keys separately."))
  const result = report(command, loaded, reader, start, entries, findings, { content_budget_bytes: maxBytes, omitted, uncovered: uncovered.slice(0, maxItems), uncovered_count: uncovered.length, index_present: loaded.sha256 !== null, review_required: entries.some(item => item.stale || item.changed), ...extra })
  result.metrics.returned_bytes = returned
  return result
}

export async function getContext(root: string, keys: string[], opts: { maxBytes?: number } = {}): Promise<ContextReport> {
  inputKeys(keys)
  const start = performance.now()
  const fs = await Files.at(root)
  try {
    const loaded = await readIndex(fs)
    return await retrieve("context get", loaded, new Reader(fs), start, keys, budget(opts.maxBytes))
  } finally { await fs.close() }
}

export async function checkContext(root: string, opts: { changed?: string[]; keys?: string[] } = {}): Promise<ContextReport> {
  const start = performance.now()
  const fs = await Files.at(root)
  try {
    const loaded = await readIndex(fs)
    const reader = new Reader(fs)
    const resolution = opts.changed !== undefined ? await changedKeys(loaded.index, opts.changed, fs) : undefined
    if (opts.keys !== undefined) inputKeys(opts.keys)
    const selected = resolveKeys(loaded.index, resolution ? [...resolution.keys, ...(opts.keys ?? [])] : opts.keys ?? Object.keys(loaded.index.entries))
    const findings = [...selected.findings]
    const uncovered = [...selected.uncovered, ...(resolution?.uncovered ?? [])]
    for (const path of resolution?.uncovered ?? []) findings.push(issue("uncovered_change", "Changed file has no indexed dependent route.", undefined, path))
    const entries: Item[] = []
    const stale: string[] = []
    const changed: string[] = []
    let affectedCount = 0
    for (const key of selected.selected) {
      const item = await assess(key, loaded.index.entries[key]!, reader, false)
      affectedCount++
      if (item.stale) stale.push(key)
      if (item.changed) changed.push(key)
      if (entries.length < maxItems) entries.push(item)
      findings.push(...item.issues)
    }
    if (!selected.selected.size && !findings.length) findings.push(issue("uncovered_context", "No indexed context route covers this check."))
    return report("context check", loaded, reader, start, entries, findings, { affected: [...selected.selected].slice(0, maxItems), affected_count: affectedCount, stale: stale.slice(0, maxItems), stale_count: stale.length, changed: changed.slice(0, maxItems), changed_count: changed.length, omitted: Math.max(0, affectedCount - maxItems), uncovered: uncovered.slice(0, maxItems), uncovered_count: uncovered.length, review_required: stale.length > 0 || changed.length > 0, index_present: loaded.sha256 !== null })
  } finally { await fs.close() }
}

export async function nodeContext(root: string, node: ContextNode | string, opts: { keys?: string[]; changed?: string[]; task?: string; maxBytes?: number } = {}): Promise<ContextReport> {
  if (!stages.includes(node as ContextNode)) return fail("context_node", "Context nodes must be start, plan, implement, verify or handoff.")
  const start = performance.now()
  const fs = await Files.at(root)
  try {
    const loaded = await readIndex(fs)
    if (opts.keys !== undefined) inputKeys(opts.keys)
    const automatic = Object.entries(loaded.index.entries).filter(([, entry]) => entry.when?.includes(node as ContextNode)).map(([key]) => key)
    const changed = await changedKeys(loaded.index, opts.changed ?? [], fs)
    const keys = [...new Set([...(opts.keys ?? []), ...changed.keys, ...automatic])]
    const reader = new Reader(fs)
    const maxBytes = budget(opts.maxBytes)
    const taskFindings: Issue[] = []
    let task: { file: string; sha256?: string; status: Status; content?: string } | undefined
    let taskBytes = 0
    let taskUncovered = false
    if (opts.task !== undefined) {
      const file = publicPath(opts.task)
      try {
        const current = await reader.read(file)
        const content = decode(current.raw)
        const bytes = Buffer.byteLength(content)
        task = { file, sha256: current.sha256, status: "passed" }
        if (bytes > maxBytes) {
          taskFindings.push(issue("task_omitted", "The complete current task exceeds the byte budget and was omitted; raise the budget or narrow the task record.", undefined, file))
          task.status = "unverified"
          taskUncovered = true
        } else {
          task.content = content
          taskBytes = bytes
        }
      } catch {
        taskFindings.push(issue("unavailable_task", "Current task must be a readable bounded public file inside this project.", undefined, file))
        task = { file, status: "unverified" }
        taskUncovered = true
      }
    }
    const result = await retrieve("context node", loaded, reader, start, keys, maxBytes, { node, automatic_keys: automatic.slice(0, maxItems), automatic_count: automatic.length, affected: [...changed.keys].slice(0, maxItems), affected_count: changed.keys.size }, { bytes: taskBytes, items: task ? 1 : 0 })
    if (task) result.task = task
    if (taskUncovered && task) {
      result.omitted++
      result.uncovered.unshift(task.file)
    }
    result.findings.unshift(...taskFindings)
    const coveredTaskChanges: string[] = []
    const uncoveredChanges: string[] = []
    const taskIdentity = task?.status === "passed" ? await fs.identity(task.file) : null
    for (const path of changed.uncovered) {
      let same = task?.status === "passed" && path === task.file
      if (!same && taskIdentity) {
        try { same = await fs.identity(path) === taskIdentity } catch {}
      }
      if (same) coveredTaskChanges.push(path)
      else uncoveredChanges.push(path)
    }
    result.covered_task_changes = coveredTaskChanges.slice(0, maxItems)
    for (const path of uncoveredChanges.slice(0, maxItems)) {
      result.findings.push(issue("uncovered_change", "Changed file has no indexed dependent route.", undefined, path))
      result.uncovered.push(path)
    }
    result.uncovered_count = Number(result.uncovered_count ?? result.uncovered.length) + uncoveredChanges.length + (taskUncovered ? 1 : 0)
    result.uncovered = result.uncovered.slice(0, maxItems)
    result.status = result.findings.some(item => ["unknown_key", "ambiguous_alias"].includes(item.code)) ? "failed" : result.findings.length || Number(result.findings_omitted) > 0 ? "unverified" : "passed"
    result.findings_omitted = Number(result.findings_omitted ?? 0) + Math.max(0, result.findings.length - maxItems)
    result.findings = result.findings.slice(0, maxItems)
    result.metrics.duration_ms = Math.max(0, Math.round(performance.now() - start))
    return result
  } finally { await fs.close() }
}

export async function prepareIndexUpdate(root: string, planPath: string): Promise<{ plan: Plan; report: ContextReport }> {
  const start = performance.now()
  const fs = await Files.at(root)
  try {
    const loaded = await readIndex(fs)
    const reader = new Reader(fs)
    const inputPath = resolve(planPath)
    const planFiles = await Files.at(dirname(inputPath))
    let raw
    try { raw = await planFiles.read(basename(inputPath), indexLimit) } finally { await planFiles.close() }
    if (!raw) return fail("context_update_plan", "Context update plan does not exist.", inputPath)
    const data = json(decode(raw.data))
    if (!record(data) || data.schema_version !== 1 || !own(data, "expected_sha256") || (data.expected_sha256 !== null && !hex(data.expected_sha256)) || !record(data.upsert) || Object.keys(data).some(key => !["schema_version", "expected_sha256", "upsert", "remove"].includes(key)) || Object.keys(data.upsert).length > 512) return fail("context_update_plan", "Update plan requires schema_version 1, expected_sha256, upsert and optional remove.")
    const expected = data.expected_sha256 === null ? null : (data.expected_sha256 as string).toLowerCase()
    const removes = data.remove === undefined ? [] : boundedStrings(data.remove, 512, 128, "remove")
    const entries: Record<string, ContextEntry> = Object.assign(Object.create(null), loaded.index.entries)
    for (const key of removes) {
      if (!id(key) || own(data.upsert, key)) return fail("context_update_plan", "Removal IDs must be valid and cannot also be upserted.")
      delete entries[key]
    }
    for (const [key, value] of Object.entries(data.upsert)) {
      if (!id(key)) return fail("context_id", "Upsert keys must be valid context IDs.")
      const entry = entryShape(value)
      for (const source of entry.sources ?? []) {
        if ((await reader.read(source.file)).sha256 !== source.sha256) return fail("context_stale_source", "Source digest differs from current content; review and explicitly supply its correct digest before updating.", source.file)
      }
      const file = await reader.read(entry.file)
      if (entry.section) markdownSection(decode(file.raw), entry.section)
      if (entry.select) selection(decode(file.raw), entry.file, entry.select)
      entries[key] = { ...entry, sha256: file.sha256 }
    }
    if (Object.keys(entries).length > 512) return fail("context_index", "Final index exceeds 512 entries.")
    const ordered: Record<string, ContextEntry> = Object.create(null)
    for (const key of Object.keys(entries).sort()) ordered[key] = entries[key]!
    const current: Record<string, ContextEntry> = Object.create(null)
    for (const key of Object.keys(loaded.index.entries).sort()) current[key] = loaded.index.entries[key]!
    const content = JSON.stringify(current) === JSON.stringify(ordered) && loaded.content !== null ? loaded.content : JSON.stringify({ schema_version: 1, entries: ordered }, null, 2) + "\n"
    if (Buffer.byteLength(content) > indexLimit) return fail("context_index", "Final index exceeds 256 KiB.")
    const changed = sha256(content) !== loaded.sha256
    const output = report("context update", loaded, reader, start, Object.keys(data.upsert).slice(0, maxItems).map(key => route(key, ordered[key]!)), [], { changed, upserted: Object.keys(data.upsert).length, removed: removes.length, omitted: Math.max(0, Object.keys(data.upsert).length - maxItems), expected_sha256: expected, result_sha256: sha256(content), result_bytes: Buffer.byteLength(content), writes_performed: 0, plan_path: inputPath })
    return { plan: { schema_version: 1, files: [{ path: indexPath, expected_sha256: expected, content }] }, report: output }
  } finally { await fs.close() }
}
