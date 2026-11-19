import { posix } from "node:path"

type Read = (path: string) => Promise<string | null>
type Options = {
  sources?: Map<string, string>
  exists?: (path: string) => Promise<boolean>
  include?: (target: string, source: string, anchor: string) => boolean
}

function markdown(body: string) {
  const links = new Set<string>()
  const anchors = new Set<string>()
  const slugs = new Map<string, number>()
  Bun.markdown.render(body, {
    link(text, { href }) { links.add(href); return text },
    image(text, { src }) { links.add(src); return text },
    heading(text) {
      const base = text.trim().toLowerCase().replace(/[\p{P}\p{S}]/gu, c => c === "-" || c === "_" ? c : "").replace(/ /g, "-")
      let id = base
      if (slugs.has(base)) {
        let index = slugs.get(base)!
        do { id = base + "-" + ++index } while (slugs.has(id))
        slugs.set(base, index)
      }
      slugs.set(id, 0)
      anchors.add(id)
      return text
    },
  })
  if (body.includes("<")) {
    new HTMLRewriter().on("[id], a[name]", { element(el) {
      for (const key of ["id", "name"]) {
        const id = el.getAttribute(key)
        if (id) anchors.add(id)
      }
    } }).transform(Bun.markdown.html(body))
  }
  return { links, anchors }
}

export function lostAnchors(before: string, after: string): Set<string> {
  const lost = markdown(before).anchors
  for (const anchor of markdown(after).anchors) lost.delete(anchor)
  return lost
}

export async function checkLinks(read: Read, paths: string[], options: Options = {}): Promise<string[]> {
  const issues: string[] = []
  const targets = new Map<string, ReturnType<typeof markdown> | null>()
  async function document(path: string) {
    if (!targets.has(path)) {
      const body = await read(path)
      targets.set(path, body === null ? null : markdown(body))
    }
    return targets.get(path)
  }
  for (const source of new Set(paths.filter(path => /\.(?:md|markdown)$/i.test(path)))) {
    const part = options.sources?.get(source)
    const doc = part === undefined ? await document(source) : markdown(part)
    if (!doc) { issues.push(source + " 缺少要检查的 Markdown 文件"); continue }
    for (const href of doc.links) {
      if (/^(?:[a-z][a-z0-9+.\-]*:|\/\/)/i.test(href)) continue
      let selected = !options.include
      try {
        const [ref, fragment] = href.split(/#(.*)/s)
        const file = decodeURIComponent(ref!.split("?")[0]!)
        const anchor = decodeURIComponent(fragment ?? "")
        if (file.includes("\\") || file.includes("\0") || file.startsWith("/")) throw new Error("需要项目内相对路径")
        const path = file ? posix.join(posix.dirname(source), file).replace(/\/$/, "") || "." : source
        if (path === ".." || path.startsWith("../")) throw new Error("链接越过项目目录")
        if (options.include && !options.include(path, source, anchor)) continue
        selected = true
        if (anchor && /\.(?:md|markdown)$/i.test(path)) {
          const target = await document(path)
          if (!target) throw new Error("目标文件缺失")
          if (!target.anchors.has(anchor)) throw new Error("目标锚点缺失")
        } else if (path !== "." && !(options.exists ? await options.exists(path) : (await read(path)) !== null)) {
          throw new Error("目标路径缺失")
        }
      } catch (err) {
        if (selected) issues.push(source + " → " + href + "（" + (err instanceof Error ? err.message : String(err)) + "）")
      }
    }
  }
  return issues
}
