import { afterEach, expect, test } from "bun:test"
import { createHash } from "node:crypto"
import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { inspectAdoption, operate, readState, type Action, type Decision } from "../engine.ts"
import type { Component } from "../catalog.ts"

const temp: string[] = []
afterEach(async () => { for (const dir of temp.splice(0)) await rm(dir, { recursive: true, force: true }) })
const sha = (s: string | null) => s === null ? null : createHash("sha256").update(s).digest("hex")
const realAssets = join(import.meta.dir, "../../assets")

class Repo {
  files = new Map<string, string>()
  async read(path: string) { return this.files.get(path) ?? null }
  constructor(initial: Record<string, string> = {}) { for (const [k,v] of Object.entries(initial)) this.files.set(k,v) }
  async run(assets: string, action: Action, ids?: string[], decisions?: Decision[]) {
    const result = await operate(this, assets, action, { ids, decisions })
    for (const change of result.changes) {
      expect(await this.read(change.path)).toBe(change.before)
      if (change.after === null) this.files.delete(change.path)
      else this.files.set(change.path, change.after)
    }
    return result
  }
}

const first = "# Flow\nSee [checks](testing.md).\n"
const second = "# Tests\nRun suite.\n"
async function fixture() {
  const path = await mkdtemp(join(tmpdir(), "kane-engine-"))
  temp.push(path)
  const catalog = [
    { id: "flow", title: "Flow", default: true, parts: [{ id: "guide", path: "docs/flow.md", source: "flow.tmpl" }] },
    { id: "test", title: "Test", default: true, parts: [{ id: "guide", path: "docs/testing.md", source: "testing.tmpl" }] },
  ]
  catalog[1]!.parts[0]!.id = "suite"
  async function save(rows: Component[]) { await writeFile(join(path, "catalog.json"), JSON.stringify(rows)) }
  await save(catalog)
  await writeFile(join(path, "flow.tmpl"), first)
  await writeFile(join(path, "testing.tmpl"), second)
  return { path, catalog, save }
}
test("distributed default install, repeat, and last removal preserves the explicit project choices", async () => {
  const repo = new Repo()
  const init = await repo.run(realAssets, "init")
  expect(init.issues).toEqual([])
  expect(init.components.length).toBeGreaterThan(1)
  for (const action of ["init", "adopt", "upgrade"] as const) {
    const again = await repo.run(realAssets, action)
    expect(again.issues).toEqual([])
    expect(again.changes).toEqual([])
  }
  const removed = await repo.run(realAssets, "remove", init.components)
  expect(removed.issues).toEqual([])
  expect([...repo.files.keys()]).toEqual([".agents/harness.json"])
  expect((await inspectAdoption(repo, realAssets)).disabled).toEqual(init.components)
  expect((await repo.run(realAssets, "adopt")).changes).toEqual([])
  expect((await repo.run(realAssets, "init")).changes).toEqual([])
  const restored = await repo.run(realAssets, "add", ["testing"])
  expect(restored.issues).toEqual([])
  expect(restored.disabled).not.toContain("testing")
  await repo.run(realAssets, "remove", ["testing"])
  expect((await repo.run(realAssets, "remove", init.components)).changes).toEqual([])
})
test("mapped segments share team files and withdrawing one preserves surrounding bytes and navigation", async () => {
  const { path } = await fixture()
  const team = "# Team\r\nDo not lose this byte."
  const repo = new Repo({ "README.md": team, "AGENTS.md": "" })
  const rows: Decision[] = [
    { key: "flow/guide", mode: "append", path: "README.md", base: null, expected: sha(team), incoming: sha(first), reason: "team handbook" },
    { key: "test/suite", mode: "append", path: "README.md", base: null, expected: sha(team), incoming: sha(second), reason: "team handbook" },
  ]
  expect((await repo.run(path, "adopt", undefined, rows)).issues).toEqual([])
  const replay = await repo.run(path, "adopt", undefined, rows)
  expect(replay.issues).toEqual([])
  expect(replay.changes).toEqual([])
  expect(await repo.read("AGENTS.md")).toContain("README.md")
  expect(await repo.read("README.md")).toContain("[checks](README.md)")
  expect((await repo.run(path, "remove", ["flow"])).issues).toEqual([])
  expect(await repo.read("README.md")).toContain("Run suite.")
  expect(await repo.read("README.md")).not.toContain("# Flow")
  expect((await repo.run(path, "remove", ["test"])).issues).toEqual([])
  expect(await repo.read("README.md")).toBe(team)
  expect(await repo.read("AGENTS.md")).toBe("")
})
test("reference decisions bind existing text, future package version and the complete current file", async () => {
  const { path } = await fixture()
  const team = "# Tests\nTeam-specific command\n"
  const repo = new Repo({ "guide/qa.md": team })
  const d: Decision = { key: "test/suite", path: "guide/qa.md", mode: "reference", expected: sha(team), incoming: sha(second), base: null, reason: "existing policy" }
  const init = await repo.run(path, "adopt", undefined, [d])
  expect(init.issues).toEqual([])
  expect(await repo.read("docs/flow.md")).toContain("../guide/qa.md")
  expect(init.guards.map(f => f.path)).toContain("guide/qa.md")
  expect(await repo.read("docs/testing.md")).toBeNull()
  const next = "# Tests 2\n"
  await writeFile(join(path, "testing.tmpl"), next)
  const status = (await inspectAdoption(repo, path)).parts.find(p => p.key === d.key)!
  expect(status.previous).toBe(second)
  expect(status.next).toBe(next)
  expect(status.status).toContain("update")
  const pending = await repo.run(path, "upgrade", ["test"])
  expect(pending.issues).toHaveLength(1)
  const fresh: Decision = { ...pending.issues[0]!, mode: "keep", reason: "local command covers the updated checks" }
  repo.files.set("guide/qa.md", team + "new edit")
  expect((await repo.run(path, "upgrade", ["test"], [fresh])).changes).toEqual([])
  fresh.expected = sha(team + "new edit")
  expect((await repo.run(path, "upgrade", ["test"], [fresh])).issues).toEqual([])
  expect((await repo.run(path, "remove", ["test"])).issues).toEqual([])
  expect(await repo.read("guide/qa.md")).toBe(team + "new edit")
  expect(await repo.read("docs/flow.md")).not.toContain("guide/qa.md")
})
test("explicit three-way merge and detach preserve a project exception across upgrades and withdrawal", async () => {
  const { path } = await fixture()
  const repo = new Repo()
  expect((await repo.run(path, "init")).issues).toEqual([])
  repo.files.set("docs/testing.md", (await repo.read("docs/testing.md"))!.replace("Run suite.", "Skip heavy suite here."))
  const next = second + "Check results.\n"
  await writeFile(join(path, "testing.tmpl"), next)
  const issue = (await repo.run(path, "upgrade", ["test"])).issues[0]!
  const body = "# Tests\nSkip heavy suite here.\nCheck results.\n"
  expect((await repo.run(path, "upgrade", ["test"], [{ ...issue, mode: "merge", body, reason: "retain project exception" }])).issues).toEqual([])
  expect((await inspectAdoption(repo, path)).parts.find(p=>p.key===issue.key)!.status).toEqual(["exception"])
  expect((await repo.run(path, "upgrade", ["test"])).changes).toEqual([])
  const withdraw = await repo.run(path, "remove", ["test"])
  expect(withdraw.changes).toEqual([])
  expect((await repo.run(path, "remove", ["test"], [{ ...withdraw.issues[0]!, mode: "detach", reason: "team keeps this instruction" }])).issues).toEqual([])
  expect(await repo.read("docs/testing.md")).toBe(body)
  expect((await readState(repo)).parts.some(p=>p.key===issue.key)).toBe(false)
})
test("retired component remains visible and individually removable after upstream drops its definition", async () => {
  const { path, save, catalog } = await fixture()
  const repo = new Repo()
  await repo.run(path, "init")
  await save(catalog.slice(0, 1))
  const view = await inspectAdoption(repo, path)
  expect(view.orphans).toEqual(["test"])
  expect(view.parts.find(p=>p.key === "test/suite")!.status).toContain("retired")
  const removed = await repo.run(path, "remove", ["test"])
  expect(removed.issues).toEqual([])
  expect(await repo.read("docs/testing.md")).toBeNull()
  expect(await repo.read("docs/flow.md")).not.toContain("](testing.md)")
})
test("pre-existing empty files survive withdrawal; existing structured config requires a reference", async () => {
  const repo = new Repo({ "README.md": "", "project.yml": "owner: team\n", ".gitignore": "existing" })
  const result = await repo.run(realAssets, "adopt", ["readme", "environment", "ignore"])
  expect(result.issues).toHaveLength(3)
  const rows: Decision[] = result.issues.map(i=>({ ...i, mode: i.path === "project.yml" ? "reference" : "append", reason: "reviewed" }))
  expect((await repo.run(realAssets, "adopt", ["readme","environment","ignore"], rows.map(d=>({ ...d, mode: "append" })))).changes).toEqual([])
  expect((await repo.run(realAssets, "adopt", ["readme","environment","ignore"], rows)).issues).toEqual([])
  expect(await repo.read(".gitignore")).toContain("# kane-agent-harness:begin")
  expect((await repo.run(realAssets, "remove", ["readme","environment","ignore"])).issues).toEqual([])
  expect(await repo.read("README.md")).toBe("")
  expect(await repo.read("project.yml")).toBe("owner: team\n")
  expect(await repo.read(".gitignore")).toBe("existing")
})
test("unknown markers, damaged boundaries, and stale template decisions cannot overwrite a project", async () => {
  const { path } = await fixture()
  const repo = new Repo({ "docs/testing.md": "team" })
  const issue = (await repo.run(path, "adopt")).issues[0]!
  const d: Decision = { ...issue, mode: "append", reason: "reviewed" }
  await writeFile(join(path, "testing.tmpl"), second+"change")
  expect((await repo.run(path, "adopt", undefined, [d])).changes).toEqual([])
  d.incoming = sha(second+"change")
  expect((await repo.run(path, "adopt", undefined, [d])).issues).toEqual([])
  repo.files.set("docs/testing.md", (await repo.read("docs/testing.md"))!.replace("kane-agent-harness:end", "kane-agent-harness:begin"))
  expect((await inspectAdoption(repo, path)).parts.find(p=>p.key===d.key)!.status).toContain("invalid")
  expect((await repo.run(path, "remove", ["test"])).changes).toEqual([])
})

