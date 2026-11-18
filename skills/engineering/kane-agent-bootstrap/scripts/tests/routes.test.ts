import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { createHash } from "node:crypto"
import { cp, lstat, mkdir, mkdtemp, readFile, readdir, rm, stat, symlink, utimes, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"

type Entry = {
  file: string
  section?: string
  select?: string[]
  aliases?: string[]
  summary?: string
  when?: ("start" | "plan" | "implement" | "verify" | "handoff")[]
  sources?: { file: string; sha256: string }[]
  sha256?: string
}
type Result = { id: string; file?: string; status: string; content?: string; changed?: boolean }
type Report = {
  schema_version: number
  status: string
  entries?: Result[]
  metrics?: { index_bytes: number; source_bytes_read: number; returned_bytes: number; files_read: number }
  receipt?: string
  omitted?: number
  uncovered?: string[]
  error?: { code: string }
  context_updates?: Report
  context_index?: Report
  task?: { file: string; status: string; content?: string }
  writes_performed?: number | null
  index_sha256?: string
}
type Index = { schema_version: 1; entries: Record<string, Entry> }

const skill = resolve(import.meta.dir, "../..")
const cli = join(skill, "scripts/main.ts")
const indexPath = ".agents/context/index.json"
const sha = (value: string | Uint8Array) => createHash("sha256").update(value).digest("hex")
let base = ""
let project = ""

beforeEach(async () => {
  base = await mkdtemp(join(tmpdir(), "bun-context-routes-"))
  project = join(base, "project")
  await mkdir(project)
})

afterEach(async () => {
  await rm(base, { recursive: true, force: true })
})

async function write(path: string, content: string) {
  const target = join(project, path)
  await mkdir(dirname(target), { recursive: true })
  await writeFile(target, content)
  return target
}

async function exists(path: string) {
  try {
    await lstat(path)
    return true
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false
    throw error
  }
}

async function index(entries: Record<string, Entry>) {
  const text = JSON.stringify({ schema_version: 1, entries }) + "\n"
  await write(indexPath, text)
  return text
}

async function run(args: string[], codes = [0], entry = cli) {
  const proc = Bun.spawn([process.execPath, entry, ...args], { cwd: base, stdout: "pipe", stderr: "pipe", timeout: 15000 })
  const [stdout, stderr, code] = await Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text(), proc.exited])
  expect(codes, `${code}\n${stdout}\n${stderr}`).toContain(code)
  let report: Report
  try {
    report = JSON.parse(stdout) as Report
  } catch {
    throw new Error(`CLI must emit JSON\n${stdout}\n${stderr}`)
  }
  expect(report.schema_version).toBe(1)
  return { report, stdout, code }
}

async function updatePlan(expected: string | null, upsert: Record<string, Entry>, remove?: string[]) {
  const path = join(base, "update.json")
  await writeFile(path, JSON.stringify({ schema_version: 1, expected_sha256: expected, upsert, ...(remove ? { remove } : {}) }))
  return path
}

function ids(report: Report) {
  return report.entries?.map(entry => entry.id).sort() ?? []
}

function selected(report: Report, id: string) {
  const entry = report.entries?.find(entry => entry.id === id)
  expect(entry, `Missing result for ${id}`).toBeDefined()
  return entry!
}

