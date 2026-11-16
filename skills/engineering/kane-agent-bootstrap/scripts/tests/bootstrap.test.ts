import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { createHash } from "node:crypto"
import { chmod, cp, lstat, mkdir, mkdtemp, readFile, readdir, rename, rm, stat, symlink, utimes, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"

const skill = resolve(import.meta.dir, "../..")
const cli = join(skill, "scripts/main.ts")
const sha = (value: string | Uint8Array) => createHash("sha256").update(value).digest("hex")

type FilePlan = { path: string; expected_sha256: string | null; content?: string; asset?: string }
type Finding = { status: string; code: string }
type Report = {
  schema_version: number
  status: string
  scope?: string
  receipt?: string
  files?: { path: string; status: string }[]
  commands?: { name: string; source: string; working_directory: string }[]
  findings?: Finding[]
  source_groups?: Record<string, unknown>
  blocked_stages?: string[]
  runtime_verified?: boolean
  business_verified?: boolean
  commands_executed?: number
}

let base = ""
let project = ""

beforeEach(async () => {
  base = await mkdtemp(join(tmpdir(), "bun-bootstrap-test-"))
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

async function plan(files: FilePlan[]) {
  const path = join(base, "plan.json")
  await writeFile(path, JSON.stringify({ schema_version: 1, files }))
  return path
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
  return { report, stdout, stderr, code }
}

async function seed(environment?: Record<string, unknown>) {
  await write("AGENTS.md", "# Project\n\nRead [environment](project.yml).\n")
  await write("project.yml", JSON.stringify({
    schema_version: 1,
    project: { name: "fixture", purpose: "A disposable command-line application", language: "zh-CN", timezone: "Asia/Shanghai" },
    environment: environment ?? { supported_platforms: null, toolchains: [], commands: {}, services: [], tools: [], variables: [], local_paths: {} },
    requirements: { filesystem: [], network: [] },
    guides: {},
  }))
}

async function context(facts: Record<string, unknown>[]) {
  const path = join(base, "context.json")
  await writeFile(path, JSON.stringify({ schema_version: 1, facts }))
  return path
}

describe("file application", () => {
  test("creates final text and copies an eligible packaged asset", async () => {
    const path = await plan([
      { path: "AGENTS.md", expected_sha256: null, content: "# Personal project\n\n明确目标，完成验证。\n" },
      { path: "docs/git.md", expected_sha256: null, asset: "base/docs/git.md" },
    ])
    await run(["apply", project, "--plan", path])
    expect(await readFile(join(project, "AGENTS.md"), "utf8")).toContain("明确目标")
    const catalog = JSON.parse(await readFile(join(skill, "assets/catalog.json"), "utf8")) as { files: { asset: string; file: string }[] }
    const asset = catalog.files.find(entry => entry.asset === "base/docs/git.md")!
    expect(await readFile(join(project, "docs/git.md"))).toEqual(await readFile(join(skill, "assets", asset.file)))
  })

  test("guards an existing edit by hash and preserves its mode", async () => {
    const target = await write("AGENTS.md", "# Existing rules\n")
    await chmod(target, 0o640)
    const path = await plan([{ path: "AGENTS.md", expected_sha256: sha("# Existing rules\n"), content: "# Existing rules\n\nPreserve personal choices.\n" }])
    await run(["apply", project, "--plan", path])
    expect(await readFile(target, "utf8")).toContain("Preserve personal choices")
    expect((await stat(target)).mode & 0o777).toBe(0o640)
  })

  test("repeat application preserves bytes, mtime and receipt inventory", async () => {
    const path = await plan([{ path: "AGENTS.md", expected_sha256: null, content: "# Stable\n" }])
    await run(["apply", project, "--plan", path, "--receipt", ".agents/state/bootstrap/stable.json"])
    const target = join(project, "AGENTS.md")
    await utimes(target, 1600000000, 1600000000)
    const before = await stat(target)
    const receipts = await readdir(join(project, ".agents/state/bootstrap"))
    await run(["apply", project, "--plan", path, "--receipt", ".agents/state/bootstrap/stable.json"])
    expect(await readFile(target, "utf8")).toBe("# Stable\n")
    expect((await stat(target)).mtimeMs).toBe(before.mtimeMs)
    expect(await readdir(join(project, ".agents/state/bootstrap"))).toEqual(receipts)
  })

  test("stale preconditions refuse every planned write", async () => {
    await write("AGENTS.md", "# Initial\n")
    const path = await plan([
      { path: "docs/new.md", expected_sha256: null, content: "new\n" },
      { path: "AGENTS.md", expected_sha256: sha("# Initial\n"), content: "# Planned edit\n" },
    ])
    await write("AGENTS.md", "# Another session's work\n")
    await run(["apply", project, "--plan", path], [1])
    expect(await readFile(join(project, "AGENTS.md"), "utf8")).toBe("# Another session's work\n")
    expect(await exists(join(project, "docs"))).toBe(false)
    expect(await exists(join(project, ".agents"))).toBe(false)
  })

  test("unknown existing content is not overwritten", async () => {
    await write("AGENTS.md", "# My own rules\n")
    const path = await plan([{ path: "AGENTS.md", expected_sha256: null, content: "# Replacement\n" }])
    await run(["apply", project, "--plan", path], [1])
    expect(await readFile(join(project, "AGENTS.md"), "utf8")).toBe("# My own rules\n")
  })

  test("dry run creates neither directories nor receipts", async () => {
    await write("AGENTS.md", "# Before\n")
    const path = await plan([
      { path: "AGENTS.md", expected_sha256: sha("# Before\n"), content: "# After\n" },
      { path: "docs/deep/new.md", expected_sha256: null, content: "new\n" },
    ])
    await run(["apply", project, "--plan", path, "--dry-run"])
    expect(await readFile(join(project, "AGENTS.md"), "utf8")).toBe("# Before\n")
    expect(await exists(join(project, "docs"))).toBe(false)
    expect(await exists(join(project, ".agents"))).toBe(false)
  })

  test("dry run validates receipt boundaries, overlap and existing recovery records", async () => {
    const path = await plan([{ path: "AGENTS.md", expected_sha256: null, content: "# New\n" }])
    await write("receipt.json", "preserve recovery record\n")
    for (const receipt of ["../escape.json", "AGENTS.md", "receipt.json"]) {
      await run(["apply", project, "--plan", path, "--receipt", receipt, "--dry-run"], [2])
    }
    expect(await exists(join(project, "AGENTS.md"))).toBe(false)
    expect(await exists(join(project, ".agents"))).toBe(false)
    expect(await readFile(join(project, "receipt.json"), "utf8")).toBe("preserve recovery record\n")
  })

  test("a failed second write preserves completed work and a usable recovery receipt", async () => {
    const path = await plan([
      { path: "first.md", expected_sha256: null, content: "first\n" },
      { path: "second.md", expected_sha256: null, content: "second\n" },
      { path: "third.md", expected_sha256: null, content: "third\n" },
    ])
    const { applyPlan } = await import("../main")
    const report = await applyPlan(project, path, { beforeWrite: async (_path: string, index: number) => {
      if (index === 1) throw new Error("injected write failure")
    } })
    expect(report.status).toBe("failed")
    expect(report.partial).toBe(true)
    expect(report.completed).toContain("first.md")
    expect(typeof report.receipt).toBe("string")
    expect(await readFile(join(project, "first.md"), "utf8")).toBe("first\n")
    expect(await exists(join(project, "second.md"))).toBe(false)
    expect(await exists(join(project, "third.md"))).toBe(false)
    await run(["recover", project, "--receipt", report.receipt as string])
    expect(await exists(join(project, "first.md"))).toBe(false)
  })

  test("a changed parent directory cannot redirect an anchored write outside the project", async () => {
    await mkdir(join(project, "docs"))
    const outside = join(base, "outside")
    await mkdir(outside)
    const path = await plan([{ path: "docs/new.md", expected_sha256: null, content: "owned\n" }])
    const { applyPlan } = await import("../main")
    await applyPlan(project, path, { beforeWrite: async () => {
      await rename(join(project, "docs"), join(project, "moved-docs"))
      await symlink(outside, join(project, "docs"), "dir")
    } })
    expect(await exists(join(outside, "new.md"))).toBe(false)
    expect((await lstat(join(project, "docs"))).isSymbolicLink()).toBe(true)
  })

  test("traversal, absolute and case-variant Git metadata paths are refused", async () => {
    const original = "[core]\n\trepositoryformatversion = 0\n"
    await write(".git/config", original)
    for (const path of ["../escape.md", join(base, "absolute.md"), ".git/config", ".GIT/config"]) {
      const input = await plan([{ path, expected_sha256: null, content: "unsafe\n" }])
      await run(["apply", project, "--plan", input], [1, 2])
    }
    expect(await exists(join(base, "escape.md"))).toBe(false)
    expect(await exists(join(base, "absolute.md"))).toBe(false)
    expect(await readFile(join(project, ".git/config"), "utf8")).toBe(original)
  })

  test("case and Unicode aliases are rejected during preflight without receipts", async () => {
    for (const paths of [["AGENTS.md", "agents.md"], ["Docs", "docs/a.md"], ["caf\u00e9.md", "cafe\u0301.md"]]) {
      const input = await plan(paths.map(path => ({ path, expected_sha256: null, content: "planned\n" })))
      await run(["apply", project, "--plan", input], [1, 2])
      expect(await readdir(project)).toEqual([])
    }
  })

  test("symlink parents cannot redirect a write", async () => {
    const outside = join(base, "outside")
    await mkdir(outside)
    await symlink(outside, join(project, "docs"), "dir")
    const path = await plan([{ path: "docs/new.md", expected_sha256: null, content: "unsafe\n" }])
    await run(["apply", project, "--plan", path], [1, 2])
    expect(await exists(join(outside, "new.md"))).toBe(false)
    expect((await lstat(join(project, "docs"))).isSymbolicLink()).toBe(true)
  })

  test("symlink targets cannot overwrite external content", async () => {
    const outside = join(base, "outside.md")
    await writeFile(outside, "external\n")
    await symlink(outside, join(project, "AGENTS.md"))
    const path = await plan([{ path: "AGENTS.md", expected_sha256: sha("external\n"), content: "unsafe\n" }])
    await run(["apply", project, "--plan", path], [1, 2])
    expect(await readFile(outside, "utf8")).toBe("external\n")
  })

  test("assets cannot escape or instantiate a semantic template", async () => {
    for (const asset of ["../SKILL.md", "templates/AGENTS.md"]) {
      const path = await plan([{ path: "AGENTS.md", expected_sha256: null, asset }])
      await run(["apply", project, "--plan", path], [1, 2])
      expect(await exists(join(project, "AGENTS.md"))).toBe(false)
    }
  })

  test("ambiguous content and asset fields are rejected", async () => {
    const path = await plan([{ path: "new.md", expected_sha256: null, content: "text\n", asset: "base/docs/git.md" }])
    await run(["apply", project, "--plan", path], [2])
    expect(await exists(join(project, "new.md"))).toBe(false)
  })

  test("secret and receipt-storage targets are refused", async () => {
    for (const path of [".env", "private.pem", ".agents/state/bootstrap/own.json"]) {
      const input = await plan([{ path, expected_sha256: null, content: "do not copy secrets\n" }])
      await run(["apply", project, "--plan", input], [1, 2])
      expect(await exists(join(project, path))).toBe(false)
    }
  })
})

describe("read-only evidence", () => {
  test("inspection does not execute scripts or disclose environment values", async () => {
    const secret = "fixture-secret-never-emit-3948"
    const sample = "fixture-example-value-never-emit-8821"
    const marker = join(project, "script-ran")
    await write(".env", `API_TOKEN=${secret}\n`)
    await write(".env.example", `API_TOKEN=${sample}\n`)
    await write("package.json", JSON.stringify({ scripts: { test: `touch ${marker}`, preinstall: `echo ${secret}` } }))
    const { report, stdout } = await run(["inspect", project])
    expect(await exists(marker)).toBe(false)
    expect(stdout).not.toContain(secret)
    expect(stdout).not.toContain(sample)
    expect(stdout).not.toContain(sha(`API_TOKEN=${secret}\n`))
    expect(report.files?.map(file => file.path)).not.toContain(".env")
    expect(report.commands?.map(command => command.name)).toContain("test")
    expect(report.scope).toBe("read_only")
  })

  test("inspection finds mixed stacks and nested command working directories", async () => {
    await write("services/api/pyproject.toml", '[project]\nname = "fixture-api"\n')
    await write("worker/go.mod", "module example.invalid/worker\n\ngo 1.22\n")
    await write("services/ui/package.json", JSON.stringify({ scripts: { check: "echo checked" } }))
    const { report } = await run(["inspect", project])
    const paths = report.files?.map(file => file.path) ?? []
    expect(paths).toContain("services/api/pyproject.toml")
    expect(paths).toContain("worker/go.mod")
    expect(report.commands?.find(command => command.source === "services/ui/package.json")?.working_directory).toBe("services/ui")
    expect(await exists(join(project, ".git"))).toBe(false)
  })

  test("inspection indexes multiple source groups without leaking local configuration", async () => {
    const secret = JSON.stringify({ token: "fixture-local-secret-never-emit-1763" })
    await write(".agents/config.local.json", secret)
    await write("AGENTS.md", "# Project\n")
    await write("README.md", "# Product\n")
    await write("package.json", "{}\n")
    await write("tests/example.test.ts", "export {}\n")
    await write("examples/input.csv", "name,value\na,1\n")
    const { report, stdout } = await run(["inspect", project])
    expect(stdout).not.toContain("fixture-local-secret-never-emit-1763")
    expect(stdout).not.toContain(sha(secret))
    expect(report.files?.map(file => file.path)).not.toContain(".agents/config.local.json")
    for (const group of ["instructions", "configuration", "documentation", "tests", "samples", "history"]) {
      expect(report.source_groups).toHaveProperty(group)
    }
  })

  test("case-variant Agent state and local configuration remain private", async () => {
    const local = JSON.stringify({ token: "fixture-case-local-secret-4829" })
    const state = "fixture-case-state-secret-5610\n"
    await write(".AGENTS/config.local.json", local)
    await write(".AGENTS/state/events.md", state)
    const { report, stdout } = await run(["inspect", project])
    const paths = report.files?.map(file => file.path.toLowerCase()) ?? []
    expect(paths).not.toContain(".agents/config.local.json")
    expect(paths).not.toContain(".agents/state/events.md")
    expect(stdout).not.toContain("fixture-case-local-secret-4829")
    expect(stdout).not.toContain(sha(local))
    expect(stdout).not.toContain(sha(state))
    await seed()
    for (const [ref, content] of [[".AGENTS/config.local.json", local], [".AGENTS/state/events.md", state]]) {
      const ctx = await context([{ id: "private", statement: "Private state", status: "confirmed", sources: [{ kind: "file", ref, sha256: sha(content) }], blocks: [] }])
      await run(["verify", project, "--context", ctx], [1, 2])
    }
  })
})

describe("static verification", () => {
  test("static success does not claim runtime or business readiness", async () => {
    await seed()
    const { report } = await run(["verify", project])
    expect(report.scope).toBe("static_only")
    expect(report.runtime_verified).toBe(false)
    expect(report.business_verified).toBe(false)
  })

  test("unknown declarations remain distinct from confirmed-empty collections", async () => {
    await seed({ toolchains: null, commands: null, services: null, tools: null, variables: null, local_paths: null })
    const { report: unknown } = await run(["verify", project], [0, 1])
    await seed()
    const { report: empty } = await run(["verify", project])
    const count = (report: Report) => report.findings?.filter(item => ["warning", "unverified"].includes(item.status)).length ?? 0
    expect(count(unknown)).toBeGreaterThan(count(empty))
    expect(unknown.runtime_verified).toBe(false)
  })

  test("missing targets and code-only heading anchors fail", async () => {
    await seed()
    await write("README.md", "# Overview\n\n[Missing](gone.md)\n[Wrong anchor](#absent)\n\n```md\n# Absent\n```\n")
    const { report } = await run(["verify", project], [1])
    expect(report.findings?.filter(item => item.status === "failed").length).toBeGreaterThanOrEqual(2)
  })

  test("inline and fenced link examples are ignored", async () => {
    await seed()
    await write("README.md", "# Overview\n\n`[inline](not-real.md)`\n\n```md\n[fenced](not-real-either.md)\n```\n")
    await run(["verify", project])
  })

  test("reference links and Setext headings are checked", async () => {
    await seed()
    await write("guide.md", "# Guide\n\nUsage\n-----\n\nFollow the project workflow.\n")
    const valid = "# Overview\n\n[Guide][guide]\n[Usage](guide.md#usage)\n\n[guide]: guide.md#guide\n"
    await write("README.md", valid)
    await run(["verify", project])
    await write("README.md", `${valid}\n[Missing][lost]\n\n[lost]: absent.md\n`)
    await run(["verify", project], [1])
  })

  test("malformed YAML and duplicate keys are rejected", async () => {
    await seed()
    for (const content of ["schema_version: 1\nproject: [unterminated\n", "schema_version: 1\nproject:\n  name: first\n  name: second\nenvironment: {}\n"]) {
      await write("project.yml", content)
      await run(["verify", project], [1])
    }
  })

  test("adopted placeholders fail while retained templates remain valid", async () => {
    await seed()
    await write("AGENTS.md", "# Project\n\n【填写当前项目职责】\n")
    await run(["verify", project], [1])
    await write("AGENTS.md", "# Project\n")
    await write("docs/TEMPLATE.md", "# Template\n\n【填写当前模块职责】\n")
    await run(["verify", project])
  })

  test("command template syntax and manual steps are not executed", async () => {
    const marker = join(project, "manual-command-ran")
    await seed({ commands: {
      health: { run: "docker inspect --format '{{.State.Health.Status}}' app", working_directory: ".", definition_source: "README.md#manual", prerequisites: [], side_effects: [] },
      manual: { run: `Review the fixture, then touch ${marker}`, working_directory: ".", definition_source: "README.md#manual", prerequisites: [], side_effects: [] },
    } })
    await write("README.md", "# Manual\n\nFollow the project procedure.\n")
    const { report } = await run(["verify", project])
    expect(await exists(marker)).toBe(false)
    expect(report.commands_executed).toBe(0)
    expect(report.runtime_verified).toBe(false)
  })

  test("selected checks isolate an unrelated baseline but not out-of-root files", async () => {
    await seed()
    await write("old.md", "[Known old broken link](missing.md)\n")
    await run(["verify", project], [1])
    await run(["verify", project, "--paths", "AGENTS.md", "project.yml"])
    await writeFile(join(base, "outside.md"), "# Outside\n")
    await run(["verify", project, "--paths", "../outside.md"], [1, 2])
  })
})

describe("context evidence", () => {
  test("confirmed facts require a source", async () => {
    await seed()
    const path = await context([{ id: "goal", statement: "Known goal", status: "confirmed", sources: [], blocks: [] }])
    await run(["verify", project, "--context", path], [1, 2])
  })

  test("stale file evidence is rejected without applying changes", async () => {
    await seed()
    await write("README.md", "# Actual\n")
    const ctx = await context([{ id: "goal", statement: "Current project purpose", status: "confirmed", sources: [{ kind: "file", ref: "README.md", sha256: sha("# Old\n") }], blocks: [] }])
    const path = await plan([{ path: "new.md", expected_sha256: null, content: "new\n" }])
    await run(["apply", project, "--plan", path, "--context", ctx], [1, 2])
    expect(await exists(join(project, "new.md"))).toBe(false)
  })

  test("unanswered apply blockers do not become defaults", async () => {
    const ctx = await context([{ id: "conflict", statement: "Conflicting workflow", status: "conflicting", sources: [], blocks: ["apply"] }])
    const path = await plan([{ path: "new.md", expected_sha256: null, content: "new\n" }])
    await run(["apply", project, "--plan", path, "--context", ctx], [1])
    expect(await exists(join(project, "new.md"))).toBe(false)
    expect(await exists(join(project, ".agents"))).toBe(false)
  })

  test("runtime gaps remain visible without blocking independent file adoption", async () => {
    await seed()
    const ctx = await context([{ id: "service", statement: "Test service location unknown", status: "unknown", sources: [], blocks: ["runtime", "business"] }])
    const path = await plan([{ path: "docs/ready.md", expected_sha256: null, content: "# Documentation\n" }])
    await run(["apply", project, "--plan", path, "--context", ctx])
    const { report } = await run(["verify", project, "--context", ctx])
    expect(report.runtime_verified).toBe(false)
    expect(report.business_verified).toBe(false)
    expect(JSON.stringify(report)).toContain("runtime")
    expect(await exists(join(project, "docs/ready.md"))).toBe(true)
  })
})

describe("receipts and recovery", () => {
  test("a receipt restores edited files and removes only matching newly created files", async () => {
    const original = await write("AGENTS.md", "# Before\n")
    await chmod(original, 0o640)
    const path = await plan([
      { path: "AGENTS.md", expected_sha256: sha("# Before\n"), content: "# After\n" },
      { path: "docs/new.md", expected_sha256: null, content: "# New\n" },
    ])
    const { report } = await run(["apply", project, "--plan", path])
    expect(typeof report.receipt).toBe("string")
    const receipt = report.receipt!
    expect((await stat(join(project, receipt))).mode & 0o777).toBe(0o600)
    await run(["recover", project, "--receipt", receipt, "--dry-run"])
    expect(await readFile(original, "utf8")).toBe("# After\n")
    await run(["recover", project, "--receipt", receipt])
    expect(await readFile(original, "utf8")).toBe("# Before\n")
    expect((await stat(original)).mode & 0o777).toBe(0o640)
    expect(await exists(join(project, "docs/new.md"))).toBe(false)
    expect(await exists(join(project, "docs"))).toBe(true)
    const before = (await stat(original)).mtimeMs
    await run(["recover", project, "--receipt", receipt])
    expect((await stat(original)).mtimeMs).toBe(before)
  })

  test("recovery conflicts preserve every current file", async () => {
    await write("one.md", "one-before\n")
    await write("two.md", "two-before\n")
    const path = await plan([
      { path: "one.md", expected_sha256: sha("one-before\n"), content: "one-after\n" },
      { path: "two.md", expected_sha256: sha("two-before\n"), content: "two-after\n" },
    ])
    const { report } = await run(["apply", project, "--plan", path])
    await write("two.md", "another-session\n")
    await run(["recover", project, "--receipt", report.receipt!], [1])
    expect(await readFile(join(project, "one.md"), "utf8")).toBe("one-after\n")
    expect(await readFile(join(project, "two.md"), "utf8")).toBe("another-session\n")
  })

  test("recovery preserves later permission changes and does not restore other items", async () => {
    const target = await write("one.md", "one-before\n")
    await chmod(target, 0o644)
    await write("two.md", "two-before\n")
    const path = await plan([
      { path: "one.md", expected_sha256: sha("one-before\n"), content: "one-after\n" },
      { path: "two.md", expected_sha256: sha("two-before\n"), content: "two-after\n" },
    ])
    const { report } = await run(["apply", project, "--plan", path])
    await chmod(target, 0o600)
    await run(["recover", project, "--receipt", report.receipt!], [1])
    expect(await readFile(target, "utf8")).toBe("one-after\n")
    expect((await stat(target)).mode & 0o777).toBe(0o600)
    expect(await readFile(join(project, "two.md"), "utf8")).toBe("two-after\n")
  })

  test("an external or symlink receipt cannot authorize recovery", async () => {
    const outside = join(base, "outside.json")
    await writeFile(outside, "{}\n")
    await symlink(outside, join(project, "receipt.json"))
    for (const receipt of ["../outside.json", "receipt.json"]) {
      await run(["recover", project, "--receipt", receipt], [1, 2])
    }
    expect(await readFile(outside, "utf8")).toBe("{}\n")
  })

  test("custom receipts do not overwrite preexisting user files", async () => {
    await write("receipt.json", "user-owned\n")
    const path = await plan([{ path: "AGENTS.md", expected_sha256: null, content: "# Project\n" }])
    await run(["apply", project, "--plan", path, "--receipt", "receipt.json"], [1, 2])
    expect(await readFile(join(project, "receipt.json"), "utf8")).toBe("user-owned\n")
    expect(await exists(join(project, "AGENTS.md"))).toBe(false)
  })
})

test("the copied package can operate without its original directory layout", async () => {
  const target = join(base, "copied-skill")
  await cp(skill, target, { recursive: true, filter: source => !source.includes("node_modules") && !source.endsWith(".py") && !source.includes("__pycache__") })
  const dependency = join(skill, "scripts/node_modules")
  if (await exists(dependency)) await symlink(dependency, join(target, "scripts/node_modules"), "dir")
  await write("pyproject.toml", '[project]\nname = "fixture"\n')
  const { report } = await run(["inspect", project], [0], join(target, "scripts/main.ts"))
  expect(report.files?.map(file => file.path)).toContain("pyproject.toml")
})
