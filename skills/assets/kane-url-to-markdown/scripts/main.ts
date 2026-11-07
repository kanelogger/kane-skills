import { mkdir, readFile, stat, writeFile } from "node:fs/promises"
import { dirname, join, resolve } from "node:path"
import { parseArgs } from "node:util"
import { capturePage } from "./browser.ts"
import type { Article } from "./extract.ts"

const maxBytes = 10 * 1024 * 1024
const help = `用法：bun main.ts <HTTPS URL> <输入选项> [--output <文件>]

  --markdown <文件>      保存网页读取工具返回的完整 Markdown
  --html <文件>          转换工具获取的 UTF-8 HTML
  --ego-space <ID>       读取 ego-browser TaskSpace 的 p1 页面
  --bsk-session <ID>     读取 browser-skill 的任务页
  -o, --output <文件>    输出路径，拒绝覆盖
  -h, --help             查看帮助

四种输入选项必须且只能选一种。脚本不自行请求 URL，也不导航或创建浏览器会话。
默认输出：url-to-markdown/<最终域名>/<页面名>.md
HTML 转换依赖安装：在本脚本目录运行 bun install --frozen-lockfile。
`

function parseUrl(value: string) {
  const url = new URL(value)
  if (url.protocol !== "https:" || url.username || url.password || url.port) throw new Error("只接受不含凭据或自定义端口的 HTTPS URL")
  if (url.hostname === "." || url.hostname === "..") throw new Error("URL 域名不能是相对目录")
  return url
}

function slug(url: URL, title: string) {
  let text = url.pathname.split("/").filter(Boolean).at(-1) ?? title
  try { text = decodeURIComponent(text) } catch {}
  return text.normalize("NFKC").replace(/\.(?:html?|xhtml|php|aspx?)$/i, "")
    .toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "page"
}

async function input(path: string) {
  const file = resolve(path)
  const info = await stat(file)
  if (!info.isFile() || info.size > maxBytes) throw new Error("输入必须是 10 MiB 以内的 UTF-8 文件")
  const data = await readFile(file)
  if (data.byteLength > maxBytes) throw new Error("输入超过 10 MiB 上限")
  return new TextDecoder("utf-8", { fatal: true }).decode(data)
}

function fromMarkdown(text: string, source: URL) {
  const front = text.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)
  const data: unknown = front ? Bun.YAML.parse(front[1]) : {}
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("Markdown frontmatter 必须是字段映射")
  const meta = data as Record<string, unknown>
  const field = (key: string) => typeof meta[key] === "string" && meta[key].trim() ? meta[key].trim() : undefined
  const body = text.slice(front?.[0].length ?? 0)
  if (!body.trim()) throw new Error("工具返回的 Markdown 正文为空")
  const name = field("title") || body.match(/^(?:\r?\n)*#[ \t]+([^\r\n]+)/)?.[1]
  const url = parseUrl(field("url") ?? source.href)
  const article: Article = {
    title: name || url.hostname,
    author: field("author"), published: field("published"), site: field("site"), language: field("language"),
    markdown: body, warnings: name ? [] : ["未取得标题，使用来源域名，请核对原页"],
  }
  return { article, url }
}

async function main() {
  const { values, positionals } = parseArgs({ allowPositionals: true, options: {
    help: { type: "boolean", short: "h" }, output: { type: "string", short: "o" },
    markdown: { type: "string" }, html: { type: "string" },
    "ego-space": { type: "string" }, "bsk-session": { type: "string" },
  } })
  if (values.help) { process.stdout.write(help); return }
  if (positionals.length !== 1) throw new Error("请提供一个 HTTPS URL，可用 --help 查看用法")
  const modes = [values.markdown, values.html, values["ego-space"], values["bsk-session"]]
  if (modes.filter(value => value !== undefined).length !== 1 || modes.includes("") || values.output === "") {
    throw new Error("必须选择一种非空输入：--markdown、--html、--ego-space 或 --bsk-session")
  }
  const source = parseUrl(positionals[0].trim())
  let url = source
  let article: Article
  let body: string
  let capture: string
  if (values.markdown !== undefined) {
    ;({ article, url } = fromMarkdown(await input(values.markdown), source))
    body = article.markdown
    capture = "tool-markdown"
  } else {
    const page = values.html !== undefined
      ? { html: await input(values.html), url: source.href }
      : await capturePage(source.href, values["ego-space"], values["bsk-session"])
    if (Buffer.byteLength(page.html) > maxBytes) throw new Error("浏览器 HTML 超过 10 MiB 上限")
    let extract: typeof import("./extract.ts")
    try { extract = await import("./extract.ts") } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ERR_MODULE_NOT_FOUND") throw new Error(`请先运行 bun install --frozen-lockfile --cwd "${import.meta.dir}"`)
      throw error
    }
    article = await extract.extractPage(page.html, page.url)
    const title = article.title.replace(/\s+/g, " ").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/[\\`*_{}\[\]()#+.!|~^=-]/g, "\\$&")
    body = `# ${title}\n\n${article.markdown}`
    capture = values.html !== undefined ? "browser-html" : values["ego-space"] !== undefined ? "ego-browser" : "browser-skill"
  }
  const file = resolve(values.output ?? join("url-to-markdown", url.hostname, `${slug(url, article.title)}.md`))
  const meta = { title: article.title, source: source.href, url: url.href, author: article.author, published: article.published,
    site: article.site, language: article.language, fetched_at: new Date().toISOString(), capture }
  const yaml = Object.entries(meta).filter(([, value]) => value !== undefined && value !== "")
    .map(([key, value]) => `${key}: ${JSON.stringify(value)}`).join("\n")
  await mkdir(dirname(file), { recursive: true })
  await writeFile(file, `---\n${yaml}\n---\n\n${body}${body.endsWith("\n") ? "" : "\n"}`, { flag: "wx" })
  console.log(JSON.stringify({ file, url: url.href, title: article.title, characters: article.markdown.length, capture, warnings: article.warnings }, null, 2))
}

try { await main() } catch (error) {
  console.error(error instanceof Error ? error.message : "URL 转 Markdown 失败")
  process.exitCode = 1
}
