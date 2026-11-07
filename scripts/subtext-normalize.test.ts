import { afterAll, beforeAll, expect, test } from "bun:test"
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

const root = join(import.meta.dir, "..")
let tmp = ""
let script = ""
let fixtureNumber = 0

async function run(args: string[]) {
  const proc = Bun.spawn(args, {
    cwd: tmp,
    stdout: "pipe",
    stderr: "pipe",
    env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1" },
  })
  const [out, err, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ])
  return { out, err, code }
}

async function normalize(name: string, source: string, output?: string) {
  const path = join(tmp, `${++fixtureNumber}-${name}`)
  await writeFile(path, source)
  const args = ["python3", script, path]
  if (output) args.push("--output", output)
  const result = await run(args)
  return { ...result, text: result.out.replace(/\s+/g, " ").trim() }
}

beforeAll(async () => {
  tmp = await mkdtemp(join(tmpdir(), "subtext normalize test-"))
  const copiedSkill = join(tmp, "copied skill")
  await cp(join(root, "skills/creation/subtext-article"), copiedSkill, { recursive: true })
  script = join(copiedSkill, "scripts/normalize_subtitle.py")
})

afterAll(async () => {
  await rm(tmp, { recursive: true, force: true })
})

test("plain text retains numbers, spoken times, bracketed quotes and technical notation", async () => {
  const result = await normalize("source.txt", [
    "2024",
    "09:30",
    "会议从 09:30 开始，比例 16:9。",
    "[这是原话]",
    "[2024]",
    "代码 A<T>、{value}、a[0]、\\N 与 x < y 原样保留。",
    "",
  ].join("\n"))
  expect(result.code).toBe(0)
  expect(result.err).toBe("")
  expect(result.text).toBe("2024 09:30 会议从 09:30 开始，比例 16:9。 [这是原话] [2024] 代码 A<T>、{value}、a[0]、\\N 与 x < y 原样保留。")
})

test("leading bracketed quotations and technical symbols are not structured-file metadata", async () => {
  for (const source of ["[这是原话]", "[2024]", "{value} 是变量。", "<T> 是类型参数。", "<T>泛型参数", "09:30"]) {
    const result = await normalize("literal.txt", source)
    expect(result.code).toBe(0)
    expect(result.text).toBe(source)
  }
})

test("only explicit leading transcript timestamps are removed", async () => {
  const result = await normalize("transcript.txt", [
    "[00:01] 先说 09:30。",
    "(00:02) 再说 16:9。",
    "00:03 最后保留 [原话]。",
  ].join("\n"))
  expect(result.code).toBe(0)
  expect(result.text).toBe("先说 09:30。 再说 16:9。 最后保留 [原话]。")
})

test("LRC metadata and repeated leading time tags do not consume lyrics", async () => {
  const result = await normalize("lyrics.lrc", [
    "[ar:fixture artist]",
    "[ti:fixture title]",
    "[offset:1500]",
    "[00:01.00][00:03.00]2024",
    "[00:02.00]我们在 09:30 出发。",
    "[00:04.00][这是原话]",
  ].join("\n"))
  expect(result.code).toBe(0)
  expect(result.text).toBe("2024 我们在 09:30 出发。 [这是原话]")
})

test("SRT removes cue indices and timings while retaining numeric dialogue", async () => {
  const result = await normalize("captions.srt", [
    "1",
    "00:00:00,000 --> 00:00:01,000",
    "2024",
    "",
    "2",
    "00:00:01,000 --> 00:00:02,000",
    "<i>会议在 09:30 开始。</i>",
    "",
    "3",
    "00:00:02,000 --> 00:00:03,000",
    "[这是原话]",
    "",
  ].join("\r\n"))
  expect(result.code).toBe(0)
  expect(result.text).toBe("2024 会议在 09:30 开始。 [这是原话]")
})

