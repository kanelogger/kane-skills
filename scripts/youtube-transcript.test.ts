import { afterAll, beforeAll, expect, test } from "bun:test"
import { chmod, cp, mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { parseJson3, renderTranscript, selectTrack } from "../skills/assets/kane-youtube-transcript/scripts/transcript.ts"
import type { Track, Video } from "../skills/assets/kane-youtube-transcript/scripts/types.ts"

const video: Video = {
  id: "abcdefghijk", title: "A [link](javascript:bad) <script>", channel: "Example",
  url: "https://www.youtube.com/watch?v=abcdefghijk", duration: 5, language: "en",
}

function track(code: string, kind: Track["kind"] = "manual", translated = false, sourceCode = code): Track {
  return {
    code, kind, translated, sourceCode, name: code,
    url: `https://www.youtube.com/api/timedtext?lang=${sourceCode}&fmt=json3${translated ? `&tlang=${code}` : ""}`,
  }
}

const raw = JSON.stringify({ events: [
  { tStartMs: 0, dDurationMs: 1500, segs: [{ utf8: "2024 年，" }, { utf8: "会议在 09:30 开始。" }] },
  { tStartMs: 1500, dDurationMs: 1000, segs: [{ utf8: "Hello" }, { utf8: " world & <T>." }] },
] })
let tmp = ""
let base = ""
let bin = ""

beforeAll(async () => {
  tmp = await mkdtemp(join(tmpdir(), "kane youtube test-"))
  base = join(tmp, "standalone skill")
  bin = join(tmp, "bin")
  await cp(join(import.meta.dir, "../skills/assets/kane-youtube-transcript"), base, { recursive: true })
  await mkdir(bin)
  for (const [name, code] of [
    ["yt-dlp", "process.stdout.write(process.env.CAPTION_META ?? '')"],
    ["curl", "process.stdout.write((process.env.CAPTION_RAW ?? '') + '\\n' + (process.env.CAPTION_TYPE ?? 'application/json'))"],
  ]) {
    const path = join(bin, name)
    await writeFile(path, `#!/usr/bin/env bun\n${code}\n`)
    await chmod(path, 0o700)
  }
})

afterAll(async () => {
  await rm(tmp, { recursive: true, force: true })
})

async function cli(args: string[], extra: Record<string, string> = {}) {
  const meta = {
    id: video.id, title: video.title, channel: video.channel, duration: video.duration, language: "en",
    subtitles: { en: [{ ext: "json3", name: "English", url: `${track("en").url}&signature=private-fixture` }] },
    automatic_captions: {},
  }
  const child = Bun.spawn([process.execPath, join(base, "scripts/main.ts"), ...args], {
    cwd: tmp, stdout: "pipe", stderr: "pipe",
    env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, CAPTION_META: JSON.stringify(meta), CAPTION_RAW: raw, ...extra },
  })
  const [code, out, err] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
  return { code, out, err }
}

test("JSON3 preserves joined English/CJK speech, numeric content and overlapping repeats", () => {
  const cues = parseJson3(JSON.stringify({ events: [
    { tStartMs: 0, wpWinPosId: 0 },
    { tStartMs: 50, dDurationMs: 2000, segs: [{ utf8: "2024年，" }, { utf8: "增长 3.5%。" }] },
    { tStartMs: 1000, dDurationMs: 2000, segs: [{ utf8: "Hello" }, { utf8: " world." }] },
    { tStartMs: 2000, dDurationMs: 1000, segs: [{ utf8: "Hello world." }] },
  ] }))
  expect(cues).toEqual([
    { startMs: 50, durationMs: 2000, text: "2024年，增长 3.5%。" },
    { startMs: 1000, durationMs: 2000, text: "Hello world." },
    { startMs: 2000, durationMs: 1000, text: "Hello world." },
  ])
})

