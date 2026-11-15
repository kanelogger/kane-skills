import { afterAll, beforeAll, expect, test } from "bun:test"
import { cp, mkdtemp, readFile, realpath, rm, symlink, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { basename, join } from "node:path"
import { JSDOM } from "jsdom"
import { render } from "../render.ts"
import { listThemes } from "../theme.ts"

let dir = ""
const source = `# 示例标题

段落中的 **重点** 和 \`inline\`。

## 章节标题

### 小节标题

> 第一段引用。
>
> 第二段引用。

- 无序项目
- 第二项目

1. 第一步
2. 第二步

\`\`\`ts
const count = 2
console.log(count)
\`\`\`

| 项目 | 内容 |
| --- | --- |
| 第一行 | 甲 |
| 第二行 | 乙 |

[参考资料](https://example.com/)
`

beforeAll(async () => { dir = await realpath(await mkdtemp(join(tmpdir(), "wx-theme-"))) })
afterAll(async () => { await rm(dir, { recursive: true, force: true }) })

function prepare(options: Parameters<typeof render>[3] = {}, input = source) {
  return render(join(dir, "article.md"), dir, input, options)
}

async function run(args: string[]) {
  const proc = Bun.spawn([process.execPath, ...args], { cwd: dir, stdout: "pipe", stderr: "pipe" })
  const [out, err, code] = await Promise.all([
    new Response(proc.stdout).text(), new Response(proc.stderr).text(), proc.exited,
  ])
  return { out, err, code }
}

test("green standard theme preserves typography and article structure", async () => {
  const result = await prepare()
  const dom = new JSDOM(result.html)
  try {
    const doc = dom.window.document
    expect(result.title).toBe("示例标题")
    expect(result.theme.name).toBe("irene-green")
    expect(doc.querySelector("#nice")?.getAttribute("style")).toContain("font-size: 16px")
    expect(doc.querySelector("h2")?.style.fontSize).toBe("22px")
    expect(doc.querySelector("h3")?.style.fontSize).toBe("20px")
    expect(doc.querySelector("blockquote")?.style.borderLeftWidth).toBe("3px")
    expect(doc.querySelector("pre code")?.textContent).toContain("const count = 2\nconsole.log(count)")
    expect(doc.querySelectorAll("table tbody tr")).toHaveLength(2)
    expect(doc.querySelectorAll("ol")).toHaveLength(2)
    expect(doc.querySelector("a")).toBeNull()
    expect(result.text).toContain("https://example.com/")
    expect(doc.querySelector("style,link")).toBeNull()
  } finally { dom.window.close() }
})

test("omitting a theme selects the green standard theme with white text on green headings", async () => {
  const input = `${source}\n#### 四级标题\n\n<h3 class="heading-badge">实色标签</h3>\n`
  const actual = await prepare({}, input)
  const explicit = await prepare({ theme: "irene-green" }, input)
  expect(actual.theme.name).toBe("irene-green")
  expect(actual.html).toBe(explicit.html)
  const dom = new JSDOM(actual.html)
  try {
    for (const selector of ["h2", "h4", ".heading-badge"]) {
      expect(dom.window.document.querySelector<HTMLElement>(selector)?.style.color).toBe("rgb(255, 255, 255)")
      expect(dom.window.document.querySelector<HTMLElement>(selector)?.style.backgroundColor).toBe("rgb(37, 180, 73)")
    }
  } finally { dom.window.close() }
})

test("only the green standard theme is bundled and loads without parent theme files", async () => {
  expect(await listThemes()).toEqual(["irene-green"])
  const result = await prepare()
  expect(result.theme.files).toEqual([join(import.meta.dir, "../../themes/irene-green.css")])
})

test("custom CSS follows specificity and overrides only selected modules", async () => {
  const file = join(dir, "custom.css")
  await writeFile(file, "#nice h2 { font-size: 27px; } #nice .code-block pre { padding: 30px; } #nice table td:nth-child(2) { color: #800000; }")
  const result = await prepare({ theme: "irene-green", themeCss: file })
  const dom = new JSDOM(result.html)
  try {
    const doc = dom.window.document
    expect(doc.querySelector("h2")?.style.fontSize).toBe("27px")
    expect(doc.querySelector("h3")?.style.fontSize).toBe("20px")
    expect(doc.querySelector("pre")?.style.padding).toBe("30px")
    expect(doc.querySelector("td:nth-child(2)")?.style.color).toBe("rgb(128, 0, 0)")
    expect(result.theme.files.at(-1)).toBe(file)
  } finally { dom.window.close() }
})

test("article-provided styles and active HTML cannot bypass theme application", async () => {
  const result = await prepare({}, '<h2 style="font-size:99px" onclick="alert(1)">标题</h2><p style="color:red">正文</p><script>alert(1)</script>')
  const dom = new JSDOM(result.html)
  try {
    expect(dom.window.document.querySelector("script,[onclick]")).toBeNull()
    expect(dom.window.document.querySelector("p")?.style.color).toBe("")
    expect(result.html).not.toContain("99px")
  } finally { dom.window.close() }
})

test("unknown themes and unsupported CSS fail before exporting misleading output", async () => {
  await expect(prepare({ theme: "../outside" })).rejects.toThrow("未知主题")
  const invalid = [
    "#nice p { color: red;",
    '@import "https://example.com/a.css";',
    '#nice { background: url("https://example.com/a.png"); }',
    '#nice { background: image-set("https://example.com/a.png" 1x); }',
    '#nice { background: u\\72l("https://example.com/a.png"); }',
    '@media (max-width: 600px) { #nice p { color: red; } }',
    '#nice h2::before { content: "标题"; }',
    "#nice a:hover { color: red; }",
    "#nice input:checked { color: red; }",
    "#nice { p { color: red; } }",
  ]
  for (const [i, css] of invalid.entries()) {
    const file = join(dir, `invalid-${i}.css`)
    await writeFile(file, css)
    await expect(prepare({ themeCss: file })).rejects.toThrow()
  }
})

test("green standard theme preserves heading hierarchy and emphasis", async () => {
  const result = await prepare({ theme: "irene-green" }, `${source}\n#### 四级标题\n`)
  const dom = new JSDOM(result.html)
  try {
    const doc = dom.window.document
    expect(doc.querySelector("h2")?.style.fontSize).toBe("22px")
    expect(doc.querySelector("h2")?.style.backgroundImage).toContain("linear-gradient")
    expect(doc.querySelector("h3")?.style.borderLeftWidth).toBe("5px")
    expect(doc.querySelector("h3")?.style.color).toBe("rgb(21, 123, 50)")
    expect(doc.querySelector("h4")?.style.fontSize).toBe("16px")
    expect(doc.querySelector("h4")?.style.color).toBe("rgb(255, 255, 255)")
    expect(doc.querySelector("strong")?.style.fontWeight).toBe("600")
  } finally { dom.window.close() }
})

test("fenced prompt, Markdown and code keep their text and receive independent labels", async () => {
  const input = '# 示例\n\n```prompt\n一段提示词\n```\n\n```md\n## 原样标题\n```\n\n```js\nconst html = "<script>demo</script>"\n```\n'
  const result = await prepare({ theme: "irene-green" }, input)
  const dom = new JSDOM(result.html)
  try {
    const doc = dom.window.document
    expect([...doc.querySelectorAll(".code-block > .quote-block-label")].map(el => el.textContent)).toEqual(["提示词", "Markdown", "JavaScript"])
    expect(doc.querySelector(".quote-prompt pre code")?.style.fontSize).toBe("10px")
    expect(doc.querySelector("code.language-js")?.style.fontSize).toBe("14px")
    expect(doc.querySelector("code.language-md")?.textContent).toContain("## 原样标题")
    expect(doc.querySelector("code.language-js")?.textContent).toContain('<script>demo</script>')
    expect(doc.querySelector("script")).toBeNull()
    expect(result.text).not.toContain("JavaScript")
  } finally { dom.window.close() }
})

test("callouts preserve custom titles and ordinary quotations", async () => {
  const input = "# 示例\n\n> 普通引用\n\n> [!NOTE]\n> 一段提示\n\n> [!WARNING] 操作前检查\n> **不要丢失内容**\n\n> [!TIP]\n> 一个技巧\n"
  const result = await prepare({ theme: "irene-green" }, input)
  const dom = new JSDOM(result.html)
  try {
    const doc = dom.window.document
    expect(doc.querySelectorAll("blockquote")).toHaveLength(4)
    expect(doc.querySelectorAll("blockquote.quote-block")).toHaveLength(3)
    expect(doc.querySelector(".quote-note > .quote-block-label")?.textContent).toBe("提示")
    expect(doc.querySelector(".quote-warning > .quote-block-label")?.textContent).toBe("操作前检查")
    expect(doc.querySelector(".quote-tip")?.getAttribute("style")).toContain("background")
    expect(result.text).toContain("操作前检查")
    expect(result.text).toContain("不要丢失内容")
    expect(result.html).not.toContain("[!NOTE]")
  } finally { dom.window.close() }
})

test("semantic component classes survive sanitizing while unrelated classes are removed", async () => {
  const input = '# 示例\n\n<h3 class="heading-underline foreign">标题</h3>\n\n<strong class="emphasis-marker">重点</strong>\n\n<code class="inline-kbd unsafe" onclick="alert(1)">Cmd+K</code>\n\n<span class="quote-inline-block inline-tag">标签</span>\n'
  const result = await prepare({ theme: "irene-green" }, input)
  const dom = new JSDOM(result.html)
  try {
    const doc = dom.window.document
    expect(doc.querySelector(".foreign,.unsafe,[onclick]")).toBeNull()
    expect(doc.querySelector("h3.heading-underline")?.style.borderBottomWidth).toBe("1px")
    expect(doc.querySelector("strong.emphasis-marker")?.style.background).not.toBe("")
    expect(doc.querySelector("code.inline-kbd")?.classList.contains("quote-inline-block")).toBe(true)
    expect(doc.querySelector("span.inline-tag")?.style.color).toBe("rgb(255, 255, 255)")
  } finally { dom.window.close() }
})

test("local image previews retain styles while paste HTML has only ordered upload markers", async () => {
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=", "base64")
  await writeFile(join(dir, "a.png"), png)
  await writeFile(join(dir, "b.png"), png)
  const input = '# 图片示例\n\n<img class="image-shadow" src="a.png" alt="甲">\n\n![远程图](https://example.com/not-fetched.png)\n\n<img class="image-frame" src="b.png" alt="乙">\n'
  const result = await prepare({ theme: "irene-green" }, input)
  const preview = new JSDOM(result.preview)
  const paste = new JSDOM(result.html)
  try {
    expect(result.images).toHaveLength(3)
    expect(preview.window.document.querySelectorAll("img")).toHaveLength(2)
    expect([...preview.window.document.querySelectorAll("img")].every(img => img.src.startsWith("file:///"))).toBe(true)
    expect(preview.window.document.querySelector("h1")?.textContent).toBe("图片示例")
    expect(paste.window.document.querySelector("img,h1")).toBeNull()
    for (const item of result.images) expect(result.html).toContain(item.marker!)
    expect(result.images[0].style).toContain("box-shadow")
    expect(result.images[2].style).toContain("padding: 8px")
    expect(result.preview).not.toContain("https://example.com/not-fetched.png")
    expect(result.html).not.toContain("file://")
    expect(result.warnings).toHaveLength(1)
  } finally { preview.window.close(); paste.window.close() }
})

test("a custom theme named constructor renders through the CLI without inherited parent entries", async () => {
  const skill = join(dir, "copied-skill")
  await cp(join(import.meta.dir, ".."), join(skill, "scripts"), {
    recursive: true,
    filter: path => !["node_modules", "tests"].includes(basename(path)),
  })
  await cp(join(import.meta.dir, "../../themes"), join(skill, "themes"), { recursive: true })
  await symlink(join(import.meta.dir, "../node_modules"), join(skill, "scripts/node_modules"), "dir")
  await writeFile(join(skill, "themes/constructor.css"), "#nice p { color: #225533; }")
  const article = join(dir, "constructor-theme.md")
  const output = join(dir, "constructor-output")
  await writeFile(article, source)
  const result = await run([join(skill, "scripts/main.ts"), article, "--theme", "constructor", "-o", output])
  expect(result.err).toBe("")
  expect(result.code).toBe(0)
  const meta = JSON.parse(await readFile(join(output, "meta.json"), "utf8"))
  expect(meta.theme.name).toBe("constructor")
  expect(meta.theme.files).toEqual([join(skill, "themes/irene-green.css"), join(skill, "themes/constructor.css")])
  const dom = new JSDOM(await readFile(join(output, "body.html"), "utf8"))
  try {
    expect(dom.window.document.querySelector("p")?.style.color).toBe("rgb(34, 85, 51)")
  } finally { dom.window.close() }
})

test("unknown code languages named constructor use their own label and preserve code", async () => {
  const input = '# 示例\n\n```constructor\nfirst()\n```\n\n```custom-lang\nsecond()\n```\n\n```js\nthird()\n```\n'
  const result = await prepare({}, input)
  const dom = new JSDOM(result.html)
  try {
    const doc = dom.window.document
    expect([...doc.querySelectorAll(".code-block > .quote-block-label")].map(el => el.textContent))
      .toEqual(["CONSTRUCTOR", "CUSTOM-LANG", "JavaScript"])
    expect([...doc.querySelectorAll("pre code")].map(el => el.textContent?.trim()))
      .toEqual(["first()", "second()", "third()"])
  } finally { dom.window.close() }
})

for (const [file, background] of [
  ["references/themes.md", "rgb(40, 40, 40)"],
  ["README.md", "rgb(37, 37, 37)"],
]) {
  test(`${file} CSS example overrides code blocks through the default-theme CLI`, async () => {
    const doc = await readFile(join(import.meta.dir, "../..", file), "utf8")
    const css = doc.match(/```css\r?\n([\s\S]*?)\r?\n```/)?.[1]
    expect(css).toBeDefined()
    const name = basename(file, ".md")
    const input = join(dir, `${name}-example.md`)
    const custom = join(dir, `${name}-example.css`)
    const output = join(dir, `${name}-output`)
    await writeFile(input, `${source}\n\n\`\`\`prompt\n保留提示词字号\n\`\`\`\n`)
    await writeFile(custom, css!)
    const result = await run([join(import.meta.dir, "../main.ts"), input, "--theme-css", custom, "-o", output])
    expect(result.err).toBe("")
    expect(result.code).toBe(0)
    const meta = JSON.parse(await readFile(join(output, "meta.json"), "utf8"))
    expect(meta.theme.name).toBe("irene-green")
    for (const filename of ["body.html", "preview.html"]) {
      const dom = new JSDOM(await readFile(join(output, filename), "utf8"))
      try {
        const view = dom.window
        for (const pre of view.document.querySelectorAll("pre")) {
          expect(view.getComputedStyle(pre).padding).toBe("20px")
          expect(view.getComputedStyle(pre).backgroundColor).toBe(background)
          expect(view.getComputedStyle(pre.querySelector("code")!).color).toBe("rgb(245, 245, 245)")
        }
        expect(view.document.querySelector(".quote-prompt pre code")?.getAttribute("style")).toContain("font-size: 10px")
        expect(view.getComputedStyle(view.document.querySelector("p code")!).color).toBe("rgb(39, 107, 58)")
      } finally { dom.window.close() }
    }
  })
}