test("VTT excludes whole NOTE, STYLE, REGION and header blocks plus cue IDs", async () => {
  const result = await normalize("captions.vtt", [
    "WEBVTT fixture",
    "Kind: captions",
    "Language: zh",
    "",
    "NOTE private annotation",
    "这不是台词。",
    "2025",
    "",
    "STYLE",
    "::cue { color: lime; }",
    "",
    "REGION",
    "id:private-region",
    "width:40%",
    "",
    "cue-alpha",
    "00:00.000 --> 00:01.000 align:start",
    "2024",
    "",
    "72",
    "00:01.000 --> 00:02.000",
    "<v 讲述者><c.green>会议在 <00:01.500>09:30 开始。</c></v>",
    "",
    "NOTE",
    "末尾私有注释。",
    "",
  ].join("\n"))
  expect(result.code).toBe(0)
  expect(result.text).toBe("2024 会议在 09:30 开始。")
})

for (const suffix of ["ass", "ssa"]) {
  test(`${suffix.toUpperCase()} extracts only dialogue and strips format-specific overrides`, async () => {
    const result = await normalize(`captions.${suffix}`, [
      "[Script Info]",
      "Title: metadata not speech",
      "[V4+ Styles]",
      "Style: metadata not speech",
      "[Events]",
      "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
      "Comment: 0,0:00:00.00,0:00:01.00,Default,,0,0,0,,不可见注释。",
      "Dialogue: 0,0:00:00.00,0:00:01.00,Default,,0,0,0,,{\\i1}2024{\\i0}\\N会议在 09:30 开始。",
      "Dialogue: 0,0:00:01.00,0:00:02.00,Default,,0,0,0,,[原话] 和 {value},以及 16:9。",
    ].join("\n"))
    expect(result.code).toBe(0)
    expect(result.text).toBe("2024 会议在 09:30 开始。 [原话] 和 {value},以及 16:9。")
  })
}

test("JSON uses a common start field before IDs and handles milliseconds correctly", async () => {
  for (const segments of [
    [{ id: 2, start: 0, text: "先说。" }, { id: 1, start: 1, text: "后说。" }],
    [{ id: 1, start: "2s", text: "后说。" }, { id: 2, start: "1500ms", text: "先说。" }],
    [{ start: "00:02,000", text: "后说。" }, { start: "00:01.500", text: "先说。" }],
    [{ index: 2, text: "后说。" }, { index: 1, text: "先说。" }],
  ]) {
    const result = await normalize("ordered.json", JSON.stringify({ segments }))
    expect(result.code).toBe(0)
    expect(result.text).toBe("先说。 后说。")
  }
})

test("JSON preserves array order without a common reliable ordering field and keeps ties stable", async () => {
  for (const segments of [
    [{ id: 2, text: "先说。" }, { id: 1, text: "后说。" }],
    [{ start: 2, text: "先说。" }, { text: "后说。" }],
    [{ start: "invalid", text: "先说。" }, { start: 0, text: "后说。" }],
    [{ start: 1, text: "先说。" }, { start: 1, text: "后说。" }],
    [{ start: true, text: "先说。" }, { start: false, text: "后说。" }],
  ]) {
    const result = await normalize("stable.json", JSON.stringify({ segments }))
    expect(result.code).toBe(0)
    expect(result.text).toBe("先说。 后说。")
  }
})

test("JSON chooses complete text once and lets empty containers fall through", async () => {
  for (const value of [
    { text: "完整原话。", segments: [{ text: "重复片段。" }], words: [{ word: "重复词。" }] },
    { text: "完整原话。", segments: [] },
    { segments: [], words: [{ word: "完整原话。" }] },
    { results: { channels: [{ alternatives: [{ transcript: "完整原话。", words: [{ word: "重复词。" }] }] }] } },
    ["完整原话。"],
  ]) {
    const result = await normalize("full.json", JSON.stringify(value))
    expect(result.code).toBe(0)
    expect(result.text).toBe("完整原话。")
  }
})

test("YouTube json3 combines events.segs text and never emits metadata", async () => {
  const result = await normalize("youtube.json3", JSON.stringify({
    wireMagic: "metadata-only",
    pens: [{ text: "不可输出的样式元数据。" }],
    events: [
      { tStartMs: 2000, segs: [{ utf8: "后" }, { utf8: "说。", tOffsetMs: 1500 }] },
      { tStartMs: 0, segs: [{ utf8: "先" }, { utf8: "说 09:30。" }] },
      { tStartMs: 1000, wWinId: 1, aAppend: 1 },
    ],
  }))
  expect(result.code).toBe(0)
  expect(result.text).toBe("先说 09:30。 后说。")
})

