import { afterEach, beforeEach, expect, test } from "bun:test"
import { cp, mkdir, mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { digest } from "../templates"
import { operate } from "../engine"
import { Project } from "../io"

let root: string
let project: string
let main: string
const key = "requirements/requirements"
const initial = "specs/requirements.md"
const prd = "product/退款 PRD.md"
const moved = "product/现行规格.md"
const official = "# 退款\r\n\r\n## 验收\r\n\r\n重复退款只入账一次。"
const id = ["--id", "requirements"]
const read = (file: string) => readFile(join(project, file), "utf8")
const write = (file: string, body: string) => writeFile(join(project, file), body)

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "harness-reroute-"))
  project = join(root, "project")
  main = join(root, "skill/scripts/main.ts")
  await cp(join(import.meta.dir, "../.."), join(root, "skill"), { recursive: true })
  await mkdir(project)
})
afterEach(async () => { await rm(root, { recursive: true, force: true }) })

async function cli(args: string[], exit = 0) {
  const proc = Bun.spawn([process.execPath, main, ...args], { stdout: "pipe", stderr: "pipe" })
  const [out, err, code] = await Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text(), proc.exited])
  expect(code, out + err).toBe(exit)
  return JSON.parse(out || err)
}

async function decide(from: string, path: string) {
  const [part] = (await cli(["status", project, ...id, "--detail"])).parts
  return {
    key, mode: "reference" as const, reason: "已逐条核对新 PRD 的现行行为和验收依据",
    from, fromExpected: (await cli(["fingerprint", project, from])).sha256,
    fromBaseline: part.fromBaseline,
    path, expected: (await cli(["fingerprint", project, path])).sha256, base: part.base, incoming: part.incoming,
  }
}

async function prepare() {
  await cli(["apply", "init", project, ...id, "--id", "workflow"])
  await mkdir(join(project, "product"))
  await write(prd, official)
}

async function command(op: "apply" | "plan", action: "upgrade" | "adopt", decision: object, exit = 0) {
  const path = join(root, "decision.json")
  await writeFile(path, JSON.stringify(Array.isArray(decision) ? decision : [decision]))
  return cli([op, action, project, ...id, "--decisions", path, "--diff"], exit)
}

function links(text: string) {
  const result: string[] = []
  Bun.markdown.render(text, { link(label, { href }) { result.push(decodeURIComponent(href)); return label } })
  return result
}

async function customizeWorkflow(addition: string) {
  const [part] = (await cli(["status", project, "--id", "workflow", "--detail"])).parts
  const path = join(root, "workflow.json")
  await writeFile(path, JSON.stringify([{ key: part.key, mode: "merge", path: part.path,
    body: part.current + addition, reason: "支付组的专项验收", expected: part.expected, base: part.base, incoming: part.incoming }]))
  await cli(["apply", "upgrade", project, "--id", "workflow", "--decisions", path])
  return part
}

test("one decision rebinds a filled template, preserving team text, workflow links, navigation and replay", async () => {
  await prepare()
  const old = await read(initial)
  const inside = "## 旧验收\n\n人工复核冲正记录。\n"
  const outside = "\n## 历史条款\r\n\r\n财务保存七年。"
  const filled = old.replace("<!-- kane-agent-harness:end", inside + "\n<!-- kane-agent-harness:end") + outside
  await write(initial, filled)
  await write("meeting.md", "[历史条款](specs/requirements.md#历史条款)\r\n")
  const planFiles = [initial, prd, "AGENTS.md", "docs/workflow.md", ".agents/harness.json", "meeting.md"]
  const before = await Promise.all(planFiles.map(read))
  const decision = await decide(initial, prd)
  const plan = await command("plan", "upgrade", decision)
  expect(plan.changes.map((row: {path: string}) => row.path).sort()).toEqual([initial, "AGENTS.md", "docs/workflow.md", ".agents/harness.json"].sort())
  expect(await Promise.all(planFiles.map(read))).toEqual(before)
  expect((await command("apply", "upgrade", decision)).changes).toEqual(plan.changes)
  expect((await read(initial)).replaceAll("\r\n", "\n")).toContain(inside)
  expect(await read(initial)).toEndWith(outside)
  expect(await read(initial)).not.toContain("kane-agent-harness:")
  expect(await read(prd)).toBe(official)
  expect(await read("meeting.md")).toBe(before[5]!)
  expect(links(await read("AGENTS.md"))).toContain(prd)
  expect(links(await read("AGENTS.md"))).not.toContain(initial)
  expect(links(await read("docs/workflow.md"))).toContain("../" + prd)
  const report = await cli(["verify", project, ...id])
  expect(report.parts[0]).toMatchObject({ path: prd, mode: "reference", fromBaseline: digest(official.trimEnd()) })
  expect((await command("apply", "upgrade", decision)).changes).toEqual([])
}, 20000)

