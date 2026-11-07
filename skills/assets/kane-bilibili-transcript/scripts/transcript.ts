import { object } from "./source.ts"
import type { Track, Video } from "./source.ts"

export const formats = ["md", "srt", "vtt", "txt", "json"] as const
type Format = typeof formats[number]

interface Cue {
  startMs: number
  durationMs: number
  text: string
}

export function selectTrack(tracks: Track[], languages: string[], only?: Track["kind"]) {
  const eligible = only ? tracks.filter(track => track.kind === only) : tracks
  const preferred = (matches: Track[]) => matches.find(track => track.kind === "manual") ?? matches[0]
  if (!languages.length) {
    const track = preferred(eligible)
    if (track) return track
  }
  for (const lang of languages) {
    const code = lang.toLowerCase()
    const exact = preferred(eligible.filter(track => track.code.toLowerCase() === code))
    const match = exact ?? eligible.find(track => track.code.toLowerCase() === `ai-${code}`)
    if (match) return match
  }
  const available = [...new Set(tracks.map(track => `${track.code} (${track.kind})`))].join(", ")
  throw new Error(`没有符合语言或字幕类型要求的轨道。可用轨道：${available}`)
}

function milliseconds(value: unknown) {
  if (typeof value !== "number" || value < 0) return NaN
  return Math.round(value * 1000)
}

export function parseCues(document: unknown): Cue[] {
  const body = object(document)?.body
  if (!Array.isArray(body)) throw new Error("B 站字幕 JSON 缺少 body 数组")
  const rows: unknown[] = body
  const cues: Cue[] = []
  for (const [index, item] of rows.entries()) {
    const row = object(item)
    const text = row?.content
    const startMs = milliseconds(row?.from)
    const endMs = milliseconds(row?.to)
    if (typeof text !== "string" || !Number.isSafeInteger(startMs) || !Number.isSafeInteger(endMs) || endMs <= startMs) {
      throw new Error(`第 ${index + 1} 条字幕的文字或时间轴无效`)
    }
    if (text.trim()) cues.push({ startMs, durationMs: endMs - startMs, text: text.replace(/\r\n?/g, "\n") })
  }
  if (!cues.length) throw new Error("B 站字幕正文为空")
  return cues.sort((left, right) => left.startMs - right.startMs)
}

function timestamp(ms: number, separator = ".") {
  const hours = Math.floor(ms / 3_600_000)
  const minutes = Math.floor(ms / 60_000) % 60
  const seconds = Math.floor(ms / 1000) % 60
  return [hours, minutes, seconds].map(n => String(n).padStart(2, "0")).join(":") + separator + String(ms % 1000).padStart(3, "0")
}

function timeRange(cue: Cue, arrow: string, separator?: string) {
  return `${timestamp(cue.startMs, separator)} ${arrow} ${timestamp(cue.startMs + cue.durationMs, separator)}`
}

function escapeHtml(text: string) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

function escapeMarkdown(text: string) {
  return escapeHtml(text).replace(/[\\`*_{}\[\]()#+\-.!|~^=]/g, "\\$&").replace(/\n/g, "  \n")
}

function inline(text: string) {
  return escapeMarkdown(text.replace(/\s+/g, " ").trim())
}

export function renderTranscript(cues: Cue[], video: Video, track: Track, format: Format, timestamps: boolean) {
  if (format === "json") return `${JSON.stringify(cues, null, 2)}\n`
  if (format === "srt" || format === "vtt") {
    const blocks = cues.map((cue, index) => {
      const time = timeRange(cue, "-->", format === "srt" ? "," : ".")
      const text = escapeHtml(cue.text).split("\n").map(line => line.trim() ? line : "&nbsp;").join("\n")
      return `${format === "srt" ? `${index + 1}\n` : ""}${time}\n${text}`
    })
    return `${format === "vtt" ? "WEBVTT\n\n" : ""}${blocks.join("\n\n")}\n`
  }
  if (format === "txt") {
    return `${cues.map(cue => `${timestamps ? `[${timeRange(cue, "→")}] ` : ""}${cue.text}`).join("\n")}\n`
  }
  const metadata = [
    `# ${inline(video.title) || video.bvid}`,
    "",
    `- 视频：[在哔哩哔哩观看](${video.url})`,
    `- 分 P：P${video.page}${video.partTitle ? ` ${inline(video.partTitle)}` : ""}`,
    `- UP 主：${inline(video.channel)}`,
    `- 字幕：${inline(track.name)}（${track.code}，${track.kind === "generated" ? "自动生成" : "人工"}）`,
  ]
  const speech = cues.map(cue => `${timestamps ? `\`${timeRange(cue, "→")}\` ` : ""}${escapeMarkdown(cue.text)}`).join("\n\n")
  return `${metadata.join("\n")}\n\n${speech}\n`
}
