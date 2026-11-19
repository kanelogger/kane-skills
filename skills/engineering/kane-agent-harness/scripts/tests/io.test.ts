import { afterEach, beforeEach, expect, spyOn, test } from "bun:test"
import { chmod, lstat, mkdir, mkdtemp, readFile, readdir, rename, rm, symlink, truncate, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { Project, type Change } from "../io.ts"
import { checkLinks, lostAnchors } from "../links.ts"

let base: string
let root: string
let project: Project
const file = (name: string) => join(root, name)
const change = (path: string, before: string | null, after: string | null): Change => ({ path, before, after })

beforeEach(async () => {
  base = await mkdtemp(join(tmpdir(), "kane-harness-io-"))
  root = join(base, "project")
  await mkdir(root)
  project = await Project.open(root)
})
afterEach(async () => { await rm(base, { recursive: true, force: true }) })

test("create, guarded edit, delete, expected absence and unchanged input", async () => {
  const text = "\uFEFF团队\r\n"
  await project.commit([change("docs/guide.md", null, text), change(".agents/harness.json", null, "{}")])
  expect(await project.read("docs/guide.md")).toBe(text)
  const before = await lstat(file(".agents/harness.json"))
  await chmod(file("docs/guide.md"), 0o640)
  await project.commit([change("docs/guide.md", text, "next"), change(".agents/harness.json", "{}", "{}")])
  const after = await lstat(file(".agents/harness.json"))
  expect([after.ino, after.mtimeMs]).toEqual([before.ino, before.mtimeMs])
  expect((await lstat(file("docs/guide.md"))).mode & 0o777).toBe(0o640)
  await project.commit([change("docs/guide.md", "next", null)])
  expect(await project.read("docs/guide.md")).toBeNull()
  expect(await project.exists("docs")).toBe(true)
  expect(await readdir(file("docs"))).toEqual([])
  expect((await readdir(root)).sort()).toEqual([".agents", "docs"])
})

test("preflight refuses stale contents, case aliases, duplicate paths and shadowed directories", async () => {
  await project.commit([change("Docs/guide.md", null, "old")])
  for (const list of [
    [change("first", null, "ok"), change("Docs/guide.md", "other", "new")],
    [change("docs/second.md", null, "x")],
    [change("one/A", null, "a"), change("One/b", null, "b")],
    [change("one", null, "a"), change("one/b", null, "b")],
    [change("first", null, "a"), change("first", null, "b")],
  ]) await expect(project.commit(list)).rejects.toThrow()
  expect(await readdir(root)).toEqual(["Docs"])
  expect(await project.read("Docs/guide.md")).toBe("old")
})

test("exact reads recognize the surviving spelling after a file or parent directory changes case", async () => {
  await project.commit([change("Docs/PRD.md", null, "requirements")])
  expect(await project.readExact("Docs/PRD.md")).toBe("requirements")
  expect(await project.readExact("Docs/missing.md")).toBeNull()
  await rename(file("Docs/PRD.md"), file("Docs/prd.md"))
  await rename(file("Docs"), file("docs"))
  for (const path of ["docs/PRD.md", "Docs/prd.md", "Docs/PRD.md"]) {
    expect(await project.readExact(path)).toBeNull()
    await expect(project.read(path)).rejects.toThrow("大小写冲突")
    await expect(project.commit([change(path, null, "replacement")])).rejects.toThrow("大小写冲突")
  }
  expect(await project.readExact("docs/prd.md")).toBe("requirements")
  expect(await readdir(file("docs"))).toEqual(["prd.md"])
})

test("exact reads reject coexisting case aliases on case-sensitive filesystems", async () => {
  await writeFile(file("PRD.md"), "upper")
  try { await writeFile(file("prd.md"), "lower", { flag: "wx" }) }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") return
    throw error
  }
  for (const path of ["PRD.md", "prd.md", "Prd.md"]) await expect(project.readExact(path)).rejects.toThrow("大小写冲突")
})