test("a moved PRD can be adopted once team backlinks are repaired; stale evidence never writes", async () => {
  await prepare()
  await command("apply", "adopt", await decide(initial, prd))
  expect(await Bun.file(join(project, initial)).exists()).toBe(false)
  await write("meeting.md", "[验收](product/退款%20PRD.md#验收)\n")
  await rename(join(project, prd), join(project, moved))
  const decision = await decide(prd, moved)
  const governed = ["AGENTS.md", "docs/workflow.md", ".agents/harness.json", moved]
  const initialState = await Promise.all(governed.map(read))
  for (const stale of [{ from: initial }, { fromExpected: digest("stale") }, { fromBaseline: digest("stale") }, { expected: digest("stale") }, { base: digest("stale") }, { incoming: digest("stale") }]) {
    expect((await command("apply", "adopt", { ...decision, ...stale }, 1)).changes).toEqual([])
  }
  const blocked = await command("apply", "adopt", decision, 1)
  expect(blocked.errors.join("\n")).toContain("meeting.md")
  expect(await Promise.all(governed.map(read))).toEqual(initialState)
  await write("meeting.md", "[验收](product/现行规格.md#验收)\n\n[旧死链](other.md)\n")
  const plan = await command("plan", "adopt", decision)
  expect(await Promise.all(governed.map(read))).toEqual(initialState)
  expect((await command("apply", "adopt", decision)).changes).toEqual(plan.changes)
  expect(links(await read("docs/workflow.md"))).toContain("../" + moved)
  expect(links(await read("AGENTS.md"))).toContain(moved)
  expect(await read(moved)).toBe(official)
  expect((await cli(["verify", project])).status).toBe("ok")
  expect((await command("apply", "adopt", decision)).changes).toEqual([])
}, 20000)

test("a retained team document prevents deletion of a still-referenced generated spec or anchor", async () => {
  await prepare()
  const decision = await decide(initial, prd)
  const before = await read(".agents/harness.json")
  await write("meeting.md", "[原规格](specs/requirements.md)\n")
  expect((await command("apply", "upgrade", decision, 1)).errors.join("\n")).toContain("meeting.md")
  const body = (await read(initial)) + "\n历史条款仍在。\n"
  await write(initial, body)
  await write("meeting.md", "[原说明](specs/requirements.md#需求与规格)\n")
  expect((await command("apply", "upgrade", await decide(initial, prd), 1)).errors.join("\n")).toContain("meeting.md")
  expect(await read(initial)).toBe(body)
  expect(await read(".agents/harness.json")).toBe(before)
}, 20000)

