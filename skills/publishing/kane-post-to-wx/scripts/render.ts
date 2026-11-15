import createDOMPurify from "dompurify"
import { JSDOM } from "jsdom"
import { open, realpath, stat } from "node:fs/promises"
import { basename, extname, isAbsolute, relative, resolve, sep } from "node:path"
import juice from "juice"
import { loadTheme } from "./theme.ts"
import { pathToFileURL } from "node:url"
import { cleanClasses, decorateBlocks } from "./blocks.ts"

interface Options {
  title?: string
  author?: string
  summary?: string
  cover?: string
  sourceUrl?: string
  keepLinks?: boolean
  theme?: string
  themeCss?: string
}

interface Image {
  source: string
  file: string | null
  alt: string
  marker?: string
  style?: string
}

const tags = "article section div p br h1 h2 h3 h4 h5 h6 blockquote pre code ul ol li table thead tbody tfoot tr th td strong b em i s del u sub sup hr a img figure figcaption span input".split(" ")

function compact(value: string | null | undefined) {
  return value?.replace(/\s+/g, " ").trim() || ""
}

function webUrl(value: string) {
  if (!/^https?:\/\//i.test(value)) return null
  try {
    const url = new URL(value)
    return url.username || url.password ? null : url
  } catch {
    return null
  }
}

async function resolveImage(source: string, base: string, explicit = false): Promise<string | null> {
  if (webUrl(source)) return null
  const path = explicit ? source : decodeURIComponent(source)
  if (!path || (!explicit && (isAbsolute(path) || /^[a-z][\w+.-]*:|^\\/i.test(path)))) {
    throw new Error(`图片必须使用文章目录内的相对路径或有效的网址：${source}`)
  }
  const file = await realpath(resolve(explicit ? process.cwd() : base, path))
  const rel = relative(base, file)
  if (!explicit && (rel === ".." || rel.startsWith(`..${sep}`) || isAbsolute(rel))) {
    throw new Error(`图片位于文章目录之外：${source}`)
  }
  const ext = extname(file).toLowerCase()
  if (![".png", ".jpg", ".jpeg"].includes(ext)) throw new Error(`请提供 PNG 或 JPEG 图片：${source}`)
  if (!(await stat(file)).isFile()) throw new Error(`图片路径必须指向文件：${source}`)
  const input = await open(file, "r")
  try {
    const header = Buffer.alloc(8)
    const { bytesRead } = await input.read(header)
    const magic = ext === ".png" ? "89504e470d0a1a0a" : "ffd8ff"
    if (bytesRead < magic.length / 2 || !header.toString("hex").startsWith(magic)) {
      throw new Error(`图片文件头与扩展名不符：${source}`)
    }
  } finally {
    await input.close()
  }
  return file
}

export async function render(source: string, base: string, input: string, options: Options) {
  const theme = await loadTheme(options.theme, options.themeCss)
  const ext = extname(source).toLowerCase()
  const markdown = ext === ".md" || ext === ".markdown"
  const plain = ext === ".txt"
  const front = markdown ? input.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/) : null
  const meta: unknown = front?.[1].trim() ? Bun.YAML.parse(front[1]) : {}
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) throw new Error("Markdown frontmatter 必须是字段映射")
  const fields = meta as Record<string, unknown>
  const body = input.slice(front?.[0].length ?? 0)
  const dom = new JSDOM(markdown ? Bun.markdown.html(body) : plain ? "" : body)
  try {
    const doc = dom.window.document
    const field = (...keys: string[]) => keys.map(key => {
      const value = Object.hasOwn(fields, key) ? fields[key] : undefined
      if (typeof value === "string") return value.trim()
      return doc.querySelector(`meta[name="${key}"],meta[property="${key}"]`)?.getAttribute("content")?.trim()
    }).find(Boolean)
    if (plain) {
      for (const block of body.trim().split(/\r?\n[\t ]*\r?\n(?:[\t \r\n]*)/)) {
        const p = doc.createElement("p")
        for (const [i, line] of block.split(/\r?\n/).entries()) {
          if (i) p.append(doc.createElement("br"))
          p.append(line)
        }
        doc.body.append(p)
      }
    }

    const htmlTitle = compact(doc.title)
    doc.body.querySelectorAll("[hidden],[aria-hidden='true']").forEach(el => el.remove())
    createDOMPurify(dom.window).sanitize(doc.body, {
      IN_PLACE: true,
      ALLOWED_TAGS: ["body", ...tags],
      ALLOWED_ATTR: ["href", "src", "alt", "colspan", "rowspan", "start", "type", "checked", "class"],
      ALLOW_ARIA_ATTR: false,
      ALLOW_DATA_ATTR: false,
    })
    cleanClasses(doc)
    for (const el of doc.body.querySelectorAll("input")) {
      if (el.getAttribute("type") === "checkbox") el.replaceWith(el.hasAttribute("checked") ? "☑ " : "☐ ")
      else el.remove()
    }

    const heading = doc.body.querySelector("h1,h2")
    const title = compact(options.title) || compact(field("title", "og:title")) || htmlTitle
      || compact(heading?.textContent) || basename(source, extname(source))
    if (heading && compact(heading.textContent) === title && heading === doc.body.firstElementChild) heading.remove()
    const author = compact(options.author) || compact(field("author", "article:author"))
    const summary = compact(options.summary) || compact(field("description", "summary", "og:description"))
      || [...compact(doc.body.querySelector("p")?.textContent)].slice(0, 120).join("")
    const sourceUrl = options.sourceUrl?.trim() || field("sourceUrl", "contentSourceUrl", "content_source_url") || ""
    if (sourceUrl && webUrl(sourceUrl)?.protocol !== "https:") throw new Error("阅读原文链接须为不含凭据的 HTTPS URL")
    const coverSource = options.cover || field("cover", "coverImage", "featureImage", "cover_image", "og:image")
    const cover = coverSource
      ? { source: coverSource, file: await resolveImage(coverSource, base, options.cover !== undefined) }
      : null
    const warnings: string[] = []
    const images: Image[] = []
    let marker = "【正文图片"
    while (doc.body.textContent?.includes(marker)) marker += "_"
    for (const img of doc.body.querySelectorAll("img")) {
      const path = img.getAttribute("src")?.trim() || ""
      if (!path) throw new Error("正文图片缺少可用的 src，请改为文章目录内的 PNG 或 JPEG 相对路径")
      const file = await resolveImage(path, base)
      const id = `${marker}${images.length + 1}】`
      images.push({ marker: id, source: path, file, alt: img.getAttribute("alt") || "" })
    }
    if (!compact(doc.body.textContent) && !images.length) throw new Error("净化后的文章正文为空")

    const links = new Map<string, number>()
    let unsupported = 0
    for (const link of doc.body.querySelectorAll("a")) {
      const url = webUrl(link.getAttribute("href")?.trim() || "")
      if (url && (!markdown || options.keepLinks)) {
        link.setAttribute("href", url.href)
        continue
      }
      if (url) {
        const i = links.get(url.href) ?? links.size + 1
        links.set(url.href, i)
        link.append(`[${i}]`)
      } else {
        unsupported += 1
      }
      link.replaceWith(...link.childNodes)
    }
    if (unsupported) warnings.push(`${unsupported} 个非普通网页链接已转成文字`)
    if (links.size) {
      const h = doc.createElement("h2")
      h.textContent = "参考链接"
      const list = doc.createElement("ol")
      for (const url of links.keys()) {
        const item = doc.createElement("li")
        item.textContent = url
        list.append(item)
      }
      doc.body.append(h, list)
    }
    if (images.some(image => !image.file) || (cover && !cover.file)) {
      warnings.push("有远程图片尚未准备本地文件，请补齐后再保存完整草稿或发表")
    }

    decorateBlocks(doc)
    const styled = juice.inlineContent(`<section id="nice">${doc.body.innerHTML}</section>`, theme.css, {
      applyAttributesTableElements: false,
      applyWidthAttributes: false,
      applyHeightAttributes: false,
      inlinePseudoElements: false,
      preserveImportant: true,
      preserveFontFaces: false,
      preserveMediaQueries: false,
      preserveKeyFrames: false,
      preservePseudos: false,
      insertPreservedExtraCss: false,
    })
    const output = new JSDOM(styled)
    try {
      const view = output.window.document
      for (const [i, img] of [...view.body.querySelectorAll("img")].entries()) {
        const item = images[i]
        item.style = img.getAttribute("style") || ""
        if (item.file) img.setAttribute("src", pathToFileURL(item.file).href)
        else img.replaceWith(item.marker!)
      }
      const head = '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
      const heading = view.createElement("h1")
      heading.textContent = title
      heading.setAttribute("style", "margin:0 0 32px;font:700 24px/1.5 sans-serif;color:#24292f")
      const preview = `${head}<body style="max-width:680px;margin:32px auto;padding:0 20px;box-sizing:border-box">${heading.outerHTML}${view.body.innerHTML}</body>\n`
      let i = 0
      const localImages = [...view.body.querySelectorAll("img")]
      for (const item of images) {
        if (item.file) localImages[i++]?.replaceWith(item.marker!)
      }
      const html = `${head}${view.body.innerHTML}\n`
      view.body.querySelectorAll(".code-block > .quote-block-label").forEach(el => el.remove())
      view.body.querySelectorAll("p,div,section,li,pre,tr,h1,h2,h3,h4,h5,h6,br").forEach(el => el.append("\n"))
      const text = (view.body.textContent || "").trim() + "\n"
      return { html, preview, text, title, author, summary, sourceUrl, cover, images, warnings, theme: { name: theme.name, files: theme.files } }
    } finally {
      output.window.close()
    }
  } finally {
    dom.window.close()
  }
}
