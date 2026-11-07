import { createWriteStream } from "node:fs"
import { lstat, mkdir, open, readdir, rm, stat } from "node:fs/promises"
import { basename, dirname, extname, join, relative, resolve } from "node:path"
import { pipeline } from "node:stream/promises"
import { parseArgs } from "node:util"
import sharp from "sharp"

type Format = "webp" | "png" | "jpeg"

interface Options {
  input: string
  output?: string
  format: Format
  quality: number
  recursive: boolean
  json: boolean
}

interface Job {
  input: string
  output: string
}

interface Result extends Job {
  inputBytes: number
  outputBytes: number
  reductionPercent: number
}

const extensions: Record<string, true> = { ".png": true, ".jpg": true, ".jpeg": true, ".webp": true, ".gif": true, ".tif": true, ".tiff": true }
const formats: Record<string, true> = { png: true, jpeg: true, webp: true, gif: true, tiff: true }
const help = `用法：bun main.ts <图片或目录> [选项]

  -o, --output <路径>       单文件的输出文件，或批处理的新输出目录
  -f, --format <格式>       webp、png、jpeg（也接受 jpg），默认 webp
  -q, --quality <整数>      WebP/JPEG 质量 1–100，默认 80；PNG 不使用此参数
  -r, --recursive           递归处理子目录，默认只处理目录第一层
      --json                输出成功文件、失败原因和汇总 JSON
  -h, --help                查看帮助

始终保留原图，拒绝覆盖已有文件或输出目录。
单文件默认写为 <原文件名去扩展名>-compressed.<格式>。
目录默认写入同级 <目录名>-compressed/，保留相对目录结构。
仅处理静态 PNG/JPEG/WebP/GIF/TIFF；拒绝动图、APNG 和多页图片。
WebP/JPEG 为有损编码；PNG 不做调色板量化；JPEG 透明区域铺白底。
自动校正 EXIF 方向，移除元数据，不缩放尺寸。
`


function reduction(input: number, output: number) {
  return input ? Number(((1 - output / input) * 100).toFixed(2)) : 0
}

function size(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

function options(): Options | undefined {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      output: { type: "string", short: "o" },
      format: { type: "string", short: "f", default: "webp" },
      quality: { type: "string", short: "q", default: "80" },
      recursive: { type: "boolean", short: "r", default: false },
      json: { type: "boolean", default: false },
      help: { type: "boolean", short: "h" },
    },
  })
  if (values.help) {
    process.stdout.write(help)
    return
  }
  if (positionals.length !== 1 || !positionals[0]) throw new Error("请提供一张图片或一个目录，可用 --help 查看用法")
  const format = values.format.toLowerCase() === "jpg" ? "jpeg" : values.format.toLowerCase()
  if (format !== "webp" && format !== "png" && format !== "jpeg") throw new Error("--format 必须为 webp、png 或 jpeg")
  const quality = Number(values.quality)
  if (!/^\d+$/.test(values.quality) || !Number.isInteger(quality) || quality < 1 || quality > 100) {
    throw new Error("--quality 必须为 1–100 的整数")
  }
  if (values.output === "") throw new Error("--output 需要非空路径")
  return {
    input: resolve(positionals[0]), output: values.output === undefined ? undefined : resolve(values.output),
    format, quality, recursive: values.recursive, json: values.json,
  }
}

async function requireNew(path: string) {
  try {
    await lstat(path)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return
    throw error
  }
  throw new Error(`输出已存在，请另选 --output：${path}`)
}

async function collect(dir: string, recursive: boolean): Promise<string[]> {
  const files: string[] = []
  const entries = (await readdir(dir, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))
  for (const entry of entries) {
    const path = join(dir, entry.name)
    if (entry.isDirectory() && recursive) files.push(...await collect(path, true))
    else if (entry.isFile() && extensions[extname(entry.name).toLowerCase()]) files.push(path)
  }
  return files
}