test("a mixed managed workflow can rebind only its current link and keep the historical clause at the old PRD", async () => {
  await prepare()
  await command("apply", "upgrade", await decide(initial, prd))
  const workflow = "docs/workflow.md"
  const history = "\n支付组附录见[上版财务验收](../product/退款%20PRD.md#验收)。\n"
  const part = await customizeWorkflow(history)
  await write("notes.md", "[旧版验收](product/退款%20PRD.md#验收)\n")
  const outside = "\r\n工单引用[原验收](../product/退款%20PRD.md#验收)。"
  await write(workflow, (await read(workflow)) + outside)
  const updated = "# 生效版本\n\n## 验收\n\n退款只执行一次。\n"
  await write(moved, updated)
  const tracked = ["AGENTS.md", ".agents/harness.json", workflow, prd, moved, "notes.md"]
  const before = await Promise.all(tracked.map(read))
  const rebind = await decide(prd, moved)
  for (const op of ["plan", "apply"] as const) {
    const blocked = await command(op, "upgrade", rebind, 1)
    expect(blocked.issues.map((i: { key: string }) => i.key)).toEqual([part.key])
    expect(blocked.issues[0].reason).toContain("keep")
    expect(blocked.issues[0].reason).toContain("merge")
    expect(blocked.changes).toEqual([])
    expect(await Promise.all(tracked.map(read))).toEqual(before)
  }
  const [issue] = (await command("plan", "upgrade", rebind, 1)).issues
  const next = part.current.replace("../product/%E9%80%80%E6%AC%BE%20PRD.md", "../product/现行规格.md")
  expect(next).not.toBe(part.current)
  const merge = { ...issue, mode: "merge", reason: "工作流读现行规格，财务附录仍以旧版为据", body: next + history }
  const stale = await command("apply", "upgrade", [rebind, { ...merge, expected: digest("旧正文") }], 1)
  expect(stale.issues[0].key).toBe(part.key)
  expect(await Promise.all(tracked.map(read))).toEqual(before)
  const missing = { ...merge, body: next + "\n[财务验收](../product/现行规格.md#缺失条款)\n" }
  expect((await command("apply", "upgrade", [rebind, missing], 1)).errors.join("\n")).toContain(workflow)
  expect(await Promise.all(tracked.map(read))).toEqual(before)
  const plan = await command("plan", "upgrade", [rebind, merge])
  expect(plan.changes.map((c: { path: string }) => c.path).sort()).toEqual([workflow, "AGENTS.md", ".agents/harness.json"].sort())
  expect(await Promise.all(tracked.map(read))).toEqual(before)
  expect((await command("apply", "upgrade", [rebind, merge])).changes).toEqual(plan.changes)
  const result = await read(workflow)
  expect(result).toContain(history)
  expect(result).toEndWith(outside)
  expect(links(result)).toContain("../" + moved)
  expect(links(result)).toContain("../" + prd + "#验收")
  expect(links(result)).not.toContain("../" + prd)
  expect(await read(moved)).toBe(updated)
  expect(await read(prd)).toBe(official)
  expect(await read("notes.md")).toBe(before[5]!)
  expect((await cli(["verify", project, "--id", "workflow"])).parts[0].status).toContain("exception")
  expect((await command("apply", "upgrade", [rebind, merge])).changes).toEqual([])
}, 20000)

test("a historical link in an unselected locally edited part accepts keep in the rebind plan", async () => {
  await prepare()
  const old = "product/v1.md"
  const next = "product/v2.md"
  await write(old, official)
  await write(next, "## 验收\n\n新版条款。\n")
  await command("apply", "adopt", await decide(initial, old))
  await cli(["apply", "add", project, "--id", "testing"])
  const path = "docs/testing.md"
  const history = "审计证据固定引用[验收](../product/v1.md#验收)。"
  const draft = (await read(path)).replace("<!-- kane-agent-harness:end", history + "\n<!-- kane-agent-harness:end")
  await write(path, draft)
  const paths = [path, next, old, "docs/workflow.md", "AGENTS.md", ".agents/harness.json"]
  const before = await Promise.all(paths.map(read))
  const rebind = await decide(old, next)
  const blocked = await command("plan", "adopt", rebind, 1)
  const [issue] = blocked.issues
  expect(issue.path).toBe(path)
  const keep = { ...issue, mode: "keep", reason: "历史验收保留旧原文" }
  const plan = await command("plan", "adopt", [rebind, keep])
  expect(plan.changes.map((c: { path: string }) => c.path).sort()).toEqual(paths.slice(3).sort())
  expect(await Promise.all(paths.map(read))).toEqual(before)
  expect((await command("apply", "adopt", [rebind, keep])).changes).toEqual(plan.changes)
  expect(await Promise.all(paths.slice(0, 3).map(read))).toEqual(before.slice(0, 3))
  expect(links(await read("docs/workflow.md"))).toContain("../" + next)
  expect((await cli(["verify", project])).status).toBe("ok")
  expect((await command("apply", "adopt", [rebind, keep])).changes).toEqual([])
}, 20000)

