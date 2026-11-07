import type { Cue, Format, Track, Video } from "./types.ts"

function readTime(value: unknown, label: string): number | undefined {
  if (value === undefined) return undefined
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new Error(`Invalid JSON3 ${label}: expected finite nonnegative milliseconds`)
  }
  return value
}

export function parseJson3(raw: string, durationMs: number = 0): Cue[] {
  if (!Number.isFinite(durationMs) || durationMs < 0) {
    throw new Error("Video duration must be finite nonnegative milliseconds")
  }
  const document: unknown = JSON.parse(raw)
  if (typeof document !== "object" || document === null || Array.isArray(document) || !("events" in document) || !Array.isArray(document.events)) {
    throw new Error("Invalid JSON3: an events array is required")
  }
  const events: unknown[] = document.events
  const cues: Cue[] = []
  let previousStart = -1
  for (const [index, event] of events.entries()) {
    if (typeof event !== "object" || event === null || Array.isArray(event)) {
      throw new Error(`Invalid JSON3 event ${index + 1}: expected an object`)
    }
    const start = readTime("tStartMs" in event ? event.tStartMs : undefined, `event ${index + 1} start`)
    const duration = readTime("dDurationMs" in event ? event.dDurationMs : undefined, `event ${index + 1} duration`)
    if (!("segs" in event)) continue
    if (!Array.isArray(event.segs)) {
      throw new Error(`Invalid JSON3 event ${index + 1}: expected a segments array`)
    }
    const segments: unknown[] = event.segs
    let text = ""
    for (const segment of segments) {
      if (typeof segment !== "object" || segment === null || Array.isArray(segment) || !("utf8" in segment) || typeof segment.utf8 !== "string") {
        throw new Error(`Invalid JSON3 event ${index + 1}: every segment must contain utf8 text`)
      }
      text += segment.utf8
    }
    text = text.replace(/\r\n/g, "\n")
    if (!text.trim()) continue
    if (start === undefined) throw new Error(`Invalid JSON3 event ${index + 1}: speech start is missing`)
    if (start < previousStart) throw new Error(`Invalid JSON3 event ${index + 1}: speech starts are not monotonic`)
    previousStart = start
    const roundedDuration = duration === undefined ? 0 : Math.round(duration)
    if (duration !== undefined && duration > 0 && roundedDuration === 0) {
      throw new Error(`Invalid JSON3 event ${index + 1}: positive duration rounds to zero milliseconds`)
    }
    cues.push({ startMs: Math.round(start), durationMs: roundedDuration, text })
  }
  if (!cues.length) throw new Error("JSON3 contains no speech captions")
  const videoEnd = Math.round(durationMs)
  let nextLaterStart: number | undefined
  for (let index = cues.length - 1; index >= 0; index--) {
    const cue = cues[index]!
    const next = cues[index + 1]
    if (next && next.startMs > cue.startMs) nextLaterStart = next.startMs
    if (cue.durationMs > 0) continue
    const end = nextLaterStart ?? videoEnd
    if (end <= cue.startMs) {
      throw new Error(`Cannot infer duration for speech at ${cue.startMs} ms: no later speech start or video end`)
    }
    cue.durationMs = end - cue.startMs
  }
  return cues
}

function sameLanguage(left: string, right: string): boolean {
  return left.trim().toLowerCase().replace(/-orig$/, "") === right.trim().toLowerCase().replace(/-orig$/, "")
}

function preferredTrack(tracks: Track[]): Track | undefined {
  return tracks.find(track => track.kind === "manual") ?? tracks.find(track => track.kind === "generated")
}

function availableCodes(tracks: Track[], source: boolean = false): string {
  return [...new Set(tracks.map(track => source ? track.sourceCode || "(unknown)" : track.code))].join(", ") || "none"
}

