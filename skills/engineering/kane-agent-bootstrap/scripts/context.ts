import { constants } from "node:fs"
import { lstat, open, realpath } from "node:fs/promises"
import { isAbsolute, relative, resolve, sep } from "node:path"
import { createHash } from "node:crypto"
import { parseDocument } from "yaml"

export type Status = "passed" | "failed" | "unverified"
export type Finding = { path: string; code: string; status: "failed" | "unverified" | "warning"; message: string; line?: number; fact_id?: string }
export type ContextReport = { status: Status; findings: Finding[]; blocked_stages: string[]; summary: Record<string, number> }

export const record = (val: unknown): val is Record<string, unknown> => val !== null && typeof val === "object" && !Array.isArray(val)
export const nonempty = (val: unknown): val is string => typeof val === "string" && val.trim().length > 0
export const sha256 = (val: Uint8Array | string) => createHash("sha256").update(val).digest("hex")
export const finding = (path: string, code: string, message: string, status: Finding["status"] = "failed", extra: Partial<Finding> = {}): Finding => ({ path, code, message, status, ...extra })

export function privatePath(path: string) {
  const canonical = path.normalize("NFD").replaceAll("\\", "/").toLowerCase()
  const parts = canonical.split("/")
  const name = parts.at(-1) ?? ""
  const example = /^\.env\..*\.(example|sample|template)$/.test(name) || /^\.env\.(example|sample|template)$/.test(name)
  return parts.some(p => [".git", ".hg", ".svn", ".aws", ".ssh", ".gnupg", "private", "secrets"].includes(p) || p.startsWith("private-"))
    || /(?:^|\/)\.agents\/(?:state|cache)(?:\/|$)/.test(canonical)
    || /(?:^|\/)\.agents\/[^/]*\.local\.[^/]*$/.test(canonical)
    || ((name === ".env" || name.startsWith(".env.")) && !example)
    || /\.(?:pem|key|p12|pfx|keystore)$/.test(name)
    || ["credentials", "credentials.json", "id_rsa", "id_ed25519"].includes(name)
}

export async function insidePath(root: string, base: string, val: string) {
  if (!val || val.includes("\0") || val.includes("\\") || isAbsolute(val)) throw new Error("invalid_path")
  const path = resolve(base, val)
  const rel = relative(root, path)
  if (isAbsolute(rel) || rel === ".." || rel.startsWith(`..${sep}`)) throw new Error("path_boundary")
  let dir = root
  for (const part of rel.split(sep).filter(Boolean)) {
    dir = resolve(dir, part)
    try {
      if ((await lstat(dir)).isSymbolicLink()) throw new Error("symbolic_link")
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err
    }
  }
  return path
}

export async function readBounded(path: string, limit = 512 * 1024, decode = true) {
  const file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK)
  try {
    const before = await file.stat()
    if (!before.isFile() || before.size > limit) throw new Error("file_limit")
    const data = Buffer.alloc(limit + 1)
    let size = 0
    while (size <= limit) {
      const out = await file.read(data, size, data.length - size, size)
      if (!out.bytesRead) break
      size += out.bytesRead
    }
    const after = await file.stat()
    if (size > limit || after.size !== size || before.mtimeMs !== after.mtimeMs || before.ctimeMs !== after.ctimeMs) throw new Error("file_changed_or_too_large")
    const raw = data.subarray(0, size)
    return { raw, text: decode ? new TextDecoder("utf-8", { fatal: true }).decode(raw) : "" }
  } finally {
    await file.close()
  }
}

export async function assessContext(root: string, path: string): Promise<ContextReport> {
  const findings: Finding[] = []
  const blocked = new Set<string>()
  const summary: Record<string, number> = { confirmed: 0, assumed: 0, conflicting: 0, unknown: 0 }
  let data: unknown
  try {
    const raw = await readBounded(resolve(path), 1024 * 1024)
    const doc = parseDocument(raw.text, { uniqueKeys: true })
    if (doc.errors.length) throw new Error("invalid_json")
    data = JSON.parse(raw.text)
  } catch {
    return { status: "failed", findings: [finding("context", "context_parse", "Context must be readable bounded JSON with unique keys.")], blocked_stages: [], summary }
  }
  if (!record(data) || data.schema_version !== 1 || !Array.isArray(data.facts) || data.facts.length > 256) {
    return { status: "failed", findings: [finding("context", "context_shape", "Context needs schema_version 1 and at most 256 facts.")], blocked_stages: [], summary }
  }
  const ids = new Set<string>()
  const hashes = new Map<string, string>()
  let bytes = 0
  const rootPath = await realpath(root)
  for (const fact of data.facts) {
    if (!record(fact) || !nonempty(fact.id) || ids.has(fact.id) || !nonempty(fact.statement)
      || typeof fact.status !== "string" || !["confirmed", "assumed", "conflicting", "unknown"].includes(fact.status)
      || !Array.isArray(fact.sources) || fact.sources.length > 16 || !Array.isArray(fact.blocks)
      || fact.blocks.some(stage => typeof stage !== "string" || !["apply", "runtime", "business"].includes(stage))) {
      findings.push(finding("context", "fact_shape", "Facts need unique IDs, a statement, status, sources and valid blocked stages."))
      continue
    }
    ids.add(fact.id)
    summary[String(fact.status)]++
    const extra = { fact_id: fact.id }
    if (fact.status === "confirmed" && !fact.sources.length) findings.push(finding("context", "missing_evidence", "A confirmed fact needs at least one source.", "failed", extra))
    if (fact.status !== "confirmed") findings.push(finding("context", "unsettled_fact", "This fact remains an assumption, conflict or unknown.", "warning", extra))
    if (fact.status === "unknown" || fact.status === "conflicting") {
      for (const stage of fact.blocks as string[]) blocked.add(stage)
    }
    for (const source of fact.sources) {
      if (!record(source) || typeof source.kind !== "string" || !["file", "user", "observation", "external"].includes(source.kind) || !nonempty(source.ref)
        || (source.sha256 !== undefined && (typeof source.sha256 !== "string" || !/^[a-fA-F0-9]{64}$/.test(source.sha256)))) {
        findings.push(finding("context", "source_shape", "Each source needs a supported kind, reference and optional SHA-256.", "failed", extra))
        continue
      }
      if (source.kind !== "file") continue
      const ref = source.ref.split("#")[0]!
      if (privatePath(ref)) {
        findings.push(finding("context", "private_evidence", "Private and runtime-state files cannot be used as context evidence.", "failed", extra))
        continue
      }
      try {
        const target = await insidePath(rootPath, rootPath, ref)
        if (privatePath(relative(rootPath, target))) throw new Error("private_evidence")
        const meta = await lstat(target)
        if (!meta.isFile()) throw new Error("not_regular")
        if (source.sha256 === undefined) continue
        if (!hashes.has(target)) {
          if (bytes + meta.size > 8 * 1024 * 1024) throw new Error("evidence_limit")
          const raw = await readBounded(target, 512 * 1024, false)
          bytes += raw.raw.byteLength
          hashes.set(target, sha256(raw.raw))
        }
        if (hashes.get(target) !== source.sha256.toLowerCase()) {
          findings.push(finding(ref, "stale_evidence", "Source content changed since the recorded evidence.", "failed", extra))
        }
      } catch {
        findings.push(finding(ref, "unavailable_evidence", "Evidence must be a readable ordinary file inside this project.", "failed", extra))
      }
    }
  }
  return { status: findings.some(f => f.status === "failed") ? "failed" : "passed", findings, blocked_stages: [...blocked].sort(), summary }
}
