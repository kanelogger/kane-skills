import { mkdir, writeFile } from "node:fs/promises"
import { dirname, join, resolve } from "node:path"
import { parseArgs } from "node:util"
import { browserRequest } from "./browser.ts"
import { languagePattern, openVideo } from "./source.ts"
import { formats, parseCues, renderTranscript, selectTrack } from "./transcript.ts"

const help = `用法：bun main.ts <B 站视频链接、b23.tv 短链、BV 号或 av 号> [选项]

  --list                         列出指定分 P 的可下载字幕轨，输出 JSON
  --languages <代码>              逗号分隔的语言优先级，例如 zh-Hans,zh,en-US
  --only <manual|generated>      只选择人工或 B 站自动生成字幕
  --format <md|srt|vtt|txt|json>   导出格式，默认 md
  --no-timestamps                省略 Markdown 和 TXT 中的时间轴
  --output-dir <目录>             新字幕包目录，拒绝覆盖
  --ego-space <ID>               使用 ego lite TaskSpace 的 p1 浏览器会话
  --bsk-session <ID>             使用 browser-skill 的 Agent Window 会话
  -h, --help                     查看帮助

分 P 由链接的 ?p= 指定，默认 P1。默认优先人工轨。
默认目录：bilibili-transcript/<BV>/p<分P>/<语言>-<类型>/
`

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      help: { type: "boolean", short: "h" },
      list: { type: "boolean" },
      languages: { type: "string" },
      only: { type: "string" },
      format: { type: "string", default: "md" },
      "no-timestamps": { type: "boolean" },
      "output-dir": { type: "string" },
      "ego-space": { type: "string" },
      "bsk-session": { type: "string" },
    },
  })
  if (values.help) {
    process.stdout.write(help)
    return
  }
  if (positionals.length !== 1) throw new Error("请提供一个视频链接或 ID，可用 --help 查看用法")
  const languages = values.languages === undefined ? [] : values.languages.split(",").map(lang => lang.trim())
  if (languages.some(lang => !languagePattern.test(lang))) throw new Error("--languages 含无效的语言代码")
  const only = values.only
  if (only !== undefined && only !== "manual" && only !== "generated") {
    throw new Error("--only 必须为 manual 或 generated")
  }
  const format = formats.find(item => item === values.format)
  if (!format) throw new Error("--format 必须为 md、srt、vtt、txt 或 json")
  const output = values["output-dir"]
  if (output === "") throw new Error("--output-dir 需要非空路径")

  const browser = browserRequest(values["ego-space"], values["bsk-session"])
  const { video, tracks, download } = await openVideo(positionals[0].trim(), browser)
  const trackInfo = ({ code, name, kind }: typeof tracks[number]) => ({ code, name, kind })
  if (values.list) {
    console.log(JSON.stringify({ video, tracks: tracks.map(trackInfo) }, null, 2))
    return
  }

  const track = selectTrack(tracks, languages, only)
  const dir = resolve(output ?? join("bilibili-transcript", video.bvid, `p${video.page}`, `${track.code}-${track.kind}`))
  const { raw, data } = await download(track)
  const cues = parseCues(data)
  const transcript = renderTranscript(cues, video, track, format, !values["no-timestamps"])
  const meta = { video, track: trackInfo(track), cueCount: cues.length, format }
  await mkdir(dirname(dir), { recursive: true })
  try {
    await mkdir(dir)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") throw new Error("输出目录已存在，请另选 --output-dir")
    throw error
  }
  const outputFile = join(dir, `transcript.${format}`)
  await writeFile(join(dir, "meta.json"), `${JSON.stringify(meta, null, 2)}\n`, { flag: "wx" })
  await writeFile(join(dir, "transcript-raw.json"), raw, { flag: "wx" })
  await writeFile(outputFile, transcript, { flag: "wx" })
  console.log(outputFile)
}

try {
  await main()
} catch (error) {
  console.error(error instanceof Error ? error.message : "字幕获取失败")
  process.exitCode = 1
}
