import { realpath, stat } from "node:fs/promises"
import { resolve, join } from "node:path"
import { randomUUID } from "node:crypto"
import { parseDocument } from "yaml"
import { Files, BootstrapError, hash, limit, parts } from "./files"
import { assessContext, privatePath, readBounded, record } from "./context"
import { inspectProject, verifyProject } from "./checks"

type Output = Record<string, unknown> & { status: string }
type Operation = { path: string; expected: string | null; content: Buffer; sha256: string }
type Entry = { path: string; before: string | null; before_sha256: string | null; before_mode: number | null; after_sha256: string; after_mode: number; state: "pending" | "written" | "restored" | "skipped" }
type Receipt = { schema_version: 1; kind: "kane-agent-bootstrap-receipt"; root: string; state: string; files: Entry[] }
type Options = { dryRun?: boolean; receipt?: string; context?: string; beforeWrite?: (path: string, index: number) => Promise<void> }
const assets = resolve(import.meta.dir, "../assets")
const maxPlan = 16 * 1024 * 1024
const maxReceipt = 32 * 1024 * 1024
const hex = (val: unknown): val is string => typeof val === "string" && /^[a-f0-9]{64}$/i.test(val)
const pathKey = (path: string) => path.normalize("NFD").toLowerCase()
const decode = (data: Buffer) => new TextDecoder("utf-8", { fatal: true }).decode(data)
const errorDetail = (err: unknown) => err instanceof BootstrapError ? err.detail() : { code: "operation_failed", message: "Operation failed; inspect the current files before retrying." }

async function json(path: string, max = maxPlan) {
  const data = await readBounded(path, max)
  const doc = parseDocument(data.text, { uniqueKeys: true })
  if (doc.errors.length) throw new BootstrapError("invalid_json", "Input must be bounded UTF-8 JSON with unique keys.")
  try { return JSON.parse(data.text) as unknown } catch { throw new BootstrapError("invalid_json", "Input must be valid JSON.") }
}

function writable(path: unknown) {
  const name = parts(path).join("/")
  if (privatePath(name.toLowerCase()) || [".agents", ".agents/state"].includes(name.toLowerCase())) throw new BootstrapError("private_or_reserved_path", "Private files and bootstrap state cannot be planned targets.", name)
  return name
}

function receiptPath(path: string) {
  const name = parts(path).join("/")
  if (privatePath(name.toLowerCase()) && !name.toLowerCase().startsWith(".agents/state/bootstrap/")) throw new BootstrapError("invalid_receipt_path", "Receipt path must be owned project-local state.", name)
  return name
}

async function asset(id: unknown) {
  const name = parts(id).join("/")
  const catalog = await json(join(assets, "catalog.json"))
  if (!record(catalog) || !Array.isArray(catalog.files)) throw new BootstrapError("invalid_catalog", "Asset catalog is invalid.")
  const entry = catalog.files.find(item => record(item) && item.asset === name)
  if (!record(entry)) throw new BootstrapError("unknown_asset", "Use an asset registered in the package catalog.", name)
  if (entry.needs_adaptation !== false) throw new BootstrapError("asset_requires_adaptation", "Adapt this material and supply final content.", name)
  const storage = typeof entry.file === "string" ? parts(entry.file).join("/") : name
  const fs = await Files.at(assets)
  try {
    const value = await fs.read(storage)
    if (!value || hash(value.data) !== entry.sha256) throw new BootstrapError("asset_mismatch", "Packaged asset differs from its catalog.", name)
    decode(value.data)
    return value.data
  } finally { await fs.close() }
}