describe("context retrieval", () => {
  test("batches exact keys and aliases while reading a shared source once", async () => {
    const content = "# Guide\n\n## One\nfirst rule\n\n## Two\nsecond rule\n"
    await write("docs/guide.md", content)
    await write("docs/unrelated.md", "unrelated-".repeat(256 * 1024))
    const raw = await index({
      first: { file: "docs/guide.md", section: "one", aliases: ["primary"], sha256: sha(content) },
      second: { file: "docs/guide.md", section: "two", sha256: sha(content) },
      unrelated: { file: "docs/unrelated.md", summary: "A large unrelated corpus" },
    })
    const { report, stdout } = await run(["context", "get", project, "primary", "second"])
    expect(ids(report)).toEqual(["first", "second"])
    expect(selected(report, "first").content).toContain("first rule")
    expect(selected(report, "second").content).toContain("second rule")
    expect(stdout).not.toContain("unrelated-unrelated")
    expect(report.metrics?.index_bytes).toBe(Buffer.byteLength(raw))
    expect(report.metrics?.source_bytes_read).toBe(Buffer.byteLength(content))
    expect(report.metrics?.files_read).toBe(1)
  })

  test("does not guess an ambiguous alias or an unknown key", async () => {
    const secret = "must-not-pick-an-ambiguous-conclusion"
    await write("a.md", secret)
    await write("b.md", "other conclusion\n")
    await index({
      a: { file: "a.md", aliases: ["shared"], sha256: sha(secret) },
      b: { file: "b.md", aliases: ["shared"], sha256: sha("other conclusion\n") },
    })
    for (const key of ["shared", "missing", "SHARED", "shar"]) {
      const { report, stdout } = await run(["context", "get", project, key], [1])
      expect(report.status).not.toBe("passed")
      expect(stdout).not.toContain(secret)
    }
  })

  test("reports keys beyond the 32 entry limit and rejects invalid byte budgets", async () => {
    const content = "A valid source\n"
    await write("source.md", content)
    const keys = Array.from({ length: 33 }, (_, i) => `key-${i}`)
    await index(Object.fromEntries(keys.map(key => [key, { file: "source.md", sha256: sha(content) }])))
    const { report } = await run(["context", "get", project, ...keys], [1])
    expect(report.entries).toHaveLength(32)
    expect(report.omitted).toBe(1)
    expect(report.uncovered).toEqual(["key-32"])
    for (const value of ["-1", "0", "1.5", "many"]) {
      await run(["context", "get", project, "key-0", "--max-bytes", value], [2])
    }
  })

  test("search reads metadata without opening indexed source files", async () => {
    await write("notes.md", "body-only-needle\n")
    await index({
      alpha: { file: "does-not-exist.md", aliases: ["metadata-needle"], summary: "metadata-needle first" },
      beta: { file: "notes.md", summary: "metadata-needle second" },
    })
    const { report } = await run(["context", "search", project, "metadata-needle", "--limit", "1"])
    expect(report.entries).toHaveLength(1)
    expect(report.metrics?.source_bytes_read).toBe(0)
    expect(report.metrics?.files_read).toBe(0)
    expect(report.entries?.every(entry => entry.content === undefined)).toBe(true)
    const { report: absent } = await run(["context", "search", project, "body-only-needle"], [1])
    expect(absent.entries).toEqual([])
    expect(absent.metrics?.source_bytes_read).toBe(0)
  })

  test("returns complete ATX and Setext section subtrees while ignoring fenced headings", async () => {
    const markdown = "# Guide\n\nintro outside\n\n## Workflow\n\nworkflow rule\n\n### Child\n\nchild rule\n\n```md\n## Fenced sibling\n```\n\nstill child\n\n## Other\n\nother outside\n\nAppendix\n--------\n\nappendix rule\n\n### Detail\n\ndetail rule\n\nNext\n----\n\nnext outside\n"
    await write("guide.md", markdown)
    await index({
      workflow: { file: "guide.md", section: "workflow", sha256: sha(markdown) },
      appendix: { file: "guide.md", section: "appendix", sha256: sha(markdown) },
    })
    const { report } = await run(["context", "get", project, "workflow", "appendix"])
    const workflow = selected(report, "workflow").content
    const appendix = selected(report, "appendix").content
    expect(workflow).toContain("workflow rule")
    expect(workflow).toContain("child rule")
    expect(workflow).toContain("still child")
    expect(workflow).not.toContain("intro outside")
    expect(workflow).not.toContain("other outside")
    expect(appendix).toContain("appendix rule")
    expect(appendix).toContain("detail rule")
    expect(appendix).not.toContain("next outside")
    expect(report.metrics?.files_read).toBe(1)
  })

  test("selects nested YAML and JSON fields without returning siblings", async () => {
    const marker = join(project, "selected-command-must-not-run")
    const command = `touch ${marker}`
    const yaml = `environment:\n  commands:\n    test: ${command}\n    build: excluded-build-command\n  secret_example: excluded-yaml-sibling\n`
    const json = JSON.stringify({ environment: { commands: { test: ["bun", "test"], build: "excluded-json-sibling" } } })
    await write("project.yml", yaml)
    await write("project.json", json)
    await index({
      yaml: { file: "project.yml", select: ["environment", "commands", "test"], sha256: sha(yaml) },
      json: { file: "project.json", select: ["environment", "commands", "test"], sha256: sha(json) },
    })
    const { report, stdout } = await run(["context", "get", project, "yaml", "json"])
    expect(selected(report, "yaml").content).toContain(command)
    expect(await exists(marker)).toBe(false)
    expect(selected(report, "json").content).toContain("bun")
    expect(selected(report, "json").content).toContain("test")
    expect(stdout).not.toContain("excluded-build-command")
    expect(stdout).not.toContain("excluded-yaml-sibling")
    expect(stdout).not.toContain("excluded-json-sibling")
  })

  test("omits whole entries that exceed the byte budget and reports incomplete coverage", async () => {
    const small = "小条目\n"
    const large = "large-entry-".repeat(30)
    await write("small.md", small)
    await write("large.md", large)
    await index({
      small: { file: "small.md", sha256: sha(small) },
      large: { file: "large.md", sha256: sha(large) },
    })
    const { report } = await run(["context", "get", project, "small", "large", "--max-bytes", "32"], [1])
    expect(report.status).toBe("unverified")
    expect(selected(report, "small").content).toBe(small)
    expect(selected(report, "large").content).toBeUndefined()
    expect(selected(report, "large").status).not.toBe("passed")
    expect(report.metrics?.returned_bytes).toBe(Buffer.byteLength(small))
  })

  test("uses a 16 KiB default budget without silently truncating content", async () => {
    const content = "x".repeat(16 * 1024 + 1)
    await write("large.md", content)
    await index({ large: { file: "large.md", sha256: sha(content) } })
    const { report } = await run(["context", "get", project, "large"], [1])
    expect(selected(report, "large").content).toBeUndefined()
    expect(report.metrics?.returned_bytes).toBe(0)
    const { report: explicit } = await run(["context", "get", project, "large", "--max-bytes", "20000"])
    expect(selected(explicit, "large").content).toBe(content)
  })

  test("missing files and missing selectors remain explicit failures", async () => {
    await write("guide.md", "# Guide\n\nexisting\n")
    await write("project.yml", "environment: {}\n")
    await index({
      missing: { file: "gone.md" },
      section: { file: "guide.md", section: "absent", sha256: sha("# Guide\n\nexisting\n") },
      field: { file: "project.yml", select: ["environment", "missing"], sha256: sha("environment: {}\n") },
    })
    for (const key of ["missing", "section", "field"]) {
      const { report } = await run(["context", "get", project, key], [1])
      expect(selected(report, key).status).not.toBe("passed")
      expect(selected(report, key).content).toBeUndefined()
    }
  })
})