test("incoming references can read a larger Markdown source without raising managed write limits", async () => {
  const body = "x".repeat(4 * 1024 * 1024) + "\n\n[参考](lost.md)"
  await writeFile(file("large.MARKDOWN"), body)
  expect(await project.readMarkdown("large.MARKDOWN")).toBe(body)
  expect(await checkLinks(path => project.readMarkdown(path), ["large.MARKDOWN"])).toEqual(["large.MARKDOWN → lost.md（目标路径缺失）"])
  await expect(project.read("large.MARKDOWN")).rejects.toThrow("4 MiB")
  await expect(project.readExact("large.MARKDOWN")).rejects.toThrow("4 MiB")
  await expect(project.commit([change("new.md", null, body)])).rejects.toThrow("过大")
  await truncate(file("large.MARKDOWN"), 32 * 1024 * 1024 + 1)
  await expect(project.readMarkdown("large.MARKDOWN")).rejects.toThrow("32 MiB")
  await writeFile(file("binary.md"), Buffer.from([0xff]))
  await expect(project.readMarkdown("binary.md")).rejects.toThrow()
  await symlink(file("binary.md"), file("alias.md"))
  await expect(project.readMarkdown("alias.md")).rejects.toThrow("符号链接")
  await expect(project.readMarkdown("private/keep.md")).rejects.toThrow("私有")
  expect(await project.readMarkdown("missing.md")).toBeNull()
})

test("lost anchors use the same duplicate heading, Unicode and explicit anchor rules as link checks", () => {
  const before = ["# 标题", "# 标题-1", "# 标题", "# 标题", "<a name='legacy'></a>", "~~~", "# fake", "~~~"].join("\n\n")
  const after = ["# 标题", "# 标题-1", "# 标题", "# 新增", "<a id='other'></a>"].join("\n\n")
  expect([...lostAnchors(before, after)].sort()).toEqual(["legacy", "标题-3"])
  expect(lostAnchors(after, after).size).toBe(0)
})

test("protects private paths, escaped paths and symbolic targets or ancestors", async () => {
  await mkdir(join(base, "outside"))
  await writeFile(join(base, "outside", "keep.md"), "keep")
  await symlink(join(base, "outside"), file("alias"))
  await symlink(join(base, "outside", "keep.md"), file("alias.md"))
  for (const path of ["a/../b", "../outside/keep.md", "/absolute", ".Git/HEAD", ".SSH/id", ".ENV", ".agents/state/x", ".agents/x.LOCAL.yml", "Secrets/config", ".kane-harness-pending.json", "x\\y", "C:/foo", "alias/keep.md", "alias.md"]) {
    await expect(project.read(path)).rejects.toThrow()
    await expect(project.readExact(path)).rejects.toThrow()
    await expect(project.commit([change(path, null, "new")])).rejects.toThrow()
  }
  await expect(project.readExact("ALIAS.md")).rejects.toThrow("符号链接")
  await expect(project.readExact("ALIAS/keep.md")).rejects.toThrow("符号链接")
  expect(await readFile(join(base, "outside", "keep.md"), "utf8")).toBe("keep")
  await expect(Project.open(file("alias"))).rejects.toThrow()
  await rename(root, join(base, "old-project"))
  await mkdir(root)
  await expect(project.commit([change("new", null, "x")])).rejects.toThrow()
})

test("one simultaneous writer wins a shared guard", async () => {
  await project.commit([change("version", null, "1")])
  const other = await Project.open(root)
  const done = await Promise.allSettled([
    project.commit([change("version", "1", "2"), change("a", null, "created")]),
    other.commit([change("version", "1", "3"), change("b", null, "created")]),
  ])
  expect(done.filter(item => item.status === "fulfilled")).toHaveLength(1)
  const winner = done[0]?.status === "fulfilled" ? "a" : "b"
  expect((await readdir(root)).sort()).toEqual([winner, "version"])
})

