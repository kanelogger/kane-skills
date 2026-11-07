import { chmod, mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import type { Source, Track, Video } from "./types.ts"

const outputLimit = 32 * 1024 * 1024
const errorLimit = 64 * 1024
const timeoutMs = 30_000

class SourceError extends Error {}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function text(value: unknown): string {
  return typeof value === "string" ? value : ""
}

function captionUrl(value: string): URL {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new SourceError("Caption metadata contains an invalid URL.")
  }
  const host = url.hostname.toLowerCase()
  const allowed = host === "youtube.com" || host.endsWith(".youtube.com")
    || host === "googlevideo.com" || host.endsWith(".googlevideo.com")
    || host === "video.google.com"
  if (url.protocol !== "https:" || url.username || url.password || !allowed) {
    throw new SourceError("Caption URLs must use HTTPS on an allowed YouTube host without credentials.")
  }
  return url
}

function startProcess(command: string[], label: string) {
  try {
    return Bun.spawn(command, {
      stdin: "ignore",
      stdout: "pipe",
      stderr: "pipe",
      detached: process.platform !== "win32",
    })
  } catch {
    throw new SourceError(`${label} could not start.`)
  }
}

async function execute(command: string[], label: string): Promise<string> {
  const child = startProcess(command, label)
  let failure = ""
  const stop = (message: string): void => {
    if (failure) return
    failure = message
    try {
      process.kill(process.platform === "win32" ? child.pid : -child.pid, "SIGKILL")
    } catch {
      try {
        child.kill("SIGKILL")
      } catch {}
    }
  }
  const timer = setTimeout(() => stop(`${label} exceeded the 30-second timeout.`), timeoutMs)
  const consume = async (stream: ReadableStream<Uint8Array>, limit: number): Promise<string> => {
    const reader = stream.getReader()
    const chunks: Uint8Array[] = []
    let bytes = 0
    try {
      while (true) {
        const result = await reader.read()
        if (result.done) break
        bytes += result.value.byteLength
        if (bytes > limit) {
          stop(`${label} exceeded its output limit.`)
          await reader.cancel()
          break
        }
        chunks.push(result.value)
      }
      return Buffer.concat(chunks).toString("utf8")
    } catch {
      stop(`${label} output could not be read.`)
      return ""
    } finally {
      reader.releaseLock()
    }
  }
  try {
    const [code, stdout, stderr] = await Promise.all([
      child.exited,
      consume(child.stdout, outputLimit),
      consume(child.stderr, errorLimit),
    ])
    if (failure) throw new SourceError(failure)
    if (code !== 0) {
      const detail = stderr.trim().replace(/https?:\/\/[^\s"'<>]+/gi, "[redacted URL]")
      throw new SourceError(`${label} failed with exit code ${code}${detail ? `: ${detail}` : "."}`)
    }
    return stdout
  } catch (error: unknown) {
    if (error instanceof SourceError) throw error
    stop(`${label} could not complete.`)
    throw new SourceError(failure)
  } finally {
    clearTimeout(timer)
  }
}

function inventory(metadata: Record<string, unknown>): Track[] {
  const tracks: Track[] = []
  const groups: [unknown, Track["kind"]][] = [
    [metadata.subtitles, "manual"],
    [metadata.automatic_captions, "generated"],
  ]
  for (const [group, kind] of groups) {
    if (!record(group)) continue
    for (const [code, entries] of Object.entries(group)) {
      if (code === "live_chat" || !Array.isArray(entries)) continue
      for (const entry of entries as unknown[]) {
        if (!record(entry) || entry.ext !== "json3") continue
        const url = text(entry.url)
        if (!url) continue
        const parsed = captionUrl(url)
        const translated = Boolean(parsed.searchParams.get("tlang"))
        tracks.push({
          code,
          name: text(entry.name) || code,
          kind: translated ? parsed.searchParams.get("kind") === "asr" ? "generated" : "manual" : kind,
          translated,
          sourceCode: parsed.searchParams.get("lang") || code.replace(/-orig$/, ""),
          url,
        })
      }
    }
  }
  return tracks
}

async function removeCookies(directory: string): Promise<void> {
  if (!directory) return
  try {
    await rm(directory, { recursive: true, force: true })
  } catch {
    throw new SourceError("Could not remove the private temporary cookie directory.")
  }
}

export async function openVideo(id: string, browser: string = ""): Promise<Source> {
  if (!/^[A-Za-z0-9_-]{11}$/.test(id)) throw new SourceError("A valid 11-character YouTube video ID is required.")
  if (browser && (!browser.trim() || /[\u0000\r\n]/.test(browser))) {
    throw new SourceError("The browser cookie option is invalid.")
  }
  const curl = Bun.which("curl")
  if (!curl) throw new SourceError("curl is required to fetch caption JSON3.")
  const installed = Bun.which("yt-dlp")
  const uvx = installed ? null : Bun.which("uvx")
  if (!installed && !uvx) throw new SourceError("Install yt-dlp or uv to inspect YouTube caption tracks.")
  const command = installed ? [installed] : [uvx!, "--from", "yt-dlp", "yt-dlp"]
  const url = `https://www.youtube.com/watch?v=${id}`
  let cookieDirectory = ""
  let cookieJar = ""
  try {
    if (browser) {
      cookieDirectory = await mkdtemp(join(tmpdir(), "kane-youtube-transcript-"))
      await chmod(cookieDirectory, 0o700)
      cookieJar = join(cookieDirectory, "cookies.txt")
      await writeFile(cookieJar, "# Netscape HTTP Cookie File\n", { mode: 0o600, flag: "wx" })
    }
    const args = [
      ...command,
      "--ignore-config",
      "--no-playlist",
      "--skip-download",
      "--dump-single-json",
      "--socket-timeout", "30",
      "--retries", "0",
      "--extractor-retries", "0",
      "--ignore-no-formats-error",
      "--no-remote-components",
    ]
    if (browser) args.push("--cookies-from-browser", browser, "--cookies", cookieJar)
    args.push(url)
    const raw = await execute(args, "yt-dlp metadata extraction")
    let metadata: unknown
    try {
      metadata = JSON.parse(raw)
    } catch {
      throw new SourceError("yt-dlp returned invalid metadata JSON.")
    }
    if (!record(metadata) || metadata.id !== id) {
      throw new SourceError("yt-dlp metadata does not match the requested video ID.")
    }
    const video: Video = {
      id,
      title: text(metadata.title) || id,
      channel: text(metadata.channel) || text(metadata.uploader),
      url,
      duration: typeof metadata.duration === "number" && Number.isFinite(metadata.duration) && metadata.duration >= 0
        ? metadata.duration : 0,
      language: text(metadata.language),
    }
    const tracks = inventory(metadata)
    const downloadCaption = async (trackUrl: string): Promise<string> => {
      const args = [
        curl,
        "--disable",
        "--proto", "=https",
        "--proto-redir", "=https",
        "--location",
        "--max-redirs", "5",
        "--max-time", "30",
        "--silent",
        "--show-error",
        "--fail",
        "--header", "Accept:application/json",
        "--write-out", "\n%{content_type}",
      ]
      if (cookieJar) args.push("--cookie", cookieJar)
      args.push(trackUrl)
      const response = await execute(args, "Caption download")
      const boundary = response.lastIndexOf("\n")
      if (boundary < 0) throw new SourceError("Caption response is missing its content type.")
      const contentType = response.slice(boundary + 1).split(";", 1)[0]?.trim().toLowerCase()
      if (contentType !== "application/json" && contentType !== "text/json") {
        throw new SourceError("Caption response is not JSON.")
      }
      const body = response.slice(0, boundary)
      if (!body.trim() || body.trimStart().startsWith("<")) {
        throw new SourceError("Caption response is empty or contains HTML.")
      }
      return body
    }
    return {
      video,
      tracks,
      async download(track: Track): Promise<string> {
        if (!tracks.includes(track)) throw new SourceError("The selected track does not belong to this video.")
        return downloadCaption(track.url)
      },
      close: () => removeCookies(cookieDirectory),
    }
  } catch (error: unknown) {
    await removeCookies(cookieDirectory)
    if (error instanceof SourceError) throw error
    throw new SourceError("Could not open the YouTube caption source.")
  }
}
