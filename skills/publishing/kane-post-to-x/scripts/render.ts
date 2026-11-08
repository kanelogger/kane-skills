import createDOMPurify from "dompurify"
import { JSDOM } from "jsdom"
import { open, realpath, stat } from "node:fs/promises"
import { basename, dirname, extname, isAbsolute, relative, resolve, sep } from "node:path"

const tags = "body p br h1 h2 h3 h4 h5 h6 blockquote pre code ul ol li table thead tbody tr th td strong em del s hr a img input".split(" ")
const headers: Record<string, RegExp> = {
  ".png": /^89504e470d0a1a0a/,
  ".jpg": /^ffd8ff/,
  ".jpeg": /^ffd8ff/,
  ".gif": /^47494638(?:3761|3961)/,
  ".webp": /^52494646[0-9a-f]{8}57454250/,
}

function compact(value: string | null | undefined) {
  return value?.replace(/\s+/g, " ").trim() || ""
}

function webUrl(value: string) {
  if (!/^https?:\/\//i.test(value)) return null
  const url = URL.parse(value)
  return url && !url.username && !url.password ? url : null
}

async function image(src: string, base: string, explicit = false) {
  if (!explicit && webUrl(src)?.protocol === "https:") return null
  const path = explicit ? src : decodeURIComponent(src)
  const drivePath = explicit && process.platform === "win32" && /^[a-z]:[\\/]/i.test(path)
  const uri = /^[a-z][\w+.-]*:/i.test(path) && !drivePath
  if (!path || uri || /^[\\/]{2}|^\\/.test(path) || (!explicit && isAbsolute(path))) {
    const hint = explicit ? "封面须使用本地路径" : "图片须使用文章目录内的相对路径或 HTTPS 地址"
    throw new Error(`${hint}：${src}`)
  }
  const file = await realpath(resolve(explicit ? process.cwd() : base, path))
  const rel = relative(base, file)
  if (!explicit && (rel === ".." || rel.startsWith(`..${sep}`) || isAbsolute(rel))) {
    throw new Error(`图片位于文章目录之外：${src}`)
  }
  const header = headers[extname(file).toLowerCase()]
  if (!header || !(await stat(file)).isFile()) throw new Error(`请提供 PNG、JPEG、GIF 或 WebP 文件：${src}`)
  const input = await open(file, "r")
  try {
    const buf = Buffer.alloc(12)
    const { bytesRead } = await input.read(buf)
    if (!header.test(buf.subarray(0, bytesRead).toString("hex"))) throw new Error(`图片文件头与扩展名不符：${src}`)
  } finally {
    await input.close()
  }
  return file
}

export async function render(source: string, input: string, options: { title?: string; cover?: string }) {
  const front = input.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)
  const meta: unknown = front?.[1].trim() ? Bun.YAML.parse(front[1]) : {}
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) throw new Error("Markdown frontmatter 必须是字段映射")
  const fields = meta as Record<string, unknown>
  const field = (key: string) => {
    if (!Object.hasOwn(fields, key)) return ""
    const val = fields[key]
    if (typeof val !== "string") throw new Error(`frontmatter 的 ${key} 必须是字符串`)
    return val.trim()
  }

  const raw = Bun.markdown.html(input.slice(front?.[0].length ?? 0), { noHtmlBlocks: true, noHtmlSpans: true })
  const dom = new JSDOM(raw)
  try {
    const { body } = dom.window.document
    createDOMPurify(dom.window).sanitize(body, {
      IN_PLACE: true,
      ALLOWED_TAGS: tags,
      ALLOWED_ATTR: ["href", "src", "alt", "start", "type", "checked"],
      ALLOW_ARIA_ATTR: false,
      ALLOW_DATA_ATTR: false,
    })
    for (const el of body.querySelectorAll("input")) {
      if (el.getAttribute("type") === "checkbox") el.replaceWith(el.hasAttribute("checked") ? "☑ " : "☐ ")
      else el.remove()
    }

    const heading = body.firstElementChild
    const firstTitle = heading?.tagName === "H1" ? compact(heading.textContent) : ""
    const givenTitle = compact(options.title ?? field("title"))
    const title = givenTitle || firstTitle || basename(source, extname(source))
    if (firstTitle && firstTitle === title && !heading?.querySelector("img,a")) heading?.remove()

    const base = dirname(source)
    const coverSrc = options.cover ?? (field("cover_image") || field("cover") || field("image"))
    const cover = coverSrc ? { source: coverSrc, file: await image(coverSrc, base, options.cover !== undefined) } : null
    const images: { source: string; file: string | null; alt: string; marker: string }[] = []
    let prefix = "【XIMGPH_"
    while (body.textContent?.includes(prefix)) prefix = `【XIMGPH_${crypto.randomUUID().slice(0, 8)}_`
    for (const el of body.querySelectorAll("img")) {
      const src = el.getAttribute("src")?.trim() || ""
      if (!src) throw new Error("正文图片缺少可用的路径或 HTTPS 地址")
      const file = await image(src, base)
      const marker = `${prefix}${images.length + 1}】`
      images.push({ source: src, file, alt: el.getAttribute("alt") || "", marker })
      el.replaceWith(marker)
    }
    if (!compact(body.textContent)) throw new Error("文章正文为空")

    const warnings: string[] = []
    if (!givenTitle && !firstTitle) warnings.push("文章标题来自文件名，请核对")
    let unsupported = 0
    for (const el of body.querySelectorAll("a")) {
      const url = webUrl(el.getAttribute("href")?.trim() || "")
      if (url) el.setAttribute("href", url.href)
      else {
        unsupported += 1
        el.replaceWith(...el.childNodes)
      }
    }
    if (unsupported) warnings.push(`${unsupported} 个相对链接或非 HTTP(S) 链接已保留为文字`)
    if (images.some(item => !item.file) || (cover && !cover.file)) {
      warnings.push("远程图片尚未准备本地副本，请补齐后再交接完整稿件")
    }

    const html = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><body>\n${body.innerHTML}</body>\n`
    for (const el of body.querySelectorAll("a")) {
      const url = el.getAttribute("href")
      if (compact(el.textContent) !== url) el.append(` (${url})`)
    }
    body.querySelectorAll("br").forEach(el => el.replaceWith("\n"))
    body.querySelectorAll("li").forEach(el => el.prepend("• "))
    body.querySelectorAll("p,li,ul,ol,pre,tr,blockquote,h1,h2,h3,h4,h5,h6").forEach(el => el.append("\n"))
    body.querySelectorAll("th,td").forEach(el => el.append("\t"))
    const text = (body.textContent || "").trim() + "\n"
    return { html, text, title, cover, images, warnings }
  } finally {
    dom.window.close()
  }
}