test("a generated template that survives rebind still validates a kept clause, while an emptied template transfers its links", async () => {
  await prepare()
  await write(prd, "# 需求与规格\n\n退款条款。\n")
  const workflow = "docs/workflow.md"
  await customizeWorkflow("\n[原依据](../specs/requirements.md#需求与规格)\n")
  const template = await read(initial)
  await write(initial, template + "\n团队的历史记录。\n")
  const paths = [workflow, initial, prd, "AGENTS.md", ".agents/harness.json"]
  const before = await Promise.all(paths.map(read))
  const retained = await decide(initial, prd)
  const [issue] = (await command("plan", "upgrade", retained, 1)).issues
  expect(issue.path).toBe(workflow)
  const keep = { ...issue, mode: "keep", reason: "沿用原链接" }
  const blocked = await command("apply", "upgrade", [retained, keep], 1)
  expect(blocked.errors.join("\n")).toContain(workflow + " → ../specs/requirements.md#需求与规格")
  expect(await Promise.all(paths.map(read))).toEqual(before)
  await write(initial, template)
  const emptied = await decide(initial, prd)
  const plan = await command("plan", "upgrade", emptied)
  expect(plan.changes).toContainEqual(expect.objectContaining({ path: initial, operation: "remove" }))
  expect(await read(initial)).toBe(template)
  expect((await command("apply", "upgrade", emptied)).changes).toEqual(plan.changes)
  expect(links(await read(workflow))).toContain("../" + prd + "#需求与规格")
  expect((await cli(["verify", project])).status).toBe("ok")
  expect((await command("apply", "upgrade", emptied)).changes).toEqual([])
}, 20000)

test("custom managed clause links follow a physical move only after the new anchor exists", async () => {
  await prepare()
  await command("apply", "upgrade", await decide(initial, prd))
  const workflow = "docs/workflow.md"
  await customizeWorkflow("\n支付组附录见[财务验收](../product/退款%20PRD.md#验收)。\n")
  await rename(join(project, prd), join(project, moved))
  await write(moved, "# 规格\n\n新版条款。\n")
  const tracked = ["AGENTS.md", ".agents/harness.json", workflow, moved]
  const before = await Promise.all(tracked.map(read))
  const blocked = await command("apply", "upgrade", await decide(prd, moved), 1)
  expect(blocked.errors.join("\n")).toContain(workflow)
  expect(await Promise.all(tracked.map(read))).toEqual(before)
  await write(moved, official)
  const rebind = await decide(prd, moved)
  await command("apply", "upgrade", rebind)
  expect(links(await read(workflow))).toContain("../" + moved + "#验收")
  expect((await cli(["verify", project])).status).toBe("ok")
  expect((await command("apply", "upgrade", rebind)).changes).toEqual([])
}, 20000)