async function plan(opts: Options) {
  const info = await stat(opts.input)
  const ext = opts.format === "jpeg" ? ".jpg" : `.${opts.format}`
  if (info.isFile()) {
    if (!extensions[extname(opts.input).toLowerCase()]) throw new Error("不支持该输入扩展名，仅接受 PNG/JPEG/WebP/GIF/TIFF")
    const stem = basename(opts.input, extname(opts.input))
    const output = opts.output ?? join(dirname(opts.input), `${stem}-compressed${ext}`)
    const suffix = extname(output).toLowerCase()
    if (suffix !== ext && !(opts.format === "jpeg" && suffix === ".jpeg")) {
      throw new Error(`输出文件扩展名与 --format 不一致，应为 ${ext}`)
    }
    await requireNew(output)
    return { jobs: [{ input: opts.input, output }], dir: undefined }
  }
  if (!info.isDirectory()) throw new Error("输入必须是普通图片文件或目录")
  const files = await collect(opts.input, opts.recursive)
  if (!files.length) throw new Error("目录中没有支持的图片；需要处理子目录时加 --recursive")
  const dir = opts.output ?? join(dirname(opts.input), `${basename(opts.input)}-compressed`)
  await requireNew(dir)
  const seen = new Map<string, string>()
  const jobs = files.map(input => {
    const path = relative(opts.input, input)
    const output = join(dir, `${path.slice(0, -extname(path).length)}${ext}`)
    const key = output.toLowerCase()
    const prior = seen.get(key)
    if (prior) throw new Error(`输出文件名冲突：${prior} 与 ${input}；请分别指定不同的 --output 处理`)
    seen.set(key, input)
    return { input, output }
  })
  return { jobs, dir }
}

async function isApng(path: string, bytes: number) {
  const file = await open(path, "r")
  try {
    const head = Buffer.alloc(8)
    let pos = 8
    while (pos + 8 <= bytes) {
      const { bytesRead } = await file.read(head, 0, 8, pos)
      if (bytesRead !== 8) return false
      const type = head.toString("ascii", 4, 8)
      if (type === "acTL") return true
      if (type === "IDAT" || type === "IEND") return false
      pos += head.readUInt32BE(0) + 12
    }
    return false
  } finally {
    await file.close()
  }
}

async function compress(job: Job, opts: Options): Promise<Result> {
  const inputBytes = (await stat(job.input)).size
  const image = sharp(job.input)
  const meta = await image.metadata()
  if (!meta.format || !formats[meta.format]) throw new Error("文件内容不是支持的静态图片格式")
  if ((meta.pages ?? 1) > 1 || (meta.format === "png" && await isApng(job.input, inputBytes))) {
    throw new Error("不支持动图、APNG 或多页图片，未提取首帧")
  }
  image.autoOrient()
  if (opts.format === "webp") image.webp({ quality: opts.quality })
  else if (opts.format === "png") image.png({ compressionLevel: 9, adaptiveFiltering: true })
  else image.flatten({ background: "#ffffff" }).jpeg({ quality: opts.quality, mozjpeg: true })

  await mkdir(dirname(job.output), { recursive: true })
  let created = false
  const output = createWriteStream(job.output, { flags: "wx" })
  output.once("open", () => { created = true })
  try {
    await pipeline(image, output)
  } catch (error) {
    if (created) await rm(job.output, { force: true })
    throw error
  }
  const outputBytes = (await stat(job.output)).size
  return { ...job, inputBytes, outputBytes, reductionPercent: reduction(inputBytes, outputBytes) }
}

async function main() {
  const opts = options()
  if (!opts) return
  const { jobs, dir } = await plan(opts)
  if (dir) {
    await mkdir(dirname(dir), { recursive: true })
    await mkdir(dir)
  }
  const files: Result[] = []
  const errors: { input: string, message: string }[] = []
  for (const job of jobs) {
    try {
      const result = await compress(job, opts)
      files.push(result)
      if (!opts.json) console.log(`${result.input} → ${result.output} (${size(result.inputBytes)} → ${size(result.outputBytes)}，减少 ${result.reductionPercent}%)`)
    } catch (error) {
      const failure = { input: job.input, message: error instanceof Error ? error.message : String(error) }
      errors.push(failure)
      if (!opts.json) console.error(`失败：${failure.input}：${failure.message}`)
    }
  }
  const inputBytes = files.reduce((sum, file) => sum + file.inputBytes, 0)
  const outputBytes = files.reduce((sum, file) => sum + file.outputBytes, 0)
  const summary = { succeeded: files.length, failed: errors.length, inputBytes, outputBytes, reductionPercent: reduction(inputBytes, outputBytes) }
  if (opts.json) console.log(JSON.stringify({ files, errors, summary }, null, 2))
  else console.log(`成功 ${summary.succeeded}，失败 ${summary.failed}；${size(inputBytes)} → ${size(outputBytes)}，减少 ${summary.reductionPercent}%`)
  if (errors.length) process.exitCode = 1
}

try {
  await main()
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
}