test("a late conflict rolls back writes, permissions and empty directories and preserves the editor's change", async () => {
  await project.commit([change("guard", null, "current"), change("old.md", null, "old"), change("remove.md", null, "keep")])
  await chmod(file("remove.md"), 0o600)
  const api = project as unknown as { at: (fd: number, path: string, created: string[] | null, work: (fd: number, name: string) => unknown) => Promise<unknown> }
  const original = api.at.bind(project)
  const spy = spyOn(api, "at").mockImplementation(async (fd, path, created, work) => {
    const result = await original(fd, path, created, work)
    if (created && path === "docs/new.md") await writeFile(file("guard"), "edited")
    return result
  })
  try {
    await expect(project.commit([
      change("old.md", "old", "update"), change("remove.md", "keep", null),
      change("docs/new.md", null, "x"), change("guard", "current", "current"),
    ])).rejects.toThrow("内容已变化")
  } finally { spy.mockRestore() }
  expect((await readdir(root)).sort()).toEqual(["guard", "old.md", "remove.md"])
  expect(await project.read("guard")).toBe("edited")
  expect(await project.read("old.md")).toBe("old")
  expect(await project.read("remove.md")).toBe("keep")
  expect((await lstat(file("remove.md"))).mode & 0o777).toBe(0o600)
})

test("an interrupted transaction requires local review before another commit", async () => {
  const src = [
    "const {Project} = await import(process.env.IO_MODULE)",
    "const p = await Project.open(process.env.TEST_PROJECT)",
    "const at = p.at.bind(p)",
    "p.at = async (...args) => { const result = await at(...args); if (args[2] && args[1] === 'first.md') process.exit(77); return result }",
    "await p.commit([{path:'first.md',before:null,after:'one'},{path:'next.md',before:null,after:'two'}])",
  ].join("\n")
  const child = Bun.spawn([process.execPath, "-e", src], {
    env: { ...process.env, IO_MODULE: new URL("../io.ts", import.meta.url).href, TEST_PROJECT: root },
    stdout: "ignore", stderr: "pipe",
  })
  expect(await child.exited).toBe(77)
  expect(await project.read("first.md")).toBe("one")
  expect(await project.read("next.md")).toBeNull()
  await expect(project.commit([change("new", null, "x")])).rejects.toThrow("上次中断")
  const journal = file(".kane-harness-pending.json")
  expect((await lstat(journal)).mode & 0o777).toBe(0o600)
  expect(JSON.parse(await readFile(journal, "utf8")).files.map((c: Change) => c.path)).toEqual(["first.md", "next.md"])
  expect(await project.read("new")).toBeNull()
})

test("Markdown links follow projected targets, local headings, reference links, valid directories and binary assets", async () => {
  await mkdir(file("images"))
  await writeFile(file("images/plot (1).png"), Buffer.from([0, 253]))
  const source = [
    "# 入门", "[目录](images/) ![图](<images/plot (1).png>)", "[索引][ref]", "[本节](#入门)",
    "[同名](docs/a.md#标题-1) [自定](docs/a.md#sample-id)", "[外部](https://example.com/a)",
    "[ref]: docs/a.md#代码-示例", "", "~~~md", "[示例](absent.md)", "~~~", "`[示例](ignore.md)`",
  ].join("\n")
  const overlay = new Map([["README.md", source], ["docs/a.md", "# 代码 `示例`\n\n# 标题\n\n# 标题\n\n<a id='sample-id'></a>"]])
  const read = async (path: string) => overlay.get(path) ?? await project.read(path)
  const exists = async (path: string) => overlay.has(path) || await project.exists(path)
  expect(await checkLinks(read, ["README.md"], { exists })).toEqual([])
  overlay.set("README.md", source + "\n[失效](docs/a.md#旧标题) [越界](%2E%2E/secret.md) [失效](missing.md)")
  const issues = await checkLinks(read, ["README.md"], { exists })
  expect(issues).toHaveLength(3)
  expect(issues.join("\n")).toContain("目标锚点缺失")
  expect(issues.join("\n")).toContain("链接越过项目目录")
  expect(await checkLinks(read, ["README.md"], { exists, sources: new Map([["README.md", "[仅受管](docs/a.md)"]]) })).toEqual([])
  const incoming = await checkLinks(read, ["README.md"], { exists, include: path => path === "missing.md" })
  expect(incoming).toHaveLength(1)
  expect(incoming[0]).toContain("missing.md")
})
