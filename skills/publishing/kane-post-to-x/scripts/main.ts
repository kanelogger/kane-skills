import { mkdir, readFile, realpath, stat, writeFile } from "node:fs/promises"
import { basename, dirname, extname, join, resolve } from "node:path"
import { parseArgs } from "node:util"

const maxBytes = 10 * 1024 * 1024
const help = `用法：bun main.ts <文章.md|.markdown> [选项]

  --title <标题>      覆盖文章标题
  --cover <文件>      指定本地封面
  -o, --output-dir   指定新产物目录
  -h, --help         查看帮助

生成 body.html、body.txt 和 meta.json。默认输出到稿件同级的 <稿件名>-x/，拒绝覆盖。
首次运行先在脚本目录执行 bun install --frozen-lockfile。
`

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      help: { type: "boolean", short: "h" },
      title: { type: "string" },
      cover: { type: "string" },
      "output-dir": { type: "string", short: "o" },
    },
  })
  if (values.help) {
    process.stdout.write(help)
    return
  }
  if (positionals.length !== 1 || !positionals[0].trim()) throw new Error("请提供一份 Markdown 文章，可用 --help 查看用法")
  if (Object.values(values).some(val => typeof val === "string" && !val.trim())) throw new Error("选项值不能为空")
  if (!Bun.markdown?.html) throw new Error("请使用 Bun 1.3.8 或更新版本")
  const input = resolve(positionals[0])
  const ext = extname(input)
  if (![".md", ".markdown"].includes(ext.toLowerCase())) throw new Error("文章须为 Markdown 文件")
  const source = await realpath(input)
  const info = await stat(source)
  if (!info.isFile() || info.size > maxBytes) throw new Error("文章须为 10 MiB 以内的 UTF-8 文件")
  const data = await readFile(source)
  if (data.byteLength > maxBytes) throw new Error("文章超过 10 MiB 上限")
  const body = new TextDecoder("utf-8", { fatal: true }).decode(data)

  let render: typeof import("./render.ts").render
  try {
    const module = await import("./render.ts")
    render = module.render
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ERR_MODULE_NOT_FOUND") {
      throw new Error(`请先运行 bun install --frozen-lockfile --cwd "${import.meta.dir}"`)
    }
    throw error
  }
  const { html, text, ...fields } = await render(source, body, { title: values.title, cover: values.cover })
  const dir = resolve(values["output-dir"] ?? join(dirname(input), `${basename(input, ext)}-x`))
  const files = { html: join(dir, "body.html"), text: join(dir, "body.txt"), meta: join(dir, "meta.json") }
  const meta = { status: "prepared", source, files, ...fields }
  try {
    await mkdir(dir)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") throw new Error(`输出已存在，请另选 --output-dir：${dir}`)
    throw error
  }
  try {
    await writeFile(files.html, html, { flag: "wx" })
    await writeFile(files.text, text, { flag: "wx" })
    await writeFile(files.meta, JSON.stringify(meta, null, 2) + "\n", { flag: "wx" })
  } catch (error) {
    throw new Error(`写入中断，产物可能不完整（${dir}）：${error instanceof Error ? error.message : String(error)}`)
  }
  console.log(JSON.stringify(meta, null, 2))
}

try {
  await main()
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
}