test("moving an adopted PRD index checks its own relative links before writing and verify catches a lost clause anchor", async () => {
  await prepare()
  const clause = "product/状态.md"
  const checkout = "product/支付.md"
  const index = "# 退款规格索引\n\n[退款状态](状态.md) 包含[支付验收][pay]。\n\n[pay]: 支付.md#重复请求\n\n[外部说明](https://example.invalid/refunds)\n"
  await write(prd, index)
  await write(clause, "# 状态\n\n退款成功。\n")
  await write(checkout, "# 支付\n\n## 重复请求\n\n只退款一次。\n")
  await write("unrelated.md", "[历史资料](unknown.md)\n")
  const [readme] = (await cli(["catalog", "--id", "readme"])).components[0].parts
  const other = join(root, "readme-decision.json")
  await writeFile(other, JSON.stringify([{ key: "readme/" + readme.id, mode: "reference", path: "unrelated.md",
    expected: digest(await read("unrelated.md")), incoming: readme.sha256, base: null, reason: "团队维护的项目说明" }]))
  await cli(["apply", "add", project, "--id", "readme", "--decisions", other])
  await command("apply", "upgrade", await decide(initial, prd))
  await mkdir(join(project, "design"))
  const next = "design/退款 PRD.md"
  await rename(join(project, prd), join(project, next))
  const decision = await decide(prd, next)
  const tracked = ["AGENTS.md", "docs/workflow.md", ".agents/harness.json", next]
  const before = await Promise.all(tracked.map(read))
  for (const op of ["plan", "apply"] as const) {
    const blocked = await command(op, "upgrade", decision, 1)
    const errors = blocked.errors.join("\n")
    expect(errors).toContain(next + " → 状态.md")
    expect(errors).toContain(next + " → 支付.md#重复请求")
    expect(errors).not.toContain("unrelated.md")
    expect(await Promise.all(tracked.map(read))).toEqual(before)
  }
  const fixed = index.replace("(状态.md)", "(../product/状态.md)").replace("]: 支付.md#", "]: ../product/支付.md#")
  await write(next, fixed)
  await command("apply", "upgrade", await decide(prd, next))
  expect((await cli(["verify", project])).status).toBe("ok")
  expect(await read(next)).toBe(fixed)
  await write(checkout, "# 支付\n\n## 单次请求\n")
  const broken = await cli(["verify", project], 1)
  expect(broken.errors.join("\n")).toContain(next + " → ../product/支付.md#重复请求")
}, 20000)

test("a case-only PRD rename binds the exact new name once and still rejects team links to its old spelling", async () => {
  await prepare()
  const old = "product/PRD.md"
  const next = "product/prd.md"
  await write(old, official)
  await command("apply", "upgrade", await decide(initial, old))
  await rename(join(project, old), join(project, next))
  const [missing] = (await cli(["status", project, ...id, "--detail"])).parts
  expect(missing.status).toContain("missing")
  expect(missing.expected).toBeNull()
  expect((await cli(["fingerprint", project, old])).sha256).toBeNull()
  await cli(["fingerprint", project, "product/Prd.md"], 2)
  await write("notes.md", "[旧版](product/PRD.md#验收)\n")
  const decision = await decide(old, next)
  const tracked = ["AGENTS.md", ".agents/harness.json", "docs/workflow.md", next]
  const before = await Promise.all(tracked.map(read))
  const blocked = await command("apply", "upgrade", decision, 1)
  expect(blocked.errors.join("\n")).toContain("notes.md")
  expect(await Promise.all(tracked.map(read))).toEqual(before)
  await write("notes.md", "[现行](product/prd.md#验收)\n")
  await command("plan", "upgrade", decision)
  expect(await Promise.all(tracked.map(read))).toEqual(before)
  const repo = await Project.open(project)
  const candidate = await operate(repo, join(root, "skill/assets"), "upgrade", { ids: ["requirements"], decisions: [decision] })
  expect(candidate.issues).toEqual([])
  expect(candidate.guards.filter(g => g.path.toLowerCase() === next)).toEqual([{ path: next, before: official, after: official }])
  await write(next, official + "\n复核期间的新改动")
  await expect(repo.commit([...candidate.changes, ...candidate.guards])).rejects.toThrow("内容已变化")
  expect(await read(".agents/harness.json")).toBe(before[1]!)
  expect(await read("AGENTS.md")).toBe(before[0]!)
  await write(next, official)
  await command("apply", "upgrade", decision)
  expect(links(await read("AGENTS.md"))).toContain(next)
  expect(links(await read("docs/workflow.md"))).toContain("../" + next)
  expect(await read(next)).toBe(official)
  expect((await cli(["verify", project])).status).toBe("ok")
  expect((await command("apply", "upgrade", decision)).changes).toEqual([])
}, 20000)