describe("context freshness and workflow nodes", () => {
  test("returns current direct source content and marks a recorded hash change", async () => {
    const before = "# Earlier source\n"
    const current = "# Current source\n"
    await write("guide.md", current)
    await index({ guide: { file: "guide.md", sha256: sha(before) } })
    const { report } = await run(["context", "get", project, "guide"], [1])
    expect(selected(report, "guide").content).toBe(current)
    expect(selected(report, "guide").changed).toBe(true)
  })

  test("dependency changes affect related entries and suppress stale conclusions", async () => {
    const original = "supported = true\n"
    const changed = "supported = false\n"
    const conclusion = "The dependency supports this workflow.\n"
    const other = "Independent guide\n"
    await write("src/config.txt", original)
    await write("notes/decision.md", conclusion)
    await write("other.md", other)
    await index({
      decision: { file: "notes/decision.md", sha256: sha(conclusion), sources: [{ file: "src/config.txt", sha256: sha(original) }] },
      other: { file: "other.md", sha256: sha(other) },
    })
    await write("src/config.txt", changed)
    const { report, stdout } = await run(["context", "get", project, "decision", "other"], [1])
    expect(selected(report, "decision").status).not.toBe("passed")
    expect(selected(report, "decision").content).toBeUndefined()
    expect(selected(report, "other").content).toBe(other)
    expect(stdout).not.toContain(conclusion.trim())
    const { report: impacted } = await run(["context", "check", project, "--changed", "src/config.txt"], [1])
    expect(ids(impacted)).toEqual(["decision"])
    expect(selected(impacted, "decision").status).not.toBe("passed")
  })

  test("a removed dependency invalidates its entry without checking unrelated entries", async () => {
    const source = "export const enabled = true\n"
    const note = "Derived rule\n"
    await write("source.ts", source)
    await write("note.md", note)
    await index({
      derived: { file: "note.md", sha256: sha(note), sources: [{ file: "source.ts", sha256: sha(source) }] },
      unrelated: { file: "unavailable-unrelated.md" },
    })
    await rm(join(project, "source.ts"))
    const { report, stdout } = await run(["context", "check", project, "--changed", "source.ts"], [1])
    expect(ids(report)).toEqual(["derived"])
    expect(stdout).not.toContain(note.trim())
  })

  test("check defaults to the whole index and explicit keys narrow the check", async () => {
    const content = "Current reference\n"
    await write("reference.md", content)
    await index({ good: { file: "reference.md", sha256: sha(content) }, missing: { file: "gone.md" } })
    const { report: all } = await run(["context", "check", project], [1])
    expect(ids(all)).toEqual(["good", "missing"])
    const { report: narrowed } = await run(["context", "check", project, "--keys", "good"])
    expect(ids(narrowed)).toEqual(["good"])
    expect(narrowed.entries?.every(entry => entry.content === undefined)).toBe(true)
  })

  test("node combines lifecycle tags, explicit keys, changed dependencies and the current task", async () => {
    const implementation = "Implementation policy\n"
    const explicit = "Explicitly requested guide\n"
    const derived = "Affected dependency note\n"
    const dependency = "Current dependency\n"
    const ignored = "Planning-only content must stay unloaded\n"
    await write("implement.md", implementation)
    await write("explicit.md", explicit)
    await write("derived.md", derived)
    await write("dependency.txt", dependency)
    await write("plan.md", ignored)
    await write("tasks/one.md", "Task one initial content\n")
    await index({
      implement: { file: "implement.md", when: ["implement"], sha256: sha(implementation) },
      explicit: { file: "explicit.md", sha256: sha(explicit) },
      derived: { file: "derived.md", sha256: sha(derived), sources: [{ file: "dependency.txt", sha256: sha(dependency) }] },
      plan: { file: "plan.md", when: ["plan"], sha256: sha(ignored) },
    })
    const args = ["context", "node", project, "implement", "--keys", "explicit", "--changed", "dependency.txt", "--task", "tasks/one.md"]
    const { report, stdout } = await run(args)
    expect(ids(report)).toEqual(expect.arrayContaining(["implement", "explicit", "derived"]))
    expect(ids(report)).not.toContain("plan")
    expect(stdout).toContain("Task one initial content")
    expect(stdout).not.toContain(ignored.trim())
    await write("tasks/one.md", "Task one revised content\n")
    const { stdout: revised } = await run(args)
    expect(revised).toContain("Task one revised content")
    expect(revised).not.toContain("Task one initial content")
    await write("tasks/two.md", "A different explicit task\n")
    const { stdout: next } = await run(["context", "node", project, "verify", "--keys", "explicit", "--task", "tasks/two.md"])
    expect(next).toContain("A different explicit task")
    expect(next).not.toContain("Task one revised content")
    await run(["context", "node", project, "unknown"], [2])
  })
})

