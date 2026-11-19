import { afterEach, beforeEach, expect, test } from "bun:test"
import { cp, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { digest } from "../templates"
import { routeBody } from "../routing"

let root: string
let skill: string
let project: string

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "harness-cli-"))
  skill = join(root, "skill")
  project = join(root, "project")
  await cp(join(import.meta.dir, "../.."), skill, { recursive: true })
  await mkdir(project)
})
afterEach(async () => { await rm(root, { recursive: true, force: true }) })

async function cli(args: string[], code = 0) {
  const p = Bun.spawn([process.execPath, join(skill, "scripts/main.ts"), ...args], { stdout: "pipe", stderr: "pipe" })
  const [out, err, exit] = await Promise.all([new Response(p.stdout).text(), new Response(p.stderr).text(), p.exited])
  expect(exit, out + err).toBe(code)
  return JSON.parse(out || err)
}

type Edit = {path: string; beforeSha256: string | null; after: string | null}
async function edits(rows: Edit[]) {
  const path = join(root, "edit.json")
  await writeFile(path, JSON.stringify(rows))
  return path
}

async function agentLinks() {
  const links: string[] = []
  Bun.markdown.render(await readFile(join(project, "AGENTS.md"), "utf8"), {
    link(text, { href }) { links.push(decodeURIComponent(href)); return text },
  })
  return links
}

test("default initialization links the project requirements from AGENTS.md", async () => {
  await cli(["apply", "init", project])
  const path = "specs/requirements.md"
  const target = join(project, path)
  const template = await readFile(target, "utf8")
  for (const field of ["目标与范围", "输入与输出", "约束与边界", "验收条件"]) expect(template).toContain(field)
  expect(await agentLinks()).toContain(path)
  const filled = template + "\n## 取消预约\n\n距开始恰好两小时的预约允许取消。\n"
  await writeFile(target, filled)
  expect((await cli(["apply", "init", project])).changes).toEqual([])
  expect(await readFile(target, "utf8")).toBe(filled)
  await cli(["verify", project])
})

test("adoption links a team's existing PRD and leaves its bytes intact through withdrawal", async () => {
  const path = "product/退款 PRD.md"
  const target = join(project, path)
  const original = Buffer.from("# 退款需求\r\n\r\n顾客可在结算前撤单。验收时确认款项原路退回。")
  await mkdir(join(project, "product"))
  await writeFile(target, original)
  const id = ["--id", "requirements"]
  const before = await cli(["apply", "adopt", project], 1)
  expect(before.status).toBe("needs_decision")
  expect(before.issues).toContainEqual(expect.objectContaining({ key: "requirements/requirements" }))
  expect((await cli(["plan", "init", project], 1)).status).toBe("needs_decision")
  expect(await readdir(project)).toEqual(["product"])
  const [part] = (await cli(["catalog", ...id])).components[0].parts
  const { sha256 } = await cli(["fingerprint", project, path])
  const decisions = join(root, "decisions.json")
  await writeFile(decisions, JSON.stringify([{
    key: "requirements/requirements", path, mode: "reference", reason: "团队在此维护需求与验收条件",
    expected: sha256, base: null, incoming: part.sha256,
  }]))
  await cli(["apply", "adopt", project, "--decisions", decisions])
  expect(await agentLinks()).toContain(path)
  expect(await readFile(target)).toEqual(original)
  expect(await Bun.file(join(project, "specs/requirements.md")).exists()).toBe(false)
  expect((await cli(["apply", "adopt", project])).changes).toEqual([])
  await cli(["verify", project])
  await cli(["apply", "remove", project, ...id])
  expect(await agentLinks()).not.toContain(path)
  expect(await readFile(target)).toEqual(original)
  expect((await cli(["verify", project])).disabled).toContain("requirements")
})

