import { object, type BrowserRequest } from "./source.ts"

const resultPrefix = "BILI_RESULT:"

async function query(path: string) {
  const origin = "https://api.bilibili.com"
  const url = new URL(path, origin)
  if (location.origin !== origin || url.origin !== origin || ![
    "/x/web-interface/nav", "/x/web-interface/wbi/view/detail", "/x/player/wbi/v2",
  ].includes(url.pathname)) throw new Error("Unexpected Bilibili origin or endpoint")
  const response = await fetch(url, {
    credentials: "same-origin", mode: "same-origin", redirect: "error", signal: AbortSignal.timeout(25_000),
  })
  if (!response.ok) return { status: response.status }
  if (response.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
    return { unexpectedType: true }
  }
  function fields(value: unknown): Record<string, unknown> {
    return value && typeof value === "object" ? value as Record<string, unknown> : {}
  }
  const { code, data: payload } = fields(await response.json())
  if (!payload) return { code }
  const data = fields(payload)
  if (typeof data.v_voucher === "string") return { code, data: { v_voucher: true } }
  if (url.pathname === "/x/web-interface/nav") {
    const { img_url, sub_url } = fields(data.wbi_img)
    return { code, data: { isLogin: data.isLogin, wbi_img: { img_url, sub_url } } }
  }
  if (url.pathname === "/x/web-interface/wbi/view/detail") {
    const view = fields(data.View)
    const pages = Array.isArray(view.pages) ? view.pages.map((row: unknown) => {
      const { page, cid, part } = fields(row)
      return { page, cid, part }
    }) : view.pages
    const owner = { name: fields(view.owner).name || fields(data.Card).name }
    return { code, data: { View: { bvid: view.bvid, aid: view.aid, title: view.title, owner, pages } } }
  }
  const rows = fields(data.subtitle).subtitles
  const subtitles = Array.isArray(rows) ? rows.map((row: unknown) => {
    const { lan, lan_doc, ai_type, subtitle_url } = fields(row)
    return { lan, lan_doc, ai_type, subtitle_url }
  }) : rows
  return { code, data: { aid: data.aid, cid: data.cid, need_login_subtitle: data.need_login_subtitle, subtitle: { subtitles } } }
}

const querySource = query.toString()

async function run(argv: string[], label: string): Promise<Record<string, unknown>> {
  const child = (() => {
    try {
      return Bun.spawn(argv, { stdout: "pipe", stderr: "pipe", stdin: "ignore", timeout: 30_000, killSignal: "SIGKILL" })
    } catch {
      throw new Error(`无法启动 ${label}，请检查浏览器工具是否已安装`)
    }
  })()
  const [code, stdout, stderr] = await Promise.all([child.exited, child.stdout.text(), child.stderr.text()])
  if (code !== 0) throw new Error(`${label} 无法读取浏览器会话，请按该工具的流程检查连接和控制状态`)
  try {
    const payload = label === "ego-browser"
      ? `${stdout}\n${stderr}`.split("\n").find(line => line.startsWith(resultPrefix))?.slice(resultPrefix.length)
      : stdout
    const result = object(JSON.parse(payload ?? ""))
    if (result) return result
  } catch {}
  throw new Error(`${label} 未返回有效的 JSON 响应`)
}

export function browserRequest(egoSpace?: string, bskSession?: string): BrowserRequest | undefined {
  if (egoSpace !== undefined && bskSession !== undefined) throw new Error("请只选择一种浏览器会话")
  let evaluate: (input: string) => Promise<Record<string, unknown> | undefined>
  if (egoSpace !== undefined) {
    const id = Number(egoSpace)
    if (!/^[1-9][0-9]*$/.test(egoSpace) || !Number.isSafeInteger(id)) throw new Error("--ego-space 需要有效的 TaskSpace ID")
    evaluate = input => run(["ego-browser", "nodejs", "-e", `const task = await taskSpace(${id});
const result = await task.page("p1").evaluate(${querySource}, ${input});
console.log(${JSON.stringify(resultPrefix)} + JSON.stringify(result));`], "ego-browser")
  } else if (bskSession !== undefined) {
    if (!/^[a-z0-9-]+$/i.test(bskSession)) throw new Error("--bsk-session 需要有效的浏览器会话 ID")
    evaluate = async input => {
      const sync = await run(["bsk", "cooperate", "sync", "--session", bskSession], "browser-skill")
      if (typeof sync.context_id !== "string" || typeof sync.observation_id !== "string") {
        throw new Error("browser-skill 的会话当前不可操作，请确认控制权")
      }
      const reply = await run(["bsk", "evaluate", "--session", bskSession, "--context", sync.context_id,
        "--observation", sync.observation_id, "--json", `(${querySource})(${input})`], "browser-skill")
      if (reply.ok === true) return object(reply.value)
    }
  } else {
    return
  }

  return async path => {
    const result = await evaluate(JSON.stringify(path))
    if (!result) throw new Error("浏览器未返回 B 站查询结果，请检查任务页是否停留在 B 站 API 域名")
    if (typeof result.status === "number") throw new Error(`B 站浏览器请求失败（HTTP ${result.status}）`)
    if (result.unexpectedType === true) throw new Error("B 站浏览器请求返回了非预期的内容类型")
    return result
  }
}