describe("incremental context index updates", () => {
  test("upsert and remove preserve unrelated entries and source files and are recoverable", async () => {
    const keep = "Unrelated source stays byte-identical\n"
    const added = "New guide\n"
    const evidence = "Current evidence\n"
    await write("keep.md", keep)
    await write("added.md", added)
    await write("evidence.txt", evidence)
    const preserved: Entry = { file: "keep.md", summary: "Preserve all metadata", sha256: sha("An earlier source\n") }
    const before = await index({ keep: preserved, obsolete: { file: "obsolete.md" } })
    const path = await updatePlan(sha(before), { added: { file: "added.md", sources: [{ file: "evidence.txt", sha256: sha(evidence) }] } }, ["obsolete"])
    await run(["context", "update", project, "--plan", path, "--dry-run"])
    expect(await readFile(join(project, indexPath), "utf8")).toBe(before)
    expect(await exists(join(project, ".agents/state"))).toBe(false)
    const { report } = await run(["context", "update", project, "--plan", path, "--receipt", ".agents/state/bootstrap/context-update.json"])
    const after = JSON.parse(await readFile(join(project, indexPath), "utf8")) as Index
    expect(after.entries.keep).toEqual(preserved)
    expect(after.entries.obsolete).toBeUndefined()
    expect(after.entries.added?.sha256).toBe(sha(added))
    expect(after.entries.added?.sources).toEqual([{ file: "evidence.txt", sha256: sha(evidence) }])
    expect(await readFile(join(project, "keep.md"), "utf8")).toBe(keep)
    expect(await readFile(join(project, "added.md"), "utf8")).toBe(added)
    expect(await readFile(join(project, "evidence.txt"), "utf8")).toBe(evidence)
    expect(report.receipt).toBe(".agents/state/bootstrap/context-update.json")
    await run(["recover", project, "--receipt", report.receipt!])
    expect(await readFile(join(project, indexPath), "utf8")).toBe(before)
  })

  test("repeating the same old expected hash is idempotent without new writes or receipts", async () => {
    const content = "Stable guide\n"
    await write("guide.md", content)
    const before = await index({})
    const path = await updatePlan(sha(before), { guide: { file: "guide.md" } })
    const args = ["context", "update", project, "--plan", path, "--receipt", ".agents/state/bootstrap/stable-index.json"]
    await run(args)
    const target = join(project, indexPath)
    const raw = await readFile(target, "utf8")
    await utimes(target, 1600000000, 1600000000)
    const stamp = (await stat(target)).mtimeMs
    const receipts = await readdir(join(project, ".agents/state/bootstrap"))
    await run(args)
    expect(await readFile(target, "utf8")).toBe(raw)
    expect((await stat(target)).mtimeMs).toBe(stamp)
    expect(await readdir(join(project, ".agents/state/bootstrap"))).toEqual(receipts)
  })

  test("a stale expected index hash refuses a different result without touching the index", async () => {
    const content = "Guide\n"
    await write("guide.md", content)
    const before = await index({})
    const path = await updatePlan(sha(before), { guide: { file: "guide.md" } })
    const concurrent = await index({ concurrent: { file: "other.md", summary: "Another session's update" } })
    await run(["context", "update", project, "--plan", path], [1])
    expect(await readFile(join(project, indexPath), "utf8")).toBe(concurrent)
    expect(await exists(join(project, ".agents/state"))).toBe(false)
  })

  test("index update refuses credential metadata without echoing the rejected entry", async () => {
    const value = "ghp_" + "0".repeat(36)
    const guide = "Guide\n"
    await write("guide.md", guide)
    const entry = { file: "guide.md", summary: value }
    const before = await index({})
    const reject = async (current: string, expected: string) => {
      const path = await updatePlan(expected, { guide: entry })
      const { report, stdout } = await run(["context", "update", project, "--plan", path], [1])
      expect(report.writes_performed).toBe(0)
      expect(stdout).toContain("sensitive_content")
      expect(stdout).not.toContain(value)
      expect(await readFile(join(project, indexPath), "utf8")).toBe(current)
      expect(await exists(join(project, ".agents/state"))).toBe(false)
    }
    await reject(before, sha(before))
    await reject(before, sha("stale index"))
    const unchanged = await index({ guide: { ...entry, sha256: sha(guide) } })
    await reject(unchanged, sha(unchanged))
  })

  test("can create a missing index with expected null and recover that creation", async () => {
    const content = "First guide\n"
    await write("guide.md", content)
    const path = await updatePlan(null, { guide: { file: "guide.md" } })
    const { report } = await run(["context", "update", project, "--plan", path])
    const created = JSON.parse(await readFile(join(project, indexPath), "utf8")) as Index
    expect(created.entries.guide?.sha256).toBe(sha(content))
    expect(report.receipt).toBeDefined()
    await run(["recover", project, "--receipt", report.receipt!])
    expect(await exists(join(project, indexPath))).toBe(false)
    expect(await readFile(join(project, "guide.md"), "utf8")).toBe(content)
  })

  test("refuses stale or missing dependency evidence without refreshing unrelated entries", async () => {
    const note = "Derived claim\n"
    await write("note.md", note)
    await write("source.txt", "Current source\n")
    const before = await index({ keep: { file: "keep.md", sources: [{ file: "old.txt", sha256: sha("Old evidence\n") }] } })
    for (const source of [{ file: "source.txt", sha256: sha("Earlier source\n") }, { file: "missing.txt", sha256: sha("Missing evidence\n") }]) {
      const path = await updatePlan(sha(before), { claim: { file: "note.md", sources: [source] } })
      await run(["context", "update", project, "--plan", path], [1, 2])
      expect(await readFile(join(project, indexPath), "utf8")).toBe(before)
      expect(await exists(join(project, ".agents/state"))).toBe(false)
    }
  })
})

