import { mkdir, readFile, realpath, stat, writeFile } from "node:fs/promises"
import { basename, dirname, extname, isAbsolute, join, relative, resolve, sep } from "node:path"
import { parseArgs } from "node:util"

const maxBytes = 10 * 1024 * 1024
const tags = "body div p br h1 h2 h3 h4 h5 h6 blockquote pre code ul ol li table thead tbody tfoot tr th td strong b em i s del hr a img input".split(" ")
const help = `用法：bun main.ts <文章.md> [选项]

  --title <标题>        覆盖文章标题
  --summary <摘要>      覆盖文章摘要
  --cover <文件>        指定本地 PNG 或 JPEG 封面
  -o, --output-dir     指定新产物目录
  -h, --help           查看帮助

生成 body.html、body.txt 和 meta.json。默认写入稿件同级的 <稿件名>-weibo/，保留已有产物。
首次运行先在脚本目录执行 bun install --frozen-lockfile。
`

function webUrl(value: string) {
  if (!/^https?:\/\//i.test(value)) return null
  const url = URL.parse(value)
  return url && !url.username && !url.password && !url.port ? url : null
}

function within(base: string, file: string) {
  const rel = relative(base, file)
  return !isAbsolute(rel) && rel !== ".." && !rel.startsWith(`..${sep}`)
}

async function image(source: string, base: string, explicit = false) {
  if (!explicit && webUrl(source)?.protocol === "https:") return { source, file: null }
  const path = explicit ? source : decodeURIComponent(source)
  const resolved = resolve(explicit ? process.cwd() : base, path)
  if (!explicit && (!path || isAbsolute(path) || /^[a-z][\w+.-]*:|^\\/i.test(path) || !within(base, resolved))) {
    throw new Error(`图片须为文章目录内的相对路径或有效的 HTTPS URL：${source}`)
  }
  const file = await realpath(resolved)
  if (!explicit && !within(base, file)) throw new Error(`图片位于文章目录之外：${source}`)
  const ext = extname(file).toLowerCase()
  if (![".png", ".jpg", ".jpeg"].includes(ext) || !(await stat(file)).isFile()) {
    throw new Error(`请提供 PNG 或 JPEG 文件：${source}`)
  }
  const header = Buffer.from(await Bun.file(file).slice(0, 8).arrayBuffer()).toString("hex")
  if (!header.startsWith(ext === ".png" ? "89504e470d0a1a0a" : "ffd8ff")) {
    throw new Error(`图片文件头与扩展名不符：${source}`)
  }
  return { source, file }
}

function manuscript(input: string) {
  const front = input.match(/^---\r?\n([\s\S]*?)(?<=\n)---[\t ]*(?:\r?\n|$)/)
  const parsed: unknown = front?.[1].trim() ? Bun.YAML.parse(front[1]) : {}
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Markdown frontmatter 必须是字段映射")
  const fields = parsed as Record<string, unknown>
  function field(key: string) {
    if (!Object.hasOwn(fields, key)) return ""
    const value = fields[key]
    if (typeof value !== "string") throw new Error(`frontmatter 的 ${key} 须为字符串`)
    return value.trim()
  }
  return { markdown: input.slice(front?.[0].length ?? 0), title: field("title"), summary: field("summary"), cover: field("cover_image") }
}

async function render(input: string, source: string, options: { title?: string; summary?: string; cover?: string }) {
  const draft = manuscript(input)
  const [{ JSDOM }, { default: createDOMPurify }] = await Promise.all([import("jsdom"), import("dompurify")])
  const dom = new JSDOM(Bun.markdown.html(draft.markdown))
  try {
    const { body } = dom.window.document
    body.querySelectorAll("[hidden],[aria-hidden='true']").forEach(el => el.remove())
    createDOMPurify(dom.window).sanitize(body, {
      IN_PLACE: true,
      ALLOWED_TAGS: tags,
      ALLOWED_ATTR: ["href", "src", "alt", "start", "colspan", "rowspan", "type", "checked"],
      ALLOW_ARIA_ATTR: false,
      ALLOW_DATA_ATTR: false,
    })
    for (const field of body.querySelectorAll("input")) {
      if (field.type === "checkbox") {
        const mark = field.checked ? "☑ " : "☐ "
        const next = field.nextElementSibling
        if (field.parentElement?.matches("li") && next?.matches("p")) next.prepend(mark)
        else field.before(mark)
      }
      field.remove()
    }

    const heading = body.firstElementChild?.matches("h1") ? body.firstElementChild : null
    const headingText = heading?.textContent?.trim() || ""
    const title = options.title || draft.title || headingText || basename(source, extname(source))
    if (heading && headingText === title && !heading.querySelector("img")) heading.remove()
    const summary = options.summary || draft.summary
    const base = dirname(source)
    const coverPath = options.cover || draft.cover
    const cover = coverPath ? await image(coverPath, base, Boolean(options.cover)) : null
    const images: Array<Awaited<ReturnType<typeof image>> & { marker: string; alt: string }> = []
    const warnings: string[] = []
    let prefix = "【微博插图"
    while (body.textContent?.includes(prefix)) prefix += "_"
    for (const img of body.querySelectorAll("img")) {
      const src = img.getAttribute("src")?.trim()
      if (!src) throw new Error(`第 ${images.length + 1} 张正文图缺少可用的图片地址`)
      const marker = `${prefix}${images.length + 1}】`
      images.push({ ...await image(src, base), marker, alt: img.getAttribute("alt") || "" })
      img.replaceWith(marker)
    }
    if (!body.textContent?.trim()) throw new Error("净化后的文章正文为空")

    let unlinked = 0
    for (const link of body.querySelectorAll("a")) {
      const url = webUrl(link.getAttribute("href")?.trim() || "")
      if (url) link.setAttribute("href", url.href)
      else {
        link.replaceWith(...link.childNodes)
        unlinked++
      }
    }
    if (unlinked) warnings.push(`${unlinked} 个无可用网页地址的链接已保留为文字`)
    if (images.some(item => !item.file) || (cover && !cover.file)) warnings.push("远程图片尚无本地文件，请按清单补齐")

    const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>微博头条文章预览</title></head><body>${body.innerHTML}</body></html>\n`
    body.querySelectorAll("div,p,br,h1,h2,h3,h4,h5,h6,blockquote,pre,li,tr").forEach(el => el.append("\n"))
    body.querySelectorAll("th,td").forEach(el => el.append("\t"))
    const text = `${body.textContent?.trim()}\n`
    return { title, summary, cover, images, warnings, html, text }
  } finally {
    dom.window.close()
  }
}

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      help: { type: "boolean", short: "h" },
      title: { type: "string" },
      summary: { type: "string" },
      cover: { type: "string" },
      "output-dir": { type: "string", short: "o" },
    },
  })
  if (values.help) {
    process.stdout.write(help)
    return
  }
  if (positionals.length !== 1) throw new Error("请提供一份本地 Markdown，可用 --help 查看用法")
  if (Object.values(values).some(value => typeof value === "string" && !value.trim())) throw new Error("选项值不能为空")
  if (!Bun.markdown?.html) throw new Error("请使用支持 Bun.markdown.html 的 Bun 1.3.8 或以上版本")
  const path = resolve(positionals[0])
  const ext = extname(path)
  if (![".md", ".markdown"].includes(ext.toLowerCase())) throw new Error("请提供 .md 或 .markdown 文件")
  const source = await realpath(path)
  const info = await stat(source)
  if (!info.isFile() || info.size > maxBytes) throw new Error("输入必须是 10 MiB 以内的 UTF-8 Markdown 文件")
  const data = await readFile(source)
  if (data.byteLength > maxBytes) throw new Error("输入超过 10 MiB 上限")
  const input = new TextDecoder("utf-8", { fatal: true }).decode(data)
  const { html, text, ...fields } = await render(input, source, { title: values.title?.trim(), summary: values.summary?.trim(), cover: values.cover })

  const dir = resolve(values["output-dir"] ?? join(dirname(path), `${basename(path, ext)}-weibo`))
  const files = { html: join(dir, "body.html"), text: join(dir, "body.txt"), meta: join(dir, "meta.json") }
  const meta = { status: "prepared", source, files, ...fields }
  await mkdir(dir)
  try {
    await writeFile(files.html, html, { flag: "wx" })
    await writeFile(files.text, text, { flag: "wx" })
    await writeFile(files.meta, JSON.stringify(meta, null, 2) + "\n", { flag: "wx" })
  } catch (error) {
    throw new Error(`写入中断，产物可能不完整（${dir}）：${error instanceof Error ? error.message : String(error)}`)
  }
  console.log(JSON.stringify(meta, null, 2))
}

try {
  await main()
} catch (error) {
  const code = (error as NodeJS.ErrnoException).code
  if (code === "ERR_MODULE_NOT_FOUND") console.error(`请先运行 bun install --frozen-lockfile --cwd "${import.meta.dir}"`)
  else if (code === "EEXIST") console.error(`输出目录已存在，请另选 --output-dir：${(error as NodeJS.ErrnoException).path}`)
  else console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
}
