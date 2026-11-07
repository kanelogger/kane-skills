import { afterAll, beforeAll, expect, test } from "bun:test"
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

const main = join(import.meta.dir, "../main.ts")
let dir = ""
let html = ""

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), "url markdown cli-"))
  html = join(dir, "rendered page.html")
  const text = "这是一篇用于核对浏览器快照导出的正文，保留来源和文章结构，不增加原文没有的事实。"
  await writeFile(html, `<!doctype html><html lang="zh-CN"><head><title>导出 &amp; 保真</title><meta name="author" content="作者甲"></head><body><article><h1>导出 &amp; 保真</h1><p>${text.repeat(8)}</p><h2>第二部分</h2><p>${text.repeat(6)}</p><p>结尾保留这一句。</p></article></body></html>`)
})

afterAll(async () => {
  await rm(dir, { recursive: true, force: true })
})

async function run(args: string[]) {
  const proc = Bun.spawn([process.execPath, main, ...args], { cwd: dir, stdout: "pipe", stderr: "pipe" })
  const [out, err, code] = await Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text(), proc.exited])
  return { out, err, code }
}

test("browser HTML exports source metadata and article content from an unrelated working directory", async () => {
  const file = join(dir, "new folder", "article.md")
  const url = "https://example.com/article?edition=2"
  const res = await run([url, "--html", html, "--output", file])
  expect(res.code).toBe(0)
  const data = JSON.parse(res.out)
  expect(data.file).toBe(file)
  const text = await readFile(file, "utf8")
  const front = text.match(/^---\n([\s\S]*?)\n---\n/)
  const meta = Bun.YAML.parse(front![1]) as Record<string, string>
  expect(meta.source).toBe(url)
  expect(meta.url).toBe(url)
  expect(meta.author).toBe("作者甲")
  expect(meta.capture).toBe("browser-html")
  expect(text).toContain("这是一篇用于核对浏览器快照导出的正文")
  expect(text).toContain("第二部分")
  expect(text).toContain("结尾保留这一句。")
  const before = await readFile(html, "utf8")
  await writeFile(file, "existing article\n")
  const conflict = await run([url, "--html", html, "--output", file])
  expect(conflict.code).toBe(1)
  expect(await readFile(file, "utf8")).toBe("existing article\n")
  expect(await readFile(html, "utf8")).toBe(before)
})

test("unsafe source URLs are rejected even for browser HTML imports", async () => {
  const file = join(dir, "unsafe.md")
  for (const url of ["http://example.com/", "https://user:password@example.com/", "file:///etc/passwd"]) {
    const res = await run([url, "--html", html, "--output", file])
    expect(res.code).toBe(1)
  }
  expect(await Bun.file(file).exists()).toBe(false)
})

test("invalid UTF-8 snapshots fail without producing a misleading Markdown file", async () => {
  const input = join(dir, "invalid.html")
  const file = join(dir, "invalid.md")
  await writeFile(input, new Uint8Array([0xff, 0xfe, 0x3c, 0x00]))
  const res = await run(["https://example.com/", "--html", input, "--output", file])
  expect(res.code).toBe(1)
  expect(await Bun.file(file).exists()).toBe(false)
})

test("native Markdown preserves code syntax and final provenance without adding a second title", async () => {
  const input = join(dir, "tool-result.md")
  const file = join(dir, "tool-article.md")
  const code = "```html\n<script>example()</script>\n```"
  await writeFile(input, `---\ntitle: 来源文章\nauthor: 作者乙\nurl: https://example.com/final\n---\n\n# 来源文章\n\n${code}\n\n    const kept = true\n\n| 项目 | 结果 |\n| --- | --- |\n| 原文 | 保留 |\n`)
  const res = await run(["https://example.com/short", "--markdown", input, "--output", file])
  expect(res.code).toBe(0)
  const text = await readFile(file, "utf8")
  const front = text.match(/^---\n([\s\S]*?)\n---\n/)
  const meta = Bun.YAML.parse(front![1]) as Record<string, string>
  expect(meta.source).toBe("https://example.com/short")
  expect(meta.url).toBe("https://example.com/final")
  expect(meta.author).toBe("作者乙")
  expect(meta.capture).toBe("tool-markdown")
  expect(text.match(/^# 来源文章$/gm)).toEqual(["# 来源文章"])
  expect(text).toContain(code)
  expect(text).toMatch(/^    const kept = true$/m)
  expect(text).toMatch(/^\| 原文 \| 保留 \|$/m)
})

test("ambiguous input and unsafe or empty tool output preserve an existing article", async () => {
  const input = join(dir, "rejected-tool.md")
  const file = join(dir, "protected.md")
  await writeFile(file, "Keep this article\n")
  await writeFile(input, "# Tool article\n\nA genuine paragraph.\n")
  const ambiguous = await run(["https://example.com/", "--markdown", input, "--html", html, "--output", file])
  expect(ambiguous.code).toBe(1)
  for (const value of [" \n\t", "---\nurl: http://example.com/unsafe\n---\n# Article\n", "---\n- not-a-metadata-map\n---\n# Article\n"]) {
    await writeFile(input, value)
    const rejected = await run(["https://example.com/", "--markdown", input, "--output", file])
    expect(rejected.code).toBe(1)
    expect(await readFile(file, "utf8")).toBe("Keep this article\n")
  }
})

test("tool-supplied final URLs cannot escape the domain output directory", async () => {
  const input = join(dir, "domain-boundary.md")
  await writeFile(input, "---\ntitle: Domain escape\nurl: https://../\n---\n# Domain escape\n\nA complete tool result.\n")
  const res = await run(["https://example.com/article", "--markdown", input])
  expect(res.code).toBe(1)
  expect(await Bun.file(join(dir, "domain-escape.md")).exists()).toBe(false)
})
