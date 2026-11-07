export interface BrowserPage {
  url: string
  html: string
}

function snapshot(expected: string): BrowserPage {
  if (location.href !== expected) throw new Error("任务页地址已改变，请重新观察后使用最终 URL")
  const root = document.querySelector("article") || document.querySelector("main") || document.body
  if (!root) throw new Error("页面没有正文")
  const doc = document.implementation.createHTMLDocument(document.title)
  doc.documentElement.lang = document.documentElement.lang
  const base = doc.createElement("base")
  base.href = document.baseURI
  doc.head.append(base)
  for (const node of document.head.querySelectorAll('meta[name="author"], meta[name="description"], meta[property="og:title"], meta[property="og:site_name"], meta[property="article:published_time"], meta[itemprop="datePublished"]')) {
    const meta = doc.createElement("meta")
    for (const key of ["name", "property", "itemprop", "content"]) {
      if (node.hasAttribute(key)) meta.setAttribute(key, node.getAttribute(key)!)
    }
    doc.head.append(meta)
  }
  const copy = root.cloneNode(true) as HTMLElement
  const imgs = root.querySelectorAll("img")
  copy.querySelectorAll("img").forEach((img, i) => {
    const src = imgs[i].currentSrc || imgs[i].src
    if (src) img.setAttribute("src", src)
  })
  const nodes = [copy, ...copy.querySelectorAll("*")]
  const source = [root, ...root.querySelectorAll("*")]
  source.forEach((node, i) => {
    const style = getComputedStyle(node)
    if (node.hasAttribute("hidden") || node.getAttribute("aria-hidden") === "true" || style.display === "none" || style.visibility === "hidden" || style.visibility === "collapse") {
      if (i === 0) throw new Error("正文尚未显示")
      nodes[i].remove()
    }
  })
  copy.querySelectorAll("script, style, link, meta, form, input, button, textarea, select, iframe, object, embed, template, noscript").forEach(node => node.remove())
  const attrs = new Set(["href", "src", "alt", "title", "colspan", "rowspan", "start", "reversed", "lang", "dir"])
  for (const node of [copy, ...copy.querySelectorAll("*")]) {
    for (const attr of [...node.attributes]) {
      if (attr.name === "class" && /^(CODE|PRE)$/.test(node.tagName)) {
        const langs = attr.value.match(/(?:^|\s)language-[\w+-]+/g)
        if (langs) {
          node.setAttribute("class", langs.join(" ").trim())
          continue
        }
      }
      if (!attrs.has(attr.name)) node.removeAttribute(attr.name)
    }
  }
  doc.body.append(copy)
  return { url: location.href, html: `<!doctype html>${doc.documentElement.outerHTML}` }
}

function object(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined
}

async function run(args: string[]) {
  const child = Bun.spawn(args, { stdout: "pipe", stderr: "pipe", stdin: "ignore", timeout: 30_000, killSignal: "SIGKILL" })
  const [code, out, err] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
  if (code !== 0) throw new Error(`${args[0]} 调用失败：${err.trim() || out.trim() || `退出码 ${code}`}`)
  return args[0] === "ego-browser" ? `${out}\n${err}` : out
}

export async function capturePage(url: string, ego?: string, bsk?: string): Promise<BrowserPage> {
  const code = `(${snapshot.toString()})(${JSON.stringify(url)})`
  let value: unknown
  if (ego !== undefined && bsk === undefined) {
    if (!/^[1-9][0-9]*$/.test(ego) || !Number.isSafeInteger(Number(ego))) throw new Error("--ego-space 需要有效的 TaskSpace ID")
    const out = await run(["ego-browser", "nodejs", "-e", `const task = await taskSpace(${Number(ego)});
const result = await task.page("p1").evaluate(${JSON.stringify(code)});
console.log("URL_MD_RESULT:" + JSON.stringify(result));`])
    const line = out.split("\n").find(line => line.startsWith("URL_MD_RESULT:"))
    value = JSON.parse(line?.slice("URL_MD_RESULT:".length) ?? "null")
  } else if (bsk !== undefined && ego === undefined) {
    if (!/^[a-z0-9-]+$/i.test(bsk)) throw new Error("--bsk-session 需要有效的浏览器会话 ID")
    const sync = object(JSON.parse(await run(["bsk", "cooperate", "sync", "--session", bsk])))
    const state = object(sync?.state)
    if (state?.mode !== "ready" || state.editing === true || typeof sync?.context_id !== "string" || typeof sync.observation_id !== "string") {
      throw new Error("浏览器当前不可操作，请按工具规则交回控制权后重新观察")
    }
    const reply = object(JSON.parse(await run(["bsk", "evaluate", "--session", bsk, "--context", sync.context_id, "--observation", sync.observation_id, "--json", code])))
    if (reply?.ok === true) value = reply.value
  } else {
    throw new Error("请选择一个浏览器会话")
  }
  if (!value || typeof value !== "object" || !("html" in value) || !("url" in value) || typeof value.html !== "string" || value.url !== url) {
    throw new Error("浏览器没有返回目标页 HTML，请重新观察任务页")
  }
  return { url, html: value.html }
}