test("an author can preview, add, revise and retire a control without changing an adopted project", async () => {
  const indexPath = join(skill, "assets/catalog.json")
  const index = await readFile(indexPath, "utf8")
  const source = "bodies/approval.md.tmpl"
  const body = "# Merge approval\n\nOne maintainer signs the final revision.\n"
  const added = JSON.stringify([...JSON.parse(index), { id: "approval", title: "Merge approval", default: false, parts: [{id:"approval",path:"docs/approval.md",source}]}], null, 2)
  const newControl = await edits([{path:"catalog.json", beforeSha256:digest(index), after:added}, {path:source,beforeSha256:null,after:body}])
  await cli(["templates","plan",skill,"--edits",newControl])
  expect(await readFile(indexPath,"utf8")).toBe(index)
  await cli(["templates","apply",skill,"--edits",newControl])
  await cli(["apply","add",project,"--id","approval"])
  const doc = join(project,"docs/approval.md")
  const first = await readFile(doc,"utf8")
  expect(first).toContain(body)
  const revised = body + "\nRecord the revision number.\n"
  const change = await edits([{path:source,beforeSha256:digest(body),after:revised}])
  await cli(["templates","apply",skill,"--edits",change])
  expect(await readFile(doc,"utf8")).toBe(first)
  await cli(["templates","apply",skill,"--edits",change],2)
  await cli(["apply","upgrade",project])
  expect(await readFile(doc,"utf8")).toContain(revised)
  const broken = await edits([{path:source,beforeSha256:digest(revised),after:revised+"[missing](never.md)\n"}])
  await cli(["templates","apply",skill,"--edits",broken],2)
  expect(await readFile(join(skill,"assets",source),"utf8")).toBe(revised)
  const retire = await edits([{path:"catalog.json",beforeSha256:digest(added),after:index},{path:source,beforeSha256:digest(revised),after:null}])
  await cli(["templates","apply",skill,"--edits",retire])
  expect((await cli(["status",project])).orphans).toEqual(["approval"])
  expect(await readFile(doc,"utf8")).toContain(revised)
  await cli(["apply","remove",project,"--id","approval"])
  expect(await Bun.file(doc).exists()).toBe(false)
}, 20000)

test("project removal surfaces inbound links before any write; previously broken team links do not block", async () => {
  await cli(["apply","init",project,"--id","independent-review"])
  const link = "[Procedure](docs/independent-review.md#计划审阅)"
  const notes = join(project,"meeting.md")
  await writeFile(notes,"long archive line ".repeat(260000) + "\n\n[Historical link](old.md)\n"+link+"\n")
  const file = join(project,"docs/independent-review.md")
  const before = await readFile(file,"utf8")
  const report = await cli(["apply","remove",project,"--id","independent-review"],1)
  expect(report.errors.join("\n")).toContain("meeting.md")
  expect(await readFile(file,"utf8")).toBe(before)
  await writeFile(notes,"long archive line ".repeat(260000) + "\n\n[Historical link](old.md)\n")
  await cli(["apply","remove",project,"--id","independent-review"])
  expect((await cli(["verify",project])).disabled).toContain("independent-review")
})

test("routes relative links to adopted files, retaining examples and unavailable component labels", () => {
  const source = "[规则](rules.md#多人协作) [外部](https://example.com) [选配](tasks.md)\n\n~~~md\n[示例](rules.md)\n~~~"
  const routes = new Map([["docs/rules.md","TEAM.md"],["docs/tasks.md",""]])
  expect(routeBody(source,"docs/start.md","handbook/start.md",routes)).toBe("[规则](../TEAM.md#多人协作) [外部](https://example.com) 选配\n\n~~~md\n[示例](rules.md)\n~~~")
})

test("reference definitions follow mapped team locations and optional retirement", () => {
  const source = "[实测][QA] 和 [qa][]。\n\n[qa]: ../docs/testing.md#tests \"tests\""
  expect(routeBody(source,"tasks/README.md","tasks/README.md",new Map([["docs/testing.md","team/guide.markdown"]]))).toContain('[qa]: ../team/guide.markdown#tests "tests"')
  expect(routeBody(source,"tasks/README.md","tasks/README.md",new Map([["docs/testing.md",""]]))).toBe("实测 和 qa。\n\n")
})

