import { afterEach, beforeEach, expect, test } from "bun:test"
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

let project: string
const ids = ["--id", "independent-review", "--id", "tasks"]
const paths = ["docs/independent-review.md", "tasks/README.md", "tasks/TEMPLATE.md"]

beforeEach(async () => { project = await mkdtemp(join(tmpdir(), "harness-navigation-")) })
afterEach(async () => { await rm(project, { recursive: true, force: true }) })

async function cli(args: string[], code = 0) {
  const proc = Bun.spawn([process.execPath, join(import.meta.dir, "../main.ts"), ...args], { stdout: "pipe", stderr: "pipe" })
  const [out, err, exit] = await Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text(), proc.exited])
  expect(exit, out + err).toBe(code)
  return JSON.parse(out || err)
}

function rendered(body: string) {
  const links: string[] = []
  const headings: string[] = []
  Bun.markdown.render(body, {
    heading(text, { level }) { if (level === 2) headings.push(text); return text },
    link(text, { href }) { links.push(href); return text },
  })
  return { links, headings }
}

const team = "# 项目\r\n\r\n## 协作规范导航\r\n\r\n" + paths.map(path => "[团队入口](" + path + ")").join(" ") + "\r\n\r\n"

test("plan and apply preserve the project when its fence swallows the managed navigation", async () => {
  const original = team + "~~~~text\r\n尚未写完的示例\r\n~~~"
  const file = join(project, "AGENTS.md")
  await writeFile(file, original)
  for (const command of ["plan", "apply"]) {
    const report = await cli([command, "add", project, ...ids], 1)
    expect(report.status).toBe("invalid")
    expect(report.errors.join("\n")).toContain("AGENTS.md")
    expect(await readFile(file, "utf8")).toBe(original)
    expect(await readdir(project)).toEqual(["AGENTS.md"])
  }
})

test("a closed example allows each managed link and heading to render in the complete document", async () => {
  const original = team + "~~~~text\r\n~~~\r\n~~~~"
  const file = join(project, "AGENTS.md")
  await writeFile(file, original)
  await cli(["plan", "add", project, ...ids])
  await cli(["apply", "add", project, ...ids])
  const body = await readFile(file, "utf8")
  expect(body.startsWith(original)).toBe(true)
  expect(rendered(body)).toEqual({ headings: ["协作规范导航", "协作规范导航"], links: [...paths, ...paths] })
  await cli(["verify", project])
})

test("verify detects a hidden installed navigation even when identical links and a heading remain visible", async () => {
  const file = join(project, "AGENTS.md")
  await writeFile(file, team)
  await cli(["apply", "add", project, ...ids])
  const visible = await readFile(file, "utf8")
  const hidden = visible.replace("<!-- kane-agent-harness:begin navigation -->", "~~~\n<!-- kane-agent-harness:begin navigation -->")
  await writeFile(file, hidden)
  expect(rendered(hidden)).toEqual({ headings: ["协作规范导航"], links: paths })
  const report = await cli(["verify", project], 1)
  expect(report.status).toBe("invalid")
  expect(report.navigation).toBe("invalid")
  expect(report.errors.join("\n")).toContain("AGENTS.md")
  expect(await readFile(file, "utf8")).toBe(hidden)
})

test.each([
  ["missing", "[TEMPLATE](<tasks/README.md>)"],
  ["hidden", "<span hidden>[TEMPLATE](<tasks/TEMPLATE.md>)</span>"],
])("verify rejects a %s target in one otherwise visible component row", async (kind, replacement) => {
  const file = join(project, "AGENTS.md")
  await writeFile(file, team)
  await cli(["apply", "add", project, ...ids])
  const ledger = join(project, ".agents/harness.json")
  const state = JSON.parse(await readFile(ledger, "utf8"))
  const original = state.navigation.installed
  state.navigation.installed = original.replace("[tasks/TEMPLATE.md](<tasks/TEMPLATE.md>)", replacement)
  const body = (await readFile(file, "utf8")).replace(original, state.navigation.installed)
  await writeFile(file, body)
  await writeFile(ledger, JSON.stringify(state))
  expect(rendered(body).links).toEqual([...paths, paths[0], paths[1], kind === "hidden" ? paths[2] : paths[1]])
  const report = await cli(["verify", project], 1)
  expect(report.navigation).toBe("invalid")
})