async function plan(path: string): Promise<Operation[]> {
  const data = await json(resolve(path))
  if (!record(data) || data.schema_version !== 1 || Object.keys(data).sort().join() !== "files,schema_version" || !Array.isArray(data.files) || data.files.length > 128) throw new BootstrapError("invalid_plan", "Use schema_version 1 and at most 128 file operations.")
  const out: Operation[] = []
  const seen = new Set<string>()
  for (const item of data.files) {
    if (!record(item) || !("expected_sha256" in item) || ("content" in item) === ("asset" in item) || Object.keys(item).some(key => !["path", "expected_sha256", "content", "asset"].includes(key))) throw new BootstrapError("invalid_plan", "Each file needs path, expected_sha256 and exactly one of content or asset.")
    const path = writable(item.path)
    if (seen.has(pathKey(path))) throw new BootstrapError("duplicate_path", "Case-folded or normalized target aliases are refused.", path)
    seen.add(pathKey(path))
    if (item.expected_sha256 !== null && !hex(item.expected_sha256)) throw new BootstrapError("invalid_plan", "Expected content must be null or a SHA-256 digest.", path)
    if ("content" in item && typeof item.content !== "string") throw new BootstrapError("invalid_plan", "Generated content must be UTF-8 text.", path)
    const content = "asset" in item ? await asset(item.asset) : Buffer.from(item.content as string, "utf8")
    if (content.length > limit) throw new BootstrapError("file_too_large", "Generated file exceeds the 4 MiB limit.", path)
    out.push({ path, expected: item.expected_sha256 === null ? null : item.expected_sha256.toLowerCase(), content, sha256: hash(content) })
  }
  for (const name of seen) for (let i = 1; i < parts(name).length; i++) if (seen.has(parts(name).slice(0, i).join("/"))) throw new BootstrapError("overlapping_paths", "A file is also a planned parent directory.", name)
  return out
}

function classify(op: Operation, data: Buffer | undefined) {
  if (data?.equals(op.content)) return "unchanged"
  if (!data) return op.expected === null ? "would_create" : "conflict"
  return op.expected !== null && hash(data) === op.expected ? "would_update" : "conflict"
}

function output(command: string, files: Record<string, unknown>[] = []): Output {
  return { schema_version: 1, command, scope: "project_files", status: "passed", files, partial: false }
}

async function store(fs: Files, path: string, data: Receipt, expected: string | null) {
  const content = Buffer.from(JSON.stringify(data, null, 2) + "\n")
  if (content.length > maxReceipt) throw new BootstrapError("receipt_too_large", "Recovery snapshot exceeds the 32 MiB limit.")
  await fs.write(path, content, expected, 0o600)
  return hash(content)
}

export async function applyPlan(root: string, planPath: string, opts: Options = {}): Promise<Output> {
  const operations = await plan(planPath)
  const report = output("apply")
  report.dry_run = opts.dryRun === true
  if (opts.context) {
    const context = await assessContext(root, opts.context)
    report.context = context
    if (context.status === "failed" || context.blocked_stages.includes("apply")) return { ...report, status: "failed", error: { code: "context_blocked", message: "Resolve invalid, stale, conflicting or missing application evidence first." } }
  }
  const fs = await Files.at(root)
  try {
    const entries: Entry[] = []
    const results: Record<string, unknown>[] = []
    for (const op of operations) {
      const current = await fs.read(op.path)
      if (current) decode(current.data)
      const status = classify(op, current?.data)
      results.push({ path: op.path, status, sha256: op.sha256 })
      if (status !== "unchanged") entries.push({ path: op.path, before: current?.data.toString("base64") ?? null, before_sha256: current ? hash(current.data) : null, before_mode: current?.mode ?? null, after_sha256: op.sha256, after_mode: current?.mode ?? 0o644, state: "pending" })
    }
    report.files = results
    if (results.some(item => item.status === "conflict")) return { ...report, status: "failed", error: { code: "precondition_failed", message: "A target differs from the expected content; no files were written." } }
    const location = receiptPath(opts.receipt ?? ".agents/state/bootstrap/" + randomUUID() + ".json")
    for (const op of operations) if (pathKey(location) === pathKey(op.path) || pathKey(location).startsWith(pathKey(op.path) + "/") || pathKey(op.path).startsWith(pathKey(location) + "/")) throw new BootstrapError("receipt_overlap", "Receipt and planned target paths overlap.", op.path)
    if (entries.length && opts.receipt && await fs.read(location, maxReceipt)) throw new BootstrapError("receipt_exists", "Choose a new receipt path; existing recovery records are never overwritten.", location)
    if (opts.dryRun || !entries.length) return report
    const receipt: Receipt = { schema_version: 1, kind: "kane-agent-bootstrap-receipt", root: fs.root, state: "applying", files: entries }
    let saved = await store(fs, location, receipt, null)
    report.receipt = location
    const completed: string[] = []
    for (let i = 0; i < operations.length; i++) {
      const op = operations[i]!
      const result = results[i]!
      const entry = entries.find(item => item.path === op.path)
      if (!entry) continue
      try {
        await opts.beforeWrite?.(op.path, i)
        const current = await fs.read(op.path)
        const action = classify(op, current?.data)
        if (action === "conflict") throw new BootstrapError("concurrent_change", "Target changed after preflight.", op.path)
        if (action !== "unchanged" && (current?.mode ?? null) !== entry.before_mode) throw new BootstrapError("concurrent_change", "Target permissions changed after preflight.", op.path)
        if (action === "unchanged") {
          result.status = "unchanged"
          entry.state = "skipped"
        } else {
          await fs.write(op.path, op.content, current ? hash(current.data) : null, current?.mode ?? 0o644)
          entry.state = "written"
          result.status = action === "would_create" ? "created" : "updated"
          completed.push(op.path)
        }
        saved = await store(fs, location, receipt, saved)
      } catch (err) {
        result.status = "failed"
        receipt.state = "partial"
        try { saved = await store(fs, location, receipt, saved) } catch {}
        return { ...report, status: "failed", partial: true, completed, error: errorDetail(err), recovery: "Read current files and the receipt. Recover only recorded writes whose current content still matches; unresolved pending writes require inspection." }
      }
    }
    receipt.state = "applied"
    try { await store(fs, location, receipt, saved) } catch (err) { return { ...report, status: "failed", partial: true, completed, error: errorDetail(err), recovery: "Read the receipt and verify completed files before continuing." } }
    return { ...report, completed }
  } finally { await fs.close() }
}