describe("context integration with adoption commands", () => {
  test("apply checks only affected index entries after successful writes without refreshing them", async () => {
    const before = "export const supported = true\n"
    const after = "export const supported = false\n"
    const claim = "The feature is supported.\n"
    const path = join(base, "files.json")
    await writeFile(path, JSON.stringify({ schema_version: 1, files: [{ path: "src/feature.ts", expected_sha256: null, content: before }] }))
    const { report: baseline } = await run(["apply", project, "--plan", path])
    expect(baseline.context_updates).toBeUndefined()
    await write("notes/claim.md", claim)
    const raw = await index({
      claim: { file: "notes/claim.md", sha256: sha(claim), sources: [{ file: "src/feature.ts", sha256: sha(before) }] },
      unrelated: { file: "unavailable-unrelated.md" },
    })
    await writeFile(path, JSON.stringify({ schema_version: 1, files: [{ path: "src/feature.ts", expected_sha256: sha(before), content: after }] }))
    const { report } = await run(["apply", project, "--plan", path])
    expect(report.status).toBe("passed")
    expect(report.context_updates).toBeDefined()
    expect(ids(report.context_updates!)).toEqual(["claim"])
    expect(selected(report.context_updates!, "claim").status).not.toBe("passed")
    expect(selected(report.context_updates!, "claim").content).toBeUndefined()
    expect(await readFile(join(project, indexPath), "utf8")).toBe(raw)
    expect(await readFile(join(project, "src/feature.ts"), "utf8")).toBe(after)
  })

  test("verify includes an index in default or explicit scope and preserves unrelated explicit scope", async () => {
    await write("AGENTS.md", "# Project\n\nRead [environment](project.yml).\n")
    await write("project.yml", JSON.stringify({
      schema_version: 1,
      project: { name: "fixture", purpose: "A disposable command-line application", language: "zh-CN", timezone: "Asia/Shanghai" },
      environment: { supported_platforms: null, toolchains: [], commands: {}, services: [], tools: [], variables: [], local_paths: {} },
      requirements: { filesystem: [], network: [] },
      guides: {},
    }))
    const { report: baseline } = await run(["verify", project])
    expect(baseline.context_index).toBeUndefined()
    const original = "export const current = 1\n"
    const claim = "Recorded claim\n"
    await write("src/source.ts", "export const current = 2\n")
    await write("notes/claim.md", claim)
    await write("unrelated.md", "# Unrelated guide\n")
    await index({ claim: { file: "notes/claim.md", sha256: sha(claim), sources: [{ file: "src/source.ts", sha256: sha(original) }] } })
    for (const args of [["verify", project], ["verify", project, "--paths", indexPath]]) {
      const { report } = await run(args, [1])
      expect(report.context_index).toBeDefined()
      expect(ids(report.context_index!)).toEqual(["claim"])
      expect(selected(report.context_index!, "claim").status).not.toBe("passed")
    }
    const { report: narrow } = await run(["verify", project, "--paths", "unrelated.md"])
    expect(narrow.context_index).toBeUndefined()
  })
})