export function selectTrack(
  tracks: Track[],
  languages: string[],
  translate: string,
  only: "" | "manual" | "generated",
  sourceLanguage: string,
): Track {
  const filtered = only ? tracks.filter(track => track.kind === only) : tracks
  if (translate) {
    const translated = filtered.filter(track => track.translated)
    const targets = translated.filter(track => sameLanguage(track.code, translate))
    if (!targets.length) {
      throw new Error(`No ${only ? `${only} ` : ""}translated captions for ${translate}. Available translated targets: ${availableCodes(translated)}`)
    }
    const sources = languages.length ? languages : sourceLanguage ? [sourceLanguage] : []
    for (const source of sources) {
      const match = preferredTrack(targets.filter(track => sameLanguage(track.sourceCode, source)))
      if (match) return match
    }
    if (languages.length) {
      throw new Error(`No translated captions for ${translate} from requested sources ${languages.join(", ")}. Available sources: ${availableCodes(targets, true)}`)
    }
    return preferredTrack(targets)!
  }
  const originals = filtered.filter(track => !track.translated)
  const requested = languages.length ? languages : sourceLanguage ? [sourceLanguage] : []
  for (const language of requested) {
    const match = preferredTrack(originals.filter(track => sameLanguage(track.code, language)))
    if (match) return match
  }
  if (languages.length) {
    throw new Error(`No ${only ? `${only} ` : ""}original captions for requested languages ${languages.join(", ")}. Available original languages: ${availableCodes(originals)}`)
  }
  const fallback = preferredTrack(originals)
  if (fallback) return fallback
  throw new Error(`No ${only ? `${only} ` : ""}original captions available. Available original languages: ${availableCodes(originals)}`)
}

function timestamp(milliseconds: number, separator: "." | "," = "."): string {
  if (!Number.isFinite(milliseconds) || milliseconds < 0) {
    throw new Error("Caption timestamps must be finite nonnegative milliseconds")
  }
  const total = Math.round(milliseconds)
  const hours = Math.floor(total / 3_600_000)
  const minutes = Math.floor(total / 60_000) % 60
  const seconds = Math.floor(total / 1_000) % 60
  const fraction = total % 1_000
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}${separator}${String(fraction).padStart(3, "0")}`
}

function escapeMarkdown(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/[\\`*_{}\[\]()#+\-.!|~^=]/g, "\\$&").replace(/\n/g, "  \n")
}

export function renderTranscript(
  cues: Cue[],
  video: Video,
  track: Track,
  format: Format,
  timestamps: boolean,
): string {
  if (format === "json") return `${JSON.stringify(cues, null, 2)}\n`
  if (format === "srt" || format === "vtt") {
    const separator = format === "srt" ? "," : "."
    const blocks = cues.map((cue, index) => {
      if (!Number.isFinite(cue.durationMs) || cue.durationMs <= 0) {
        throw new Error(`Caption ${index + 1} duration must be finite and positive`)
      }
      const start = timestamp(cue.startMs, separator)
      const endMs = cue.startMs + cue.durationMs
      if (Math.round(endMs) <= Math.round(cue.startMs)) {
        throw new Error(`Caption ${index + 1} duration rounds to zero milliseconds`)
      }
      const end = timestamp(endMs, separator)
      const text = cue.text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").split("\n").map(line => line.trim() ? line : "&nbsp;").join("\n")
      return `${format === "srt" ? `${index + 1}\n` : ""}${start} --> ${end}\n${text}`
    })
    return `${format === "vtt" ? "WEBVTT\n\n" : ""}${blocks.join("\n\n")}\n`
  }
  if (format === "txt") {
    return `${cues.map(cue => `${timestamps ? `[${timestamp(cue.startMs)} → ${timestamp(cue.startMs + cue.durationMs)}] ` : ""}${cue.text}`).join("\n")}\n`
  }
  const source = track.sourceCode || video.language || track.code
  const metadata = [
    `# ${escapeMarkdown(video.title)}`,
    "",
    `- Channel: ${escapeMarkdown(video.channel)}`,
    `- Video: [Watch on YouTube](https://www.youtube.com/watch?v=${encodeURIComponent(video.id)})`,
    `- Language: ${escapeMarkdown(track.code)}${track.name ? ` (${escapeMarkdown(track.name)})` : ""}`,
    `- Captions: ${track.kind}; ${track.translated ? "translated" : "original"}`,
    `- Source language: ${escapeMarkdown(source)}`,
  ]
  const speech = cues.map(cue => `${timestamps ? `\`${timestamp(cue.startMs)} → ${timestamp(cue.startMs + cue.durationMs)}\` ` : ""}${escapeMarkdown(cue.text)}`).join("\n\n")
  return `${metadata.join("\n")}\n\n${speech}\n`
}
