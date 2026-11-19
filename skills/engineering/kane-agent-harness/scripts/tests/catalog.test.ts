import { afterEach, expect, test } from "bun:test"
import { createHash } from "node:crypto"
import { mkdtemp, rm, symlink, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { loadCatalog, readBody, type Component } from "../catalog"
import { operate, type Action, type Decision } from "../engine"
import { checkLinks } from "../links"

const assets = join(import.meta.dir, "../../assets")
const temp: string[] = []

afterEach(async () => {
  for (const dir of temp.splice(0)) await rm(dir, { recursive: true, force: true })
})

async function scratch() {
  const dir = await mkdtemp(join(tmpdir(), "kane-harness-catalog-"))
  temp.push(dir)
  return dir
}

function component(id: string, path: string): Component {
  return { id, title: id, default: true, parts: [{ id, path, source: id + ".tmpl" }] }
}

async function fixture(dir: string, rows: unknown) {
  await writeFile(join(dir, "catalog.json"), JSON.stringify(rows))
  return loadCatalog(dir)
}

function projectDocs(initial: Record<string, string> = {}) {
  const files = new Map(Object.entries(initial))
  const read = async (path: string) => files.get(path) ?? null
  async function apply(action: Action, ids?: string[], decisions?: Decision[]) {
    const result = await operate({ read }, assets, action, { ids, decisions })
    expect(result.issues).toEqual([])
    for (const change of result.changes) {
      if (change.after === null) files.delete(change.path)
      else files.set(change.path, change.after)
    }
  }
  function targets(path: string) {
    const paths = new Set<string>()
    Bun.markdown.render(files.get(path)!, { link(text, { href }) {
      paths.add(join(dirname(path), decodeURIComponent(href)))
      return text
    } })
    return paths
  }
  return { files, read, apply, targets }
}

test("every bundled component installs alone with readable navigation and valid local links", async () => {
  for (const component of await loadCatalog(assets)) {
    const result = await operate({ read: async () => null }, assets, "init", { ids: [component.id] })
    expect(result.issues).toEqual([])
    expect(result.components).toEqual([component.id])
    const files = new Map(result.changes.map(change => [change.path, change.after]))
    for (const part of component.parts) {
      expect(files.get(part.path)?.trim()).toBeTruthy()
      expect(files.get("AGENTS.md")).toContain(part.path)
    }
    const errors = await checkLinks(async path => files.get(path) ?? null, [...files.keys()])
    expect(errors).toEqual([])
  }
})

test("the default collaboration entry is usable and independent review can be withdrawn", async () => {
  const { files, apply, targets, read } = projectDocs()
  await apply("init")
  const entry = files.get("AGENTS.md")!
  for (const command of ["/compact", "/handoff", "/fork"]) expect(entry).toContain(command)
  for (const body of [entry, files.get("README.md")!]) expect(body).not.toMatch(/【(?:填写|项目名称|实际入口)/)
  const review = files.get("docs/independent-review.md")!
  for (const sample of ["全新", "背景文件", "不同模型", "工具输出", "证据"]) expect(review).toContain(sample)

  const workflow = "docs/workflow.md"
  for (const target of ["specs/requirements.md", "docs/independent-review.md"]) {
    expect(targets("AGENTS.md")).toContain(target)
    expect(targets(workflow)).toContain(target)
  }
  await apply("remove", ["independent-review"])
  expect(files.has("docs/independent-review.md")).toBe(false)
  expect(targets(workflow)).not.toContain("docs/independent-review.md")
  expect(targets(workflow)).toContain("specs/requirements.md")
  for (const [path, body] of files) if (path.endsWith(".md")) expect(body).not.toContain("独立审阅")
  expect(await checkLinks(read, [...files.keys()])).toEqual([])
})

test("workflow installed alone gains and drops the route to a team's adopted PRD", async () => {
  const path = "product/退款 PRD.md"
  const body = "# 退款\n\n客户在结算前取消时，款项必须原路退回。\n"
  const workflow = "docs/workflow.md"
  const { files, read, apply, targets } = projectDocs({ [path]: body })
  await apply("adopt", ["workflow"])
  expect(targets("AGENTS.md")).toContain(workflow)
  expect(targets(workflow)).not.toContain("specs/requirements.md")
  expect(targets(workflow)).not.toContain("docs/independent-review.md")

  const pending = await operate({ read }, assets, "add", { ids: ["requirements"] })
  expect(pending.issues).toHaveLength(1)
  const expected = createHash("sha256").update(body).digest("hex")
  await apply("add", ["requirements"], [{
    ...pending.issues[0]!, path, mode: "reference", expected, reason: "团队维护的退款规格",
  }])
  for (const source of ["AGENTS.md", workflow]) {
    expect(targets(source)).toContain(path)
    expect(targets(source)).not.toContain("specs/requirements.md")
  }
  expect(files.has("specs/requirements.md")).toBe(false)
  expect(await checkLinks(read, [...files.keys()])).toEqual([])

  await apply("remove", ["requirements"])
  expect(files.get(path)).toBe(body)
  for (const source of ["AGENTS.md", workflow]) expect(targets(source)).not.toContain(path)
  expect(await checkLinks(read, [...files.keys()])).toEqual([])
})

test("the catalog permits multiple Markdown sections and rejects ambiguous ownership or private paths", async () => {
  const dir = await scratch()
  const shared = [component("first", "docs/team.md"), component("second", "docs/team.md")]
  expect(await fixture(dir, shared)).toEqual(shared)
  for (const paths of [
    ["project.yml", "project.yml"], ["docs", "docs/team.md"], ["docs/a.md", "Docs/b.md"], ["agents.md"],
    ["../rules.md"], [".git/config"], [".agents/harness.json"], [".agents/cache/file"], [".ssh/known_hosts"],
    [".env.local"], [".kane-harness-pending.json"],
  ]) {
    const rows = paths.map((path, index) => component("item-" + index, path))
    await expect(fixture(dir, rows)).rejects.toThrow()
  }
})

test("the catalog rejects duplicate identifiers, invalid metadata and unsafe source files", async () => {
  const dir = await scratch()
  const item = component("rules", "guide.md")
  const part = item.parts[0]!
  for (const rows of [
    [item, item],
    [item, { ...component("second", "other.md"), parts: [part] }],
    [{ ...item, id: "Upper" }], [{ ...item, title: " " }], [{ ...item, default: "yes" }],
    [{ ...item, parts: [] }], [{ ...item, parts: [{ ...part, source: "../outside.tmpl" }] }],
  ]) {
    await expect(fixture(dir, rows)).rejects.toThrow()
  }
  const outside = await scratch()
  await writeFile(join(outside, "other.tmpl"), "private\n")
  await symlink(join(outside, "other.tmpl"), join(dir, "link.tmpl"))
  await symlink(outside, join(dir, "linked-directory"))
  await writeFile(join(dir, "empty.tmpl"), " \n")
  await writeFile(join(dir, "marked.tmpl"), "# kane-agent-harness:begin\n")
  for (const source of ["link.tmpl", "linked-directory/other.tmpl", "missing.tmpl", "empty.tmpl", "marked.tmpl"]) {
    await expect(readBody(dir, { ...part, source })).rejects.toThrow()
  }
})