function parseReceipt(text: string, root: string): Receipt {
  const doc = parseDocument(text, { uniqueKeys: true })
  if (doc.errors.length) throw new BootstrapError("invalid_receipt", "Receipt cannot be safely parsed.")
  const data: unknown = JSON.parse(text)
  if (!record(data) || data.schema_version !== 1 || data.kind !== "kane-agent-bootstrap-receipt" || data.root !== root || !Array.isArray(data.files) || data.files.length > 128 || !["applying", "partial", "applied", "recovering", "recovered"].includes(String(data.state))) throw new BootstrapError("invalid_receipt", "Receipt is invalid or belongs to another project.")
  const seen = new Set<string>()
  for (const entry of data.files) {
    if (!record(entry)) throw new BootstrapError("invalid_receipt", "Receipt file entry is invalid.")
    const path = writable(entry.path)
    if (seen.has(pathKey(path)) || !hex(entry.after_sha256) || !Number.isInteger(entry.after_mode) || Number(entry.after_mode) < 0 || Number(entry.after_mode) > 0o777 || !["pending", "written", "restored", "skipped"].includes(String(entry.state))) throw new BootstrapError("invalid_receipt", "Receipt entries must be unique and complete.")
    seen.add(pathKey(path))
    if (entry.before === null) {
      if (entry.before_sha256 !== null || entry.before_mode !== null) throw new BootstrapError("invalid_receipt", "New-file snapshot is inconsistent.")
    } else {
      if (typeof entry.before !== "string" || !hex(entry.before_sha256) || !Number.isInteger(entry.before_mode) || Number(entry.before_mode) < 0 || Number(entry.before_mode) > 0o777) throw new BootstrapError("invalid_receipt", "Existing-file snapshot is invalid.")
      const raw = Buffer.from(entry.before, "base64")
      if (raw.toString("base64") !== entry.before || raw.length > limit || hash(raw) !== entry.before_sha256.toLowerCase()) throw new BootstrapError("invalid_receipt", "Snapshot does not match its content digest.")
      decode(raw)
    }
  }
  return data as Receipt
}