test("missing durations use only known later starts or video end", () => {
  const source = JSON.stringify({ events: [
    { tStartMs: 0, segs: [{ utf8: "First" }] },
    { tStartMs: 1000, segs: [{ utf8: "Second" }] },
  ] })
  expect(parseJson3(source, 2400)).toEqual([
    { startMs: 0, durationMs: 1000, text: "First" },
    { startMs: 1000, durationMs: 1400, text: "Second" },
  ])
  expect(() => parseJson3(source)).toThrow()
})

test("empty, malformed or reversed speech timestamps are failures", () => {
  for (const source of [
    { events: [] },
    { events: [{ tStartMs: 0, dDurationMs: 1000, segs: [{ utf8: "\n" }] }] },
    { events: [{ tStartMs: -1, dDurationMs: 1000, segs: [{ utf8: "speech" }] }] },
    { events: [{ tStartMs: 0, dDurationMs: "1000", segs: [{ utf8: "speech" }] }] },
    { events: [{ tStartMs: 0, dDurationMs: 1000, segs: [{ utf8: 42 }] }] },
    { events: [
      { tStartMs: 1000, dDurationMs: 1000, segs: [{ utf8: "Later" }] },
      { tStartMs: 0, dDurationMs: 1000, segs: [{ utf8: "Earlier" }] },
    ] },
  ]) expect(() => parseJson3(JSON.stringify(source))).toThrow()
})

test("language priority precedes manual preference and translation stays opt-in", () => {
  const en = track("en")
  const zh = track("zh-Hans", "generated")
  const fr = track("fr", "generated", true, "en")
  expect(selectTrack([en, zh, fr], ["ZH-hans", "en"], "", "", "en")).toBe(zh)
  expect(selectTrack([track("en", "generated"), en], ["en"], "", "", "en")).toBe(en)
  expect(selectTrack([en, zh], [], "", "", "zh-Hans")).toBe(zh)
  expect(selectTrack([track("en-orig", "generated")], ["en"], "", "", "").code).toBe("en-orig")
  expect(() => selectTrack([en, fr], ["fr"], "", "", "en")).toThrow()
  expect(selectTrack([en, fr], ["en"], "fr", "", "en")).toBe(fr)
  expect(() => selectTrack([fr], ["ja"], "fr", "", "en")).toThrow()
  expect(() => selectTrack([zh], ["zh-Hans"], "", "manual", "en")).toThrow()
})

test("subtitle exports roll milliseconds correctly and preserve literal markup", () => {
  const cues = [{ startMs: 59_999.6, durationMs: 1000, text: "<T> & 3.5%" }]
  const srt = renderTranscript(cues, video, track("en"), "srt", false)
  expect(srt).toBe("1\n00:01:00,000 --> 00:01:01,000\n&lt;T&gt; &amp; 3.5%\n")
  const vtt = renderTranscript(cues, video, track("en"), "vtt", false)
  expect(vtt).toBe("WEBVTT\n\n00:01:00.000 --> 00:01:01.000\n&lt;T&gt; &amp; 3.5%\n")
  expect(renderTranscript(cues, video, track("en"), "txt", false)).toBe("<T> & 3.5%\n")
  const md = renderTranscript(cues, video, track("en"), "md", true)
  expect(md).not.toContain("<script>")
  expect(md).not.toContain("[link](javascript:bad)")
  expect(md).toContain("&lt;T&gt;")
  expect(md).toContain("00:01:00.000")
})

