import { readFile, readdir } from "node:fs/promises"
import { join, resolve } from "node:path"
import postcss from "postcss"

const dir = join(import.meta.dir, "../themes")
const pseudos = new Set([
  "not", "is", "where", "has", "empty", "root",
  "first-child", "last-child", "only-child", "nth-child", "nth-last-child",
  "first-of-type", "last-of-type", "only-of-type", "nth-of-type", "nth-last-of-type",
])

export async function listThemes() {
  const entries = await readdir(dir, { withFileTypes: true })
  return entries.filter(entry => entry.isFile() && /^[a-z0-9][a-z0-9-]*\.css$/.test(entry.name))
    .map(entry => entry.name.slice(0, -4)).sort()
}

async function readCss(file: string) {
  const data = await readFile(file)
  if (data.byteLength > 256 * 1024) throw new Error(`主题 CSS 不能超过 256 KiB：${file}`)
  const css = new TextDecoder("utf-8", { fatal: true }).decode(data)
  if (!css.trim()) throw new Error(`主题 CSS 不能为空：${file}`)
  const root = postcss.parse(css, { from: file })
  root.walkComments(node => { node.remove() })
  if (/\\|(?:url|image|image-set|-webkit-image-set|src|expression)\s*\(|(?:java|vb)script\s*:/i.test(root.toString())) {
    throw new Error(`主题 CSS 不支持资源 URL、转义或可执行表达式：${file}`)
  }
  root.walkAtRules(node => { throw node.error("主题 CSS 只支持可内联的普通规则，不支持 @ 规则") })
  root.walkRules(node => {
    if (node.parent?.type !== "root") throw node.error("请将嵌套 CSS 展开为普通选择器")
    if (node.selector.includes("::") || [...node.selector.matchAll(/:([a-z-]+)/gi)].some(match => !pseudos.has(match[1].toLowerCase()))) {
      throw node.error("主题 CSS 不支持伪元素或交互状态，请使用普通元素或结构伪类")
    }
  })
  root.walkDecls(node => {
    if (node.parent?.type !== "rule" || /^(?:behavior|-moz-binding)$/i.test(node.prop)) {
      throw node.error("无效的主题 CSS 属性")
    }
  })
  return root.toString()
}

export async function loadTheme(name = "irene-green", custom?: string) {
  const names = await listThemes()
  if (!names.includes(name)) throw new Error(`未知主题：${name}。可用主题：${names.join(", ")}`)
  const files = [join(dir, "irene-green.css")]
  if (name !== "irene-green") files.push(join(dir, `${name}.css`))
  if (custom) files.push(resolve(custom))
  const css = (await Promise.all(files.map(readCss))).join("\n")
  return { css, name, files }
}