export async function recover(root: string, location: string, opts: { dryRun?: boolean } = {}): Promise<Output> {
  const path = receiptPath(location)
  const fs = await Files.at(root)
  try {
    const value = await fs.read(path, maxReceipt)
    if (!value || (value.mode & 0o077) !== 0) throw new BootstrapError("invalid_receipt", "Receipt must be an existing private file (mode 0600).")
    const receipt = parseReceipt(decode(value.data), fs.root)
    let saved = hash(value.data)
    const results: Record<string, unknown>[] = []
    for (const entry of receipt.files) {
      if (pathKey(path) === pathKey(entry.path) || pathKey(path).startsWith(pathKey(entry.path) + "/") || pathKey(entry.path).startsWith(pathKey(path) + "/")) throw new BootstrapError("receipt_overlap", "Receipt cannot recover its own storage path.")
      const current = await fs.read(entry.path)
      const actual = current ? hash(current.data) : null
      const before = entry.before_sha256
      const status = entry.state === "skipped" || actual === before ? "unchanged"
        : entry.state === "written" && actual === entry.after_sha256 && current?.mode === entry.after_mode ? (entry.before === null ? "would_remove" : "would_restore") : "conflict"
      results.push({ path: entry.path, status })
    }
    const report = { ...output("recover", results), receipt: path, dry_run: opts.dryRun === true }
    if (results.some(item => item.status === "conflict")) return { ...report, status: "failed", error: { code: "recovery_conflict", message: "A file changed or a pending write is uncertain; no files were restored." } }
    if (opts.dryRun || receipt.state === "recovered" && results.every(item => item.status === "unchanged")) return report
    receipt.state = "recovering"
    saved = await store(fs, path, receipt, saved)
    const completed: string[] = []
    for (let i = receipt.files.length - 1; i >= 0; i--) {
      const entry = receipt.files[i]!
      const result = results[i]!
      try {
        if (result.status !== "unchanged") {
          if (entry.before === null) await fs.remove(entry.path, entry.after_sha256, entry.after_mode)
          else await fs.write(entry.path, Buffer.from(entry.before, "base64"), entry.after_sha256, entry.before_mode!, entry.after_mode)
          result.status = entry.before === null ? "removed" : "restored"
          completed.push(entry.path)
        }
        if (entry.state !== "skipped") entry.state = "restored"
        saved = await store(fs, path, receipt, saved)
      } catch (err) {
        receipt.state = "partial"
        try { await store(fs, path, receipt, saved) } catch {}
        return { ...report, status: "failed", partial: true, completed, error: errorDetail(err), recovery: "Preserve files and receipt; inspect current state before another recovery attempt." }
      }
    }
    receipt.state = "recovered"
    try { await store(fs, path, receipt, saved) } catch (err) { return { ...report, status: "failed", partial: true, completed, error: errorDetail(err) } }
    return { ...report, completed }
  } finally { await fs.close() }
}

const help = "Usage: bun main.ts inspect TARGET | apply TARGET --plan PLAN [--context CONTEXT] [--receipt RELPATH] [--dry-run] | verify TARGET [--paths FILE ...] [--context CONTEXT] | recover TARGET --receipt RELPATH [--dry-run]"

export async function main(args = process.argv.slice(2)) {
  if (args.length === 1 && ["--help", "-h"].includes(args[0]!)) { console.log(help); return 0 }
  let command = args[0] ?? "unknown"
  try {
    if (!["inspect", "apply", "verify", "recover"].includes(command) || !args[1] || args[1]!.startsWith("--")) throw new BootstrapError("usage", help)
    const root = await realpath(args[1]!)
    if (!(await stat(root)).isDirectory()) throw new BootstrapError("invalid_target", "Target must be an existing directory.")
    const flags: Record<string, string | boolean | string[]> = {}
    const allowed = command === "apply" ? ["--plan", "--context", "--receipt", "--dry-run"] : command === "verify" ? ["--paths", "--context"] : command === "recover" ? ["--receipt", "--dry-run"] : []
    for (let i = 2; i < args.length; i++) {
      const key = args[i]!
      if (!allowed.includes(key) || key in flags) throw new BootstrapError("usage", "Unknown or repeated option.")
      if (key === "--dry-run") flags[key] = true
      else if (key === "--paths") {
        const values: string[] = []
        while (args[i + 1] && !args[i + 1]!.startsWith("--")) values.push(args[++i]!)
        if (!values.length) throw new BootstrapError("usage", "--paths needs one or more relative files.")
        flags[key] = values
      } else {
        const value = args[++i]
        if (!value || value.startsWith("--")) throw new BootstrapError("usage", "Option needs a value.")
        flags[key] = value
      }
    }
    let out: Record<string, unknown>
    if (command === "inspect") out = await inspectProject(root)
    else if (command === "verify") out = await verifyProject(root, flags["--paths"] as string[] | undefined, flags["--context"] as string | undefined)
    else if (command === "apply") {
      if (typeof flags["--plan"] !== "string") throw new BootstrapError("usage", "apply requires --plan.")
      out = await applyPlan(root, flags["--plan"], { dryRun: flags["--dry-run"] === true, receipt: flags["--receipt"] as string | undefined, context: flags["--context"] as string | undefined })
    } else {
      if (typeof flags["--receipt"] !== "string") throw new BootstrapError("usage", "recover requires --receipt.")
      out = await recover(root, flags["--receipt"], { dryRun: flags["--dry-run"] === true })
    }
    console.log(JSON.stringify(out, null, 2))
    return out.status === "passed" ? 0 : 1
  } catch (err) {
    console.log(JSON.stringify({ schema_version: 1, command, status: "failed", error: errorDetail(err) }, null, 2))
    return 2
  }
}

if (import.meta.main) process.exitCode = await main()