test("obsolete parts within a live component retire independently and local amendments require a decision", async () => {
  const { path, save, catalog } = await fixture()
  catalog[0]!.parts.push({ id: "old", path: "docs/old.md", source: "testing.tmpl" })
  await save(catalog)
  const repo = new Repo()
  await repo.run(path, "init")
  repo.files.set("docs/old.md", (await repo.read("docs/old.md"))!.replace("Run suite.", "Local rule."))
  catalog[0]!.parts.pop()
  await save(catalog)
  const result = await repo.run(path, "upgrade", ["flow"])
  expect(result.issues.map(i => i.key)).toEqual(["flow/old"])
  const retired = await repo.run(path, "upgrade", ["flow"], [{ ...result.issues[0]!, mode: "detach", reason: "retain local rule" }])
  expect(retired.issues).toEqual([])
  expect(retired.components).toContain("flow")
  expect(await repo.read("docs/old.md")).toBe("# Tests\nLocal rule.\n")
  expect((await repo.run(path, "upgrade", ["flow"])).changes).toEqual([])
  const fresh = new Repo()
  expect((await fresh.run(path, "remove", ["flow"])).changes).toEqual([])
})

test("unreviewed same-version drift requires a decision; keeping or merging it clears the drift", async () => {
  const { path } = await fixture()
  const key = "test/suite"
  const target = "CONTRIBUTING.markdown"
  const team = "# Team handbook\n"
  for (const mode of ["keep", "merge"] as const) {
    const repo = new Repo({ [target]: team })
    const mapped: Decision = { key, path: target, mode: "append", base: null, incoming: sha(second), expected: sha(team), reason: "team location" }
    const init = await repo.run(path, "adopt", undefined, [mapped])
    expect(init.issues).toEqual([])
    expect(await repo.read("docs/flow.md")).toContain("../CONTRIBUTING.markdown")
    const changed = (await repo.read(target))!.replace("Run suite.", "Run local suite.")
    repo.files.set(target, changed)
    const inspect = async () => (await inspectAdoption(repo, path)).parts.find(p => p.key === key)!
    expect((await inspect()).status).toContain("local-change")
    const result = await repo.run(path, "upgrade", ["test"])
    expect(result.changes).toEqual([])
    expect(result.issues).toHaveLength(1)
    const issue = result.issues[0]!
    expect(issue.reason).toContain("keep")
    expect(issue.reason).toContain("merge")
    expect([issue.base, issue.expected, issue.incoming]).toEqual([sha(second), sha(changed), sha(second)])
    const decision: Decision = { ...issue, mode, reason: "reviewed the local command", ...(mode === "merge" ? { body: second } : {}) }
    expect((await repo.run(path, "upgrade", ["test"], [decision])).issues).toEqual([])
    const accepted = await inspect()
    expect(accepted.status).toEqual([mode === "merge" ? "current" : "exception"])
    expect(accepted.current).toBe(mode === "merge" ? second : second.replace("Run suite.", "Run local suite."))
    expect(await repo.read(target)).toStartWith(team)
    const repeat = await repo.run(path, "upgrade", ["test"])
    expect(repeat.issues).toEqual([])
    expect(repeat.changes).toEqual([])
  }
})