test("a quoted copy of the navigation cannot mask the real block inside a fence", async () => {
  await cli(["apply", "add", project, ...ids])
  const file = join(project, "AGENTS.md")
  const body = await readFile(file, "utf8")
  const quote = body.trimEnd().split("\n").map(line => "> " + line).join("\n")
  const hidden = quote + "\n\n~~~md\n" + body
  await writeFile(file, hidden)
  expect(rendered(hidden)).toEqual({ headings: ["协作规范导航"], links: paths })
  const report = await cli(["verify", project], 1)
  expect(report.navigation).toBe("invalid")
})

const hiddenStyle = '<div StYLe="color: red; DiSpLaY : NoNe !ImPoRtAnT; padding: 0">'
for (const command of ["plan", "apply"]) {
  test.each(["<div hidden>", "<dialog>", hiddenStyle])(`${command} preserves all project bytes when %s contains the navigation`, async tag => {
    const original = Buffer.from(team + tag + "\r\n\r\n")
    const file = join(project, "AGENTS.md")
    const note = join(project, "team.txt")
    const bytes = Buffer.from("团队记录\r\n保留末尾空格  ")
    await writeFile(file, original)
    await writeFile(note, bytes)
    const entries = await readdir(project)
    const report = await cli([command, "add", project, ...ids], 1)
    expect(report.status).toBe("invalid")
    expect(report.errors.join("\n")).toContain("AGENTS.md")
    expect(await readFile(file)).toEqual(original)
    expect(await readFile(note)).toEqual(bytes)
    expect(await readdir(project)).toEqual(entries)
  })
}

test.each([
  ["<div hidden>", ""],
  ["<template>", ""],
  ["<dialog>", ""],
  ["<dialog>", "</dialog>"],
  [hiddenStyle, "</div>"],
  ['<div style="display:none">', ""],
  ['<div style="display: /**/ none ! important; display: block">', "</div>"],
])("visible duplicates cannot satisfy verify when the installed block renders inside %s … %s", async (tag, close) => {
  const file = join(project, "AGENTS.md")
  await writeFile(file, team)
  await cli(["apply", "add", project, ...ids])
  const body = await readFile(file, "utf8")
  const begin = "<!-- kane-agent-harness:begin navigation -->"
  const hidden = body.replace(begin, tag + "\n<section>\n\n" + begin) + "\n</section>\n" + close
  await writeFile(file, hidden)
  expect(rendered(hidden)).toEqual({ headings: ["协作规范导航", "协作规范导航"], links: [...paths, ...paths] })
  const nested: string[] = []
  new HTMLRewriter().on("section h2, section li a", { element(el) {
    nested.push(el.getAttribute("href") ?? el.tagName)
  } }).transform(Bun.markdown.html(hidden))
  expect(nested).toEqual(["h2", ...paths])
  const report = await cli(["verify", project], 1)
  expect(report.status).toBe("invalid")
  expect(report.navigation).toBe("invalid")
  expect(await readFile(file, "utf8")).toBe(hidden)
})

test.each([
  ["ordinary Markdown", "团队说明"],
  ["an open dialog", "<dialog OpEn>"],
  ["a visible inline style", '<div style="display: grid; --display: none">'],
  ["a later display declaration with equal priority", '<div style="display: none !important; display: grid !important">'],
  ["a later reset of display", '<div style="display: none; all: initial">'],
  ["an important reset of display", '<div style="all: unset !important; display: none">'],
  ["display:none inside a CSS string", `<div style="--example: 'text;display:none;end'; color: blue">`],
  ["hidden containers closed before navigation", "<div hidden>\n\n</div>\n\n<dialog>\n\n</dialog>\n\n" + hiddenStyle + "\n\n</div>"],
  ["inline and fenced HTML examples", "`<div hidden>`\n\n~~~html\n<div hidden>\n<dialog>\n" + hiddenStyle + "\n~~~"],
])("%s allows plan, apply and verify with visible navigation", async (_, context) => {
  const original = team + context + "\n\n"
  const file = join(project, "AGENTS.md")
  await writeFile(file, original)
  await cli(["plan", "add", project, ...ids])
  await cli(["apply", "add", project, ...ids])
  expect((await readFile(file, "utf8")).startsWith(original)).toBe(true)
  await cli(["verify", project])
})
