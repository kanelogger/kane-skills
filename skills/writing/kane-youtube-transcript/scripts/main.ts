import { lstat, mkdir, writeFile } from "node:fs/promises"
import { dirname, join, resolve } from "node:path"
import { openVideo } from "./source.ts"
import { parseJson3, renderTranscript, selectTrack } from "./transcript.ts"
import type { Format, Track } from "./types.ts"

interface Options {
  input: string
  languages: string[]
  translate: string
  only: "" | "manual" | "generated"
  format: Format
  outputDir: string
  browser: string
  list: boolean
  timestamps: boolean
}

const help = `Usage: bun main.ts <youtube-url-or-id> [options]

Get captions only; never download the video or generate speech recognition.

  --list                         List available JSON3 tracks as JSON; no files
  --languages <codes>            Ordered source languages, comma-separated
  --translate <code>             Select a YouTube machine-translated track
  --only <manual|generated>      Restrict the source caption type
  --format <md|srt|vtt|txt|json>   Export format (default: md)
  --no-timestamps                Omit time ranges in Markdown/plain text
  --output-dir <dir>             New package directory; never overwrite
  --cookies-from-browser <name>  Read browser cookies only when explicitly set
  -h, --help                     Show help

Default language: the video's original language when available, otherwise
an available non-translated manual track, then an automatic track.
Default directory: youtube-transcript/<video-id>/<language>-<source-type>.
Requires Bun, curl, and yt-dlp (or uvx for isolated yt-dlp execution).
`

function videoId(input: string) {
  if (/^[A-Za-z0-9_-]{11}$/.test(input)) return input
  let url: URL
  try {
    url = new URL(input)
  } catch {
    throw new Error("Provide an HTTPS YouTube video URL or an 11-character video ID")
  }
  const hosts: Record<string, true> = {
    "youtube.com": true, "www.youtube.com": true, "m.youtube.com": true, "music.youtube.com": true,
    "youtu.be": true, "www.youtu.be": true, "youtube-nocookie.com": true, "www.youtube-nocookie.com": true,
  }
  if (url.protocol !== "https:" || hosts[url.hostname] !== true || url.username || url.password || url.port) {
    throw new Error("Only HTTPS YouTube video URLs are supported")
  }
  const path = url.pathname.replace(/\/$/, "")
  const short = url.hostname === "youtu.be" || url.hostname === "www.youtu.be"
  const id = short
    ? path.slice(1)
    : path === "/watch"
      ? url.searchParams.get("v") ?? ""
      : path.match(/^\/(?:embed|shorts|live|v)\/([A-Za-z0-9_-]{11})$/)?.[1] ?? ""
  if (!/^[A-Za-z0-9_-]{11}$/.test(id)) throw new Error("The URL must identify one YouTube video, not a playlist or channel")
  return id
}

function language(value: string) {
  if (!/^[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*$/.test(value)) throw new Error(`Invalid language code: ${value}`)
  return value
}

function parseArgs(argv: string[]): Options {
  const opts: Options = {
    input: "", languages: [], translate: "", only: "", format: "md",
    outputDir: "", browser: "", list: false, timestamps: true,
  }
  const formats: Format[] = ["md", "srt", "vtt", "txt", "json"]
  let positional = false
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (!positional && arg === "--") {
      positional = true
      continue
    }
    if (!positional && arg === "--list") {
      opts.list = true
      continue
    }
    if (!positional && arg === "--no-timestamps") {
      opts.timestamps = false
      continue
    }
    if (!positional && ["--languages", "--translate", "--only", "--format", "--output-dir", "--cookies-from-browser"].includes(arg)) {
      const value = argv[++i]
      if (!value?.trim() || value.startsWith("--")) throw new Error(`Missing value for ${arg}`)
      if (arg === "--languages") opts.languages = value.split(",").map(s => language(s.trim()))
      if (arg === "--translate") opts.translate = language(value)
      if (arg === "--only") {
        if (value !== "manual" && value !== "generated") throw new Error("--only must be manual or generated")
        opts.only = value
      }
      if (arg === "--format") {
        if (!formats.includes(value as Format)) throw new Error("--format must be md, srt, vtt, txt or json")
        opts.format = value as Format
      }
      if (arg === "--output-dir") opts.outputDir = value
      if (arg === "--cookies-from-browser") opts.browser = value
      continue
    }
    if (!positional && arg.startsWith("-") && !/^[A-Za-z0-9_-]{11}$/.test(arg)) throw new Error(`Unknown option: ${arg}`)
    if (opts.input) throw new Error("Process one video per invocation")
    opts.input = arg
  }
  if (!opts.input) throw new Error("A YouTube URL or video ID is required; use --help for usage")
  return opts
}

function trackMeta(track: Track) {
  const { url, ...meta } = track
  return meta
}

async function checkOutput(dir: string) {
  try {
    await lstat(dir)
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return
    throw err
  }
  throw new Error(`Output directory already exists: ${dir}; choose a new --output-dir`)
}

async function main(argv: string[]) {
  if (argv.includes("--help") || argv.includes("-h")) {
    process.stdout.write(help)
    return
  }
  const opts = parseArgs(argv)
  const id = videoId(opts.input)
  if (!opts.list && opts.outputDir) await checkOutput(resolve(opts.outputDir))
  const source = await openVideo(id, opts.browser)
  try {
    if (opts.list) {
      console.log(JSON.stringify({ video: source.video, tracks: source.tracks.map(trackMeta) }, null, 2))
      return
    }
    const track = selectTrack(source.tracks, opts.languages, opts.translate, opts.only, source.video.language)
    const code = track.code.replace(/[^A-Za-z0-9-]/g, "_")
    const dir = resolve(opts.outputDir || join("youtube-transcript", id, `${code}-${track.kind}${track.translated ? "-translated" : ""}`))
    if (!opts.outputDir) await checkOutput(dir)
    const raw = await source.download(track)
    const cues = parseJson3(raw, source.video.duration * 1000)
    const text = renderTranscript(cues, source.video, track, opts.format, opts.timestamps)
    await mkdir(dirname(dir), { recursive: true })
    try {
      await mkdir(dir)
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "EEXIST") throw new Error(`Output directory already exists: ${dir}; choose a new --output-dir`)
      throw err
    }
    const meta = { video: source.video, track: trackMeta(track), retrievedAt: new Date().toISOString() }
    await writeFile(join(dir, "transcript-raw.json"), raw, { flag: "wx" })
    await writeFile(join(dir, "meta.json"), JSON.stringify(meta, null, 2) + "\n", { flag: "wx" })
    const file = join(dir, `transcript.${opts.format}`)
    await writeFile(file, text, { flag: "wx" })
    console.log(file)
  } finally {
    await source.close()
  }
}

if (import.meta.main) {
  try {
    await main(process.argv.slice(2))
  } catch (err) {
    console.error(`Error: ${err instanceof Error ? err.message : String(err)}`)
    process.exitCode = 1
  }
}