describe("context input boundaries", () => {
  test("private paths, traversal and symlink sources never disclose content", async () => {
    const secret = "private-file-content-never-return-1736\n"
    for (const path of [".ENV", ".AGENTS/config.local.json", ".AGENTS/state/event.md", "Credentials.JSON"]) await write(path, secret)
    await writeFile(join(base, "outside.md"), secret)
    await symlink(join(base, "outside.md"), join(project, "linked.md"))
    await mkdir(join(base, "outside"))
    await writeFile(join(base, "outside", "nested.md"), secret)
    await symlink(join(base, "outside"), join(project, "linked-dir"), "dir")
    for (const file of [".ENV", ".AGENTS/config.local.json", ".AGENTS/state/event.md", "Credentials.JSON", "../outside.md", "linked.md", "linked-dir/nested.md"]) {
      await index({ private: { file, sha256: sha(secret) } })
      const { report, stdout } = await run(["context", "get", project, "private"], [1, 2])
      expect(report.status).not.toBe("passed")
      expect(stdout).not.toContain(secret.trim())
    }
  })

  test("private evidence dependencies and explicit task files are rejected", async () => {
    const secret = "private-evidence-never-disclose-4826\n"
    const note = "Must not trust a private dependency\n"
    await write(".AGENTS/config.local.json", secret)
    await write("note.md", note)
    await index({ note: { file: "note.md", sha256: sha(note), sources: [{ file: ".AGENTS/config.local.json", sha256: sha(secret) }] } })
    const { stdout } = await run(["context", "get", project, "note"], [1, 2])
    expect(stdout).not.toContain(secret.trim())
    expect(stdout).not.toContain(note.trim())
    await index({})
    for (const task of [".AGENTS/config.local.json", "../outside.md"]) {
      const { stdout: result } = await run(["context", "node", project, "implement", "--task", task], [1, 2])
      expect(result).not.toContain(secret.trim())
    }
  })

  test("malformed JSON, duplicate keys and invalid index schemas fail safely", async () => {
    const bad = [
      "{bad-json",
      '{"schema_version":1,"entries":{},"entries":{}}',
      JSON.stringify({ schema_version: 2, entries: {} }),
      JSON.stringify({ schema_version: 1, entries: [] }),
      JSON.stringify({ schema_version: 1, entries: { "Upper-Case": { file: "guide.md" } } }),
      JSON.stringify({ schema_version: 1, entries: { guide: { file: "guide.md", section: "guide", select: ["guide"] } } }),
    ]
    for (const raw of bad) {
      await write(indexPath, raw)
      const { report } = await run(["context", "get", project, "guide"], [2])
      expect(report.status).not.toBe("passed")
    }
  })

  test("duplicate structured source keys cannot produce a selected conclusion", async () => {
    for (const [file, raw] of [["config.yml", "rule: first\nrule: second\n"], ["config.json", '{"rule":"first","rule":"second"}']] as const) {
      await write(file, raw)
      await index({ rule: { file, select: ["rule"], sha256: sha(raw) } })
      const { report } = await run(["context", "get", project, "rule"], [1])
      expect(selected(report, "rule").content).toBeUndefined()
      expect(selected(report, "rule").status).not.toBe("passed")
    }
  })

  test("invalid update input leaves the existing index and all source files untouched", async () => {
    const content = "Guide stays unchanged\n"
    await write("guide.md", content)
    const before = await index({ guide: { file: "guide.md", sha256: sha(content) } })
    const path = join(base, "bad-update.json")
    for (const raw of [
      "{bad-json",
      '{"schema_version":1,"expected_sha256":null,"upsert":{},"upsert":{}}',
      JSON.stringify({ schema_version: 2, expected_sha256: sha(before), upsert: {} }),
      JSON.stringify({ schema_version: 1, expected_sha256: sha(before), upsert: { unsafe: { file: "../outside.md" } } }),
    ]) {
      await writeFile(path, raw)
      await run(["context", "update", project, "--plan", path], [2])
      expect(await readFile(join(project, indexPath), "utf8")).toBe(before)
      expect(await readFile(join(project, "guide.md"), "utf8")).toBe(content)
    }
    expect(await exists(join(project, ".agents/state"))).toBe(false)
  })

  test("a copied package exposes the context commands without the original directory layout", async () => {
    const target = join(base, "standalone")
    await cp(join(skill, "scripts"), join(target, "scripts"), { recursive: true, filter: source => !source.includes("node_modules") && !source.includes("/tests") })
    await symlink(join(skill, "scripts/node_modules"), join(target, "scripts/node_modules"), "dir")
    const content = "Copied package reference\n"
    await write("guide.md", content)
    await index({ guide: { file: "guide.md", sha256: sha(content) } })
    const { report } = await run(["context", "get", project, "guide"], [0], join(target, "scripts/main.ts"))
    expect(selected(report, "guide").content).toBe(content)
  })
})