test("standalone CLI saves actual subtitle content and preserves previous packages", async () => {
  const output = join(tmp, "captions")
  const args = ["https://youtu.be/abcdefghijk", "--languages", "en", "--format", "srt", "--output-dir", output]
  const first = await cli(args)
  expect(first.code).toBe(0)
  expect(first.out.trim()).toBe(join(output, "transcript.srt"))
  expect(await readFile(join(output, "transcript.srt"), "utf8")).toBe(
    "1\n00:00:00,000 --> 00:00:01,500\n2024 年，会议在 09:30 开始。\n\n2\n00:00:01,500 --> 00:00:02,500\nHello world &amp; &lt;T&gt;.\n",
  )
  expect(await readFile(join(output, "transcript-raw.json"), "utf8")).toBe(raw)
  const saved = await readFile(join(output, "meta.json"), "utf8")
  expect(JSON.parse(saved).track.code).toBe("en")
  expect(saved).not.toContain("signature=")
  await writeFile(join(output, "transcript.srt"), "user edit")
  const second = await cli(args)
  expect(second.code).toBe(1)
  expect(second.out).toBe("")
  expect(await readFile(join(output, "transcript.srt"), "utf8")).toBe("user edit")
  expect(await readFile(join(output, "meta.json"), "utf8")).toBe(saved)
})

test("empty inventories are listed honestly without creating an output package", async () => {
  const output = join(tmp, "empty-inventory")
  const result = await cli([video.id, "--list", "--output-dir", output], { CAPTION_META: JSON.stringify({ id: video.id }) })
  expect(result.code).toBe(0)
  expect(JSON.parse(result.out).tracks).toEqual([])
  expect(await Bun.file(join(output, "meta.json")).exists()).toBe(false)
  const failed = await cli([video.id, "--output-dir", output], { CAPTION_META: JSON.stringify({ id: video.id }) })
  expect(failed.code).toBe(1)
  expect(failed.out).toBe("")
  expect((await readdir(tmp)).includes("empty-inventory")).toBe(false)
})

test("translated tracks retain their manual or ASR source provenance", async () => {
  const meta = {
    id: video.id,
    automatic_captions: {
      fr: [{ ext: "json3", url: track("fr", "manual", true, "en").url }],
      de: [{ ext: "json3", url: `${track("de", "generated", true, "en").url}&kind=asr` }],
    },
  }
  const result = await cli([video.id, "--list"], { CAPTION_META: JSON.stringify(meta) })
  expect(result.code).toBe(0)
  const tracks = JSON.parse(result.out).tracks
  expect(tracks.map((entry: Track) => [entry.code, entry.kind, entry.translated, entry.sourceCode])).toEqual([
    ["fr", "manual", true, "en"], ["de", "generated", true, "en"],
  ])
})

test("supported video URL forms and leading-dash IDs resolve to the requested video", async () => {
  for (const input of [
    `https://www.youtube.com/shorts/${video.id}?feature=share`,
    `https://www.youtube.com/live/${video.id}`,
    `https://www.youtube-nocookie.com/embed/${video.id}`,
    "-abcdefghij",
  ]) {
    const id = input.startsWith("-") ? input : video.id
    const result = await cli([input, "--list"], { CAPTION_META: JSON.stringify({ id }) })
    expect(result.code).toBe(0)
    expect(JSON.parse(result.out).video.id).toBe(id)
  }
})

test("non-JSON and empty speech responses fail without successful artifacts", async () => {
  for (const [name, extra] of [
    ["html", { CAPTION_RAW: "<html>blocked</html>", CAPTION_TYPE: "text/html" }],
    ["empty", { CAPTION_RAW: '{"events":[]}' }],
  ] as const) {
    const output = join(tmp, name)
    const result = await cli([video.id, "--output-dir", output], extra)
    expect(result.code).toBe(1)
    expect(result.out).toBe("")
    expect((await readdir(tmp)).includes(name)).toBe(false)
  }
})

test("invalid source URLs and missing CLI values cannot produce captions", async () => {
  for (const [index, args] of [
    ["https://youtube.com.evil.example/watch?v=abcdefghijk"],
    ["http://www.youtube.com/watch?v=abcdefghijk"],
    ["https://www.youtube.com/playlist?list=abcdefghijk"],
    [video.id, "--languages"],
    [video.id, "--format", "invalid"],
    [video.id, "--unexpected"],
  ].entries()) {
    const result = await cli([...args, "--output-dir", join(tmp, `invalid-${index}`)])
    expect(result.code).toBe(1)
    expect(result.out).toBe("")
  }
})