test("YouTube XML extracts decoded speech rather than timing attributes", async () => {
  const result = await normalize("youtube.xml", '<transcript><text start="0" dur="1">2024</text><text start="1" dur="2">会议在 09:30 开始 &amp; 保留 &lt;T&gt;。</text></transcript>')
  expect(result.code).toBe(0)
  expect(result.text).toBe("2024 会议在 09:30 开始 & 保留 <T>。")
})

for (const suffix of ["ttml", "dfxp"]) {
  test(`${suffix.toUpperCase()} preserves inline speech and excludes document metadata`, async () => {
    const result = await normalize(`captions.${suffix}`, [
      '<?xml version="1.0"?>',
      '<tt xmlns="http://www.w3.org/ns/ttml">',
      '<head><metadata><p>不可输出的元数据。</p></metadata></head>',
      '<body><div><p begin="0s" end="1s">2024<br/>会议在 <span>09:30</span> 开始。</p>',
      '<p begin="1s" end="2s">[这是原话]</p></div></body></tt>',
    ].join("\n"))
    expect(result.code).toBe(0)
    expect(result.text).toBe("2024 会议在 09:30 开始。 [这是原话]")
  })
}

test("structured input in an unlabelled file is recognized rather than emitted verbatim", async () => {
  for (const [name, source] of [
    ["json-transcript.data", JSON.stringify({ segments: [{ text: "真实原话。" }] })],
    ["xml-transcript.data", '<transcript><text start="0">真实原话。</text></transcript>'],
    ["vtt-transcript.data", "WEBVTT\n\ncue-id\n00:00.000 --> 00:01.000\n真实原话。\n"],
    ["srt-transcript.data", "1\n00:00:00,000 --> 00:00:01,000\n真实原话。\n"],
  ]) {
    const result = await normalize(name, source)
    expect(result.code).toBe(0)
    expect(result.text).toBe("真实原话。")
  }
})

test("unsupported, malformed and speech-free input fails without metadata output or traceback", async () => {
  for (const [name, source] of [
    ["empty.txt", " \n\t\n"],
    ["empty.json", "{}"],
    ["empty-segments.json", '{"segments":[]}'],
    ["metadata.json", '{"metadata":{"text":"文件标题不是正文。"},"language":"zh","id":2024}'],
    ["scalar.json", '"不是受支持的转写结构"'],
    ["malformed.json", '{"segments": ['],
    ["malformed-json.data", '{"segments": ['],
    ["metadata.xml", "<metadata><text>文件标题不是正文。</text></metadata>"],
    ["malformed.xml", "<transcript><text>未闭合。"],
    ["empty.ttml", '<tt xmlns="http://www.w3.org/ns/ttml"><head><metadata><p>仅元数据。</p></metadata></head><body/></tt>'],
    ["empty.vtt", "WEBVTT\n\nNOTE\n仅注释。\n"],
    ["empty.srt", "1\n00:00:00,000 --> 00:00:01,000\n"],
    ["empty.ass", "[Script Info]\nTitle: 仅元数据\n[Events]\n"],
    ["malformed.ass", "[Events]\nDialogue: broken\n"],
    ["empty.lrc", "[ar:artist]\n[00:01.00]\n"],
  ]) {
    const result = await normalize(name, source)
    expect(result.code).toBe(1)
    expect(result.out).toBe("")
    expect(result.err).not.toContain("Traceback")
  }
})

test("CLI writes normalized output only on success and reports missing input cleanly", async () => {
  const output = join(tmp, "normalized output.txt")
  const success = await normalize("output.txt", "会议在 09:30 开始。\n", output)
  expect(success.code).toBe(0)
  expect(success.out).toBe("")
  const saved = await readFile(output, "utf8")
  expect(saved.trim()).toBe("会议在 09:30 开始。")

  const failure = await normalize("broken.json", "{", output)
  expect(failure.code).toBe(1)
  expect(failure.err).not.toContain("Traceback")
  expect(await readFile(output, "utf8")).toBe(saved)

  const missing = await run(["python3", script, join(tmp, "missing input.txt")])
  expect(missing.code).toBe(1)
  expect(missing.out).toBe("")
  expect(missing.err).not.toContain("Traceback")
})