test("authoring a cross-component reference-style link permits a standalone installation", async () => {
  const [part] = (await cli(["catalog","--id","tasks"])).components[0].parts
  const before = await readFile(join(skill,"assets",part.source),"utf8")
  const patch = await edits([{path:part.source,beforeSha256:digest(before),after:before+"\n[Checks][QA]\n\n[QA]: ../docs/testing.md\n"}])
  await cli(["templates","apply",skill,"--edits",patch])
  await cli(["apply","add",project,"--id","tasks"])
  const body = await readFile(join(project,part.path),"utf8")
  expect(body).toContain("Checks")
  expect(body).not.toContain("[QA]:")
  await cli(["verify",project])
})

test("a team adopts review, merges a local exception with a changed standard and withdraws only its managed text", async () => {
  const team = "# 团队贡献指南\n\n退款由当班财务维护者签字。本项目只允许指定模型。\n"
  const entry = "# 工程入口\n\n支付业务归财务维护者验收。\n"
  const doc = join(project, "CONTRIBUTING.markdown")
  await writeFile(doc, team)
  await writeFile(join(project, "AGENTS.md"), entry)
  const id = ["--id", "independent-review"]
  const [part] = (await cli(["catalog", ...id])).components[0].parts
  const path = join(skill, "assets", part.source)
  const standard = await readFile(path, "utf8")
  const key = "independent-review/" + part.id
  const decisions = join(root, "decisions.json")
  await writeFile(decisions, JSON.stringify([{key, mode:"append", path:"CONTRIBUTING.markdown", reason:"沿用团队贡献指南", expected:digest(team), base:null, incoming:digest(standard)}]))
  await cli(["apply", "adopt", project, ...id, "--decisions", decisions])
  const adopted = await readFile(doc, "utf8")
  expect(adopted).toContain(standard)
  expect((await cli(["plan", "adopt", project, ...id])).changes).toEqual([])
  const local = "按团队规定用指定模型的全新会话独立审阅。"
  await writeFile(doc, adopted.replace(standard, standard + "\n" + local + "\n"))
  const upgraded = standard + "\n记录最终版本标识。\n"
  const change = await edits([{path:part.source,beforeSha256:digest(standard),after:upgraded}])
  await cli(["templates","apply",skill,"--edits",change])
  const [conflict] = (await cli(["plan","upgrade",project,...id],1)).issues
  expect(conflict.base).toBe(digest(standard))
  await writeFile(decisions, JSON.stringify([{...conflict,mode:"merge",body:upgraded+"\n"+local+"\n",reason:"保留团队模型限制并增加证据版本"}]))
  await cli(["apply","upgrade",project,...id,"--decisions",decisions])
  await cli(["verify",project])
  const status = await cli(["status",project,...id,"--detail"])
  expect(status.parts[0].previous).toBe(upgraded)
  expect(status.parts[0].current).toContain(local)
  expect((await readFile(doc,"utf8")).startsWith(team)).toBe(true)
  expect(await readFile(join(project,"AGENTS.md"),"utf8")).toContain("CONTRIBUTING.markdown")
  const [withdraw] = (await cli(["plan","remove",project,...id],1)).issues
  await writeFile(decisions, JSON.stringify([{...withdraw,mode:"drop",reason:"确认撤除受管段，团队自有的模型限制与签字要求保留"}]))
  await cli(["apply","remove",project,...id,"--decisions",decisions])
  expect(await readFile(doc,"utf8")).toBe(team)
  expect(await readFile(join(project,"AGENTS.md"),"utf8")).toBe(entry)
  expect((await cli(["verify",project,...id])).disabled).toEqual(["independent-review"])
}, 20000)
