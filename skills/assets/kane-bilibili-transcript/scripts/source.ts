import { createHash } from "node:crypto"
import { setTimeout as pause } from "node:timers/promises"

const api = "https://api.bilibili.com"
const site = "https://www.bilibili.com"
const videoHosts = new Set(["www.bilibili.com", "m.bilibili.com", "bilibili.com"])
const bvPattern = /^BV[0-9A-Za-z]{10}$/
const avPattern = /^av[1-9][0-9]*$/i
export const languagePattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/i
export type BrowserRequest = (path: string) => Promise<Record<string, unknown>>
const redirectCodes = new Set([301, 302, 303, 307, 308])
const mixinOrder = [
  46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35,
  27, 43, 5, 49, 33, 9, 42, 19, 29, 28, 14, 39, 12, 38, 41, 13,
]

export interface Video {
  bvid: string
  aid: number
  cid: number
  page: number
  title: string
  partTitle: string
  channel: string
  url: string
}

export interface Track {
  code: string
  name: string
  kind: "manual" | "generated"
  url: string
}

export function object(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined
}

function text(value: unknown): string {
  return typeof value === "string" ? value : ""
}

function positiveId(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0
}

function parseUrl(value: string, base?: URL): URL {
  let url: URL
  try {
    url = new URL(value, base)
  } catch {
    throw new Error("URL 无效")
  }
  if (url.protocol !== "https:" || url.username || url.password || url.port) {
    throw new Error("只接受不含凭据或自定义端口的 HTTPS URL")
  }
  return url
}

async function request(url: URL, headers: HeadersInit, signal: AbortSignal, label: string) {
  try {
    return await fetch(url, { headers, credentials: "omit", redirect: "manual", signal })
  } catch {
    throw new Error(signal.aborted ? `${label}请求超时` : `${label}网络请求失败`)
  }
}

async function nextUrl(res: Response, url: URL, redirects: number) {
  const location = res.headers.get("location")
  await res.body?.cancel()
  if (!location || redirects >= 5) throw new Error("重定向缺少目标或超过 5 次")
  return parseUrl(location, url)
}

function readPage(value: string) {
  const page = Number(value)
  if (!/^[1-9][0-9]*$/.test(value) || !positiveId(page)) throw new Error("分 P 必须是正整数")
  return page
}

function videoTarget(url: URL) {
  const id = url.pathname.match(/^\/video\/([^/]+)\/?$/)?.[1] ?? ""
  if (!videoHosts.has(url.hostname) || !(bvPattern.test(id) || avPattern.test(id))) {
    throw new Error("请提供 B 站普通视频链接、b23.tv 短链、BV 号或 av 号")
  }
  const page = url.searchParams.get("p")
  return { id, page: page === null ? 1 : readPage(page) }
}

async function resolveTarget(input: string) {
  if (bvPattern.test(input) || avPattern.test(input)) return { id: input, page: 1 }
  let url = parseUrl(input)
  const signal = AbortSignal.timeout(30_000)
  for (let redirects = 0; url.hostname === "b23.tv"; redirects++) {
    const res = await request(url, {}, signal, "B 站短链")
    if (!redirectCodes.has(res.status)) {
      await res.body?.cancel()
      throw new Error(`B 站短链未跳转至视频（HTTP ${res.status}）`)
    }
    url = await nextUrl(res, url, redirects)
  }
  return videoTarget(url)
}

async function getJson(url: URL, label: string, allowed: (url: URL) => boolean, headers: HeadersInit, types: string[]) {
  const signal = AbortSignal.timeout(30_000)
  for (let redirects = 0; ; redirects++) {
    if (!allowed(url)) throw new Error(`${label}地址不在允许的 B 站域名内`)
    const res = await request(url, headers, signal, label)
    if (redirectCodes.has(res.status)) {
      url = await nextUrl(res, url, redirects)
      continue
    }
    const type = res.headers.get("content-type")?.split(";")[0].trim().toLowerCase()
    if (!res.ok || !type || !types.includes(type)) {
      await res.body?.cancel()
      if (!res.ok) throw new Error(`${label}请求失败（HTTP ${res.status}）`)
      throw new Error(`${label}返回了非预期的内容类型`)
    }
    try {
      const raw = await res.text()
      const data: unknown = JSON.parse(raw)
      return { raw, data }
    } catch {
      throw new Error(signal.aborted ? `${label}请求超时` : `${label}响应不是有效的 JSON`)
    }
  }
}