describe("context navigation regressions", () => {
  test("explicitly read current task is covered without creating a duplicate route", async () => {
    await write("workflow.md", "# Workflow\nRead the explicit current task.\n")
    await write("tasks/current.md", "# Actual task\nCurrent goal and next action.\n")
    await index({ workflow: { file: "workflow.md", when: ["handoff"] } })
    const { report } = await run(["context", "node", project, "handoff", "--task", "tasks/current.md", "--changed", "tasks/current.md"])
    expect(report.task?.content).toContain("Current goal")
    expect(report.uncovered).not.toContain("tasks/current.md")
    expect(Object.keys((JSON.parse(await readFile(join(project, indexPath), "utf8")) as Index).entries)).toEqual(["workflow"])
  })

  test("update reports actual confirmed index writes and a reusable index digest", async () => {
    await write("guide.md", "# Guide\nCurrent rule.\n")
    const path = await updatePlan(null, { guide: { file: "guide.md" } })
    const dry = await run(["context", "update", project, "--plan", path, "--dry-run"])
    expect(dry.report.writes_performed).toBe(0)
    const first = await run(["context", "update", project, "--plan", path])
    expect(first.report.writes_performed).toBe(1)
    expect(first.report.index_sha256).toBe(sha(await readFile(join(project, indexPath))))
    const repeated = await run(["context", "update", project, "--plan", path])
    expect(repeated.report.writes_performed).toBe(0)
  })

  test("HTML comments and raw blocks cannot silently truncate a Markdown section", async () => {
    for (const block of ["<!-- note\n## fake heading\n-->", "<div>\n## fake heading\n</div>\n", "<pre>\n## fake heading\n</pre>"]) {
      const body = "## Workflow\nfirst required rule\n" + block + "\nsecond required rule\n## End\nnot selected\n"
      await write("workflow.md", body)
      await index({ workflow: { file: "workflow.md", section: "Workflow", sha256: sha(body) } })
      const { report } = await run(["context", "get", project, "workflow"])
      expect(selected(report, "workflow").content).toContain("second required rule")
      expect(selected(report, "workflow").content).not.toContain("not selected")
    }
  })

  test("source checks validate selectors without returning their bodies", async () => {
    const body = "# Guide\n\n## Existing\nactual content\n"
    const config = '{"actual":1}\n'
    await write("guide.md", body)
    await write("config.json", config)
    for (const entry of [
      { file: "guide.md", section: "Never exists", sha256: sha(body) },
      { file: "config.json", select: ["missing"], sha256: sha(config) },
    ]) {
      await index({ broken: entry })
      const { report } = await run(["context", "check", project], [1])
      expect(selected(report, "broken").status).not.toBe("passed")
      expect(selected(report, "broken").content).toBeUndefined()
      await run(["verify", project, "--paths", indexPath], [1])
    }
  })

  test("explicit task and business keys receive budget before automatic candidates", async () => {
    await write("task.md", "# Current task\nPreserve the actual business goal.\n")
    await write("business.md", "business requirement\n")
    await write("small.md", "x\n")
    const entries: Record<string, Entry> = { business: { file: "business.md" } }
    for (let i = 0; i < 32; i++) entries["auto." + i] = { file: "small.md", when: ["implement"] }
    await index(entries)
    const first = await run(["context", "node", project, "implement", "--keys", "business", "--task", "task.md"], [1])
    expect(selected(first.report, "business").content).toContain("business requirement")
    expect(first.report.task?.content).toContain("actual business goal")
    await write("large.md", "x".repeat(16384))
    await index({ automatic: { file: "large.md", when: ["implement"] }, business: { file: "business.md" } })
    const second = await run(["context", "node", project, "implement", "--keys", "business", "--task", "task.md"], [1])
    expect(selected(second.report, "business").content).toContain("business requirement")
    expect(second.report.task?.content).toContain("actual business goal")
  })

  test("incremental checks match file identities without conflating distinct case-sensitive files", async () => {
    const before = "old source\n", after = "new source\n", note = "Derived claim\n"
    await write("Source.txt", before)
    const alias = join(project, "source.txt")
    let same = false
    try {
      const a = await stat(join(project, "Source.txt")), b = await stat(alias)
      same = a.dev === b.dev && a.ino === b.ino
    } catch {}
    if (!same) await write("source.txt", before)
    await write("claim.md", note)
    await index({ claim: { file: "claim.md", sha256: sha(note), sources: [{ file: "Source.txt", sha256: sha(before) }] } })
    const path = join(base, "source-plan.json")
    await writeFile(path, JSON.stringify({ schema_version: 1, files: [{ path: "source.txt", expected_sha256: sha(before), content: after }] }))
    const { report } = await run(["apply", project, "--plan", path])
    expect(report.context_updates).toBeDefined()
    if (same) {
      expect(ids(report.context_updates!)).toContain("claim")
      expect(selected(report.context_updates!, "claim").status).not.toBe("passed")
    } else {
      expect(ids(report.context_updates!)).not.toContain("claim")
      expect(await readFile(join(project, "Source.txt"), "utf8")).toBe(before)
    }
  })
})