test("withdrawing an ignore block preserves the boundary between the team's original and later lines", async () => {
  const original = "dist/"
  const repo = new Repo({ ".gitignore": original })
  const plan = await repo.run(realAssets, "adopt", ["ignore"])
  const append: Decision = { ...plan.issues[0]!, mode: "append", reason: "extend project ignores" }
  expect((await repo.run(realAssets, "adopt", ["ignore"], [append])).issues).toEqual([])
  repo.files.set(".gitignore", (await repo.read(".gitignore"))! + "coverage/\n")
  expect((await repo.run(realAssets, "remove", ["ignore"])).issues).toEqual([])
  expect(await repo.read(".gitignore")).toBe("dist/\ncoverage/\n")
})

test("references can share team files, but a whole-file harness owner cannot serve as team evidence", async () => {
  const { path, catalog, save } = await fixture()
  catalog[0]!.parts[0]!.path = "project.yml"
  await save(catalog)
  const version = "tool: one\n"
  await writeFile(join(path, "flow.tmpl"), version)
  const ref: Decision = { key: "test/suite", path: "project.yml", mode: "reference", expected: sha(version), incoming: sha(second), base: null, reason: "existing team evidence" }
  const repo = new Repo({ "team.yml": version })
  expect((await repo.run(path, "init", ["flow"])).issues).toEqual([])
  const later = await repo.run(path, "add", ["test"], [ref])
  expect(later.issues.some(i => i.reason.includes("整文件"))).toBe(true)
  expect(later.changes).toEqual([])
  const same = await new Repo().run(path, "init", undefined, [{ ...ref, expected: null }])
  expect(same.issues.some(i => i.reason.includes("整文件"))).toBe(true)
  const team = new Repo({ "team.yml": version })
  const shared = await team.run(path, "init", undefined, [
    { ...ref, path: "team.yml" }, { ...ref, key: "flow/guide", path: "team.yml", incoming: sha(version) },
  ])
  expect(shared.issues).toEqual([])
  expect((await inspectAdoption(team, path)).parts.every(p => p.status.includes("reference"))).toBe(true)
  expect((await repo.run(path, "add", ["test"], [{ ...ref, path: "team.yml" }])).issues).toEqual([])
  const saved = await readState(repo)
  saved.parts.find(p => p.key === ref.key)!.path = "project.yml"
  saved.navigation!.installed = saved.navigation!.installed.replaceAll("team.yml", "project.yml")
  repo.files.set("AGENTS.md", (await repo.read("AGENTS.md"))!.replaceAll("team.yml", "project.yml"))
  repo.files.set(".agents/harness.json", JSON.stringify(saved, null, 2) + "\n")
  expect((await inspectAdoption(repo, path)).issues.some(i => i.key === ref.key)).toBe(true)
  await writeFile(join(path, "flow.tmpl"), "tool: two\n")
  const blocked = await repo.run(path, "upgrade", ["flow"])
  expect(blocked.issues.some(i => i.key === ref.key && i.reason.includes("整文件"))).toBe(true)
  expect(blocked.changes).toEqual([])
  expect(await repo.read("project.yml")).toBe(version)
  expect((await repo.run(path, "remove", ["test"])).issues).toEqual([])
  expect((await repo.run(path, "upgrade", ["flow"])).issues).toEqual([])
  expect(await repo.read("project.yml")).toBe("tool: two\n")
})