function signQuery(params: Record<string, string>, keys: string, now: number) {
  const mixin = mixinOrder.map(i => keys[i]).join("")
  const query = Object.entries({ ...params, wts: String(now) })
    .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value.replace(/[!'()*]/g, ""))}`)
    .join("&")
  return `${query}&w_rid=${createHash("md5").update(query + mixin).digest("hex")}`
}

function key(value: unknown) {
  const match = parseUrl(text(value)).pathname.match(/\/([a-f0-9]{32})\.png$/i)
  if (!match) throw new Error("B 站未返回有效的 WBI 签名参数")
  return match[1]
}

function subtitleHost(url: URL) {
  return url.hostname.endsWith(".hdslb.com") || url.hostname === "subtitle.bilibili.com"
}

class RetryableError extends Error {}

async function retry<T>(request: () => Promise<T>) {
  const limit = 3
  for (let attempt = 0; ; attempt++) {
    try {
      return await request()
    } catch (error) {
      if (!(error instanceof RetryableError)) throw error
      if (attempt === limit) throw new Error(`${error.message}；已重试 ${limit} 次（共 ${limit + 1} 次请求），请稍后再试`)
      console.error(`${error.message}；2 秒后重试（${attempt + 1}/${limit}）`)
      await pause(2000)
    }
  }
}

function apiData(response: Record<string, unknown> | undefined, label: string, anonymous = false) {
  const code = response?.code
  if (code === -101 && !anonymous) throw new Error(`${label}需要登录，请检查 B 站浏览器会话`)
  const data = object(response?.data)
  if (code === -352 || data?.v_voucher) throw new RetryableError(`${label}触发了 B 站风控验证`)
  if ((code !== 0 && !(anonymous && code === -101)) || !data) {
    throw new Error(`${label}失败（B 站 API ${typeof code === "number" ? code : "响应异常"}）`)
  }
  return data
}

export async function openVideo(input: string, browser?: BrowserRequest) {
  const target = await resolveTarget(input)
  const headers = {
    Accept: "application/json, text/plain",
    Referer: `${site}/`,
    "User-Agent": "Mozilla/5.0 Chrome/131.0.0.0 Safari/537.36",
  }
  async function apiRequest(path: string, label: string) {
    if (browser) return browser(path)
    const { data } = await getJson(new URL(path, api), label, url => url.origin === api, headers, ["application/json"])
    return object(data)
  }

  const navData = await retry(async () => apiData(await apiRequest("/x/web-interface/nav", "B 站 WBI 参数"), "B 站 WBI 参数", true))
  if (browser && navData.isLogin !== true) throw new Error("当前浏览器未登录 B 站，请在浏览器中完成登录")
  const wbi = object(navData.wbi_img)
  if (!wbi) throw new Error("B 站未返回 WBI 签名参数")
  const keys = key(wbi.img_url) + key(wbi.sub_url)

  async function signed<T>(path: string, params: Record<string, string>, label: string, read: (data: Record<string, unknown>) => T) {
    return retry(async () => {
      const query = signQuery(params, keys, Math.floor(Date.now() / 1000))
      return read(apiData(await apiRequest(`${path}?${query}`, label), label))
    })
  }

  const isBV = bvPattern.test(target.id)
  const identity = isBV ? { bvid: target.id } : { aid: target.id.slice(2) }
  const detail = await signed("/x/web-interface/wbi/view/detail", { ...identity, need_elec: "0" }, "B 站视频详情", data => data)
  const view = object(detail.View)
  const bvid = text(view?.bvid)
  const aid = view?.aid
  if (!view || !bvPattern.test(bvid) || !positiveId(aid) || (isBV ? bvid !== target.id : String(aid) !== identity.aid)) {
    throw new Error("B 站返回的视频标识与请求不一致")
  }
  if (!Array.isArray(view.pages)) throw new Error("B 站未返回视频分 P 列表")
  const pages: unknown[] = view.pages
  const part = pages.map(object).find(item => item?.page === target.page)
  if (!part) throw new Error(`视频没有 P${target.page}`)
  const cid = part.cid
  if (!positiveId(cid)) throw new Error(`P${target.page} 未返回有效的 CID`)
  const video: Video = {
    bvid, aid, cid, page: target.page, title: text(view.title), partTitle: text(part.part),
    channel: text(object(view.owner)?.name) || text(object(detail.Card)?.name),
    url: `${site}/video/${bvid}/?p=${target.page}`,
  }

  function readTracks(player: Record<string, unknown>) {
    if ((player.aid !== undefined && player.aid !== aid) || (player.cid !== undefined && player.cid !== cid)) {
      throw new Error("B 站返回的字幕轨与请求的视频分 P 不一致")
    }
    const subtitles = object(player.subtitle)?.subtitles
    if (subtitles != null && !Array.isArray(subtitles)) throw new Error("B 站返回的字幕轨格式异常")
    const tracks: Track[] = []
    const rows: unknown[] = subtitles ?? []
    for (const item of rows) {
      const row = object(item)
      const code = text(row?.lan)
      const url = text(row?.subtitle_url)
      if (!languagePattern.test(code) || !url) continue
      const kind = row?.ai_type === 1 || /^ai-/i.test(code) ? "generated" : "manual"
      tracks.push({ code, name: text(row?.lan_doc) || code, kind, url })
    }
    if (!tracks.length) {
      if (player.need_login_subtitle === true) throw new Error("此分 P 的字幕需要登录，请使用或检查已登录的 B 站浏览器会话")
      if (rows.length) throw new Error(`P${target.page} 未返回有效的可下载字幕轨`)
      const hint = browser ? "" : "，部分字幕登录后才可见"
      throw new RetryableError(`P${target.page} 暂未返回可下载的字幕轨（可能无字幕，也可能为瞬时风控或空响应）${hint}`)
    }
    return tracks
  }

  const tracks = await signed("/x/player/wbi/v2", { aid: String(aid), cid: String(cid) }, "B 站字幕轨", readTracks)

  async function download(track: Track) {
    const url = parseUrl(track.url.startsWith("//") ? `https:${track.url}` : track.url)
    return getJson(url, "B 站字幕", subtitleHost, { ...headers, Referer: video.url }, ["application/json", "text/plain", "application/octet-stream"])
  }

  return { video, tracks, download }
}
