import { afterAll, afterEach, beforeAll, expect, spyOn, test } from "bun:test"
import { chmod, cp, mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { openVideo, type BrowserRequest } from "../source.ts"

const bvid = "BV12oWi6VEqn"
const aid = 123
const cid = 43568140132
const nav = { code: 0, data: { isLogin: true, wbi_img: {
  img_url: `https://i0.hdslb.com/bfs/wbi/${"a".repeat(32)}.png`,
  sub_url: `https://i0.hdslb.com/bfs/wbi/${"b".repeat(32)}.png`,
} } }
const detail = { code: 0, data: { View: {
  bvid, aid, title: "测试视频", owner: { name: "测试作者" }, pages: [{ page: 1, cid, part: "第一部分" }],
} } }
const player = { code: 0, data: { aid, cid, subtitle: { subtitles: [
  { lan: "ai-zh", lan_doc: "中文（自动生成）", ai_type: 1, subtitle_url: "https://subtitle.bilibili.com/test.json?sign=fixture-private" },
] } } }
const empty = { code: 0, data: { aid, cid, subtitle: { subtitles: [] } } }
const raw = { body: [{ from: 0, to: 1.5, content: "第一句" }, { from: 1.5, to: 3, content: "第二句" }] }
const defaults = new Map<string, Record<string, unknown>>([
  ["/x/web-interface/nav", nav], ["/x/web-interface/wbi/view/detail", detail], ["/x/player/wbi/v2", player],
])
let logs: ReturnType<typeof spyOn>
let tmp = ""
let base = ""

beforeAll(async () => {
  tmp = await mkdtemp(join(tmpdir(), "bilibili transcript-"))
  base = join(tmp, "standalone skill")
  await cp(join(import.meta.dir, "../.."), base, { recursive: true })
})

afterEach(() => {
  logs?.mockRestore()
})

afterAll(async () => {
  await rm(tmp, { recursive: true, force: true })
})

function scenario(endpoint: string, replies: Record<string, unknown>[]) {
  const paths: URL[] = []
  const times: number[] = []
  const request: BrowserRequest = async path => {
    const url = new URL(path, "https://api.bilibili.com")
    paths.push(url)
    if (url.pathname === endpoint) {
      times.push(Date.now())
      return replies[Math.min(times.length - 1, replies.length - 1)]
    }
    const reply = defaults.get(url.pathname)
    if (!reply) throw new Error("Unexpected endpoint")
    return reply
  }
  logs = spyOn(console, "error").mockImplementation(() => {})
  return { request, paths, times }
}

test("a successful request does not retry or emit progress", async () => {
  const fixture = scenario("", [])
  const result = await openVideo(bvid, fixture.request)
  expect(result.video).toMatchObject({ bvid, aid, cid, page: 1 })
  expect(result.tracks).toMatchObject([{ code: "ai-zh", kind: "generated" }])
  expect(fixture.paths).toHaveLength(3)
  expect(logs).not.toHaveBeenCalled()
})

test("detail risk recovery waits two seconds and signs each attempt again", async () => {
  const fixture = scenario("/x/web-interface/wbi/view/detail", [{ code: -352 }, detail])
  const result = await openVideo(bvid, fixture.request)
  const requests = fixture.paths.filter(url => url.pathname.endsWith("/detail"))
  expect(result.video.cid).toBe(cid)
  expect(fixture.times).toHaveLength(2)
  expect(fixture.times[1] - fixture.times[0]).toBeGreaterThanOrEqual(1900)
  expect(requests[1].searchParams.get("wts")).not.toBe(requests[0].searchParams.get("wts"))
  expect(requests[1].searchParams.get("w_rid")).not.toBe(requests[0].searchParams.get("w_rid"))
  expect(logs).toHaveBeenCalledTimes(1)
}, 10_000)

test("nav voucher recovery also works when code is zero", async () => {
  const fixture = scenario("/x/web-interface/nav", [{ code: 0, data: { v_voucher: "private-voucher" } }, nav])
  expect((await openVideo(bvid, fixture.request)).tracks).toHaveLength(1)
  expect(fixture.times).toHaveLength(2)
  expect(JSON.stringify(logs.mock.calls)).not.toContain("private-voucher")
}, 10_000)

test("empty and risk responses share one player retry budget", async () => {
  const fixture = scenario("/x/player/wbi/v2", [empty, { code: -352 }, { code: 0, data: { v_voucher: true } }, player])
  expect((await openVideo(bvid, fixture.request)).tracks[0].code).toBe("ai-zh")
  expect(fixture.times).toHaveLength(4)
  expect(fixture.paths.filter(url => url.pathname.endsWith("/detail"))).toHaveLength(1)
  expect(logs).toHaveBeenCalledTimes(3)
}, 15_000)

for (const [name, reply, message] of [
  ["persistent risk", { code: -352 }, "风控验证"],
  ["persistent empty tracks", empty, "可能无字幕，也可能为瞬时风控或空响应"],
] as const) {
  test(`${name} stops after three retries with an honest diagnosis`, async () => {
    const fixture = scenario("/x/player/wbi/v2", [reply])
    let failure = ""
    try {
      await openVideo(bvid, fixture.request)
    } catch (error) {
      failure = (error as Error).message
    }
    expect(failure).toContain(message)
    expect(failure).toContain("已重试 3 次（共 4 次请求）")
    expect(fixture.times).toHaveLength(4)
    expect(logs).toHaveBeenCalledTimes(3)
  }, 15_000)
}

test("login, invalid responses and identity mismatches fail without retry", async () => {
  for (const [reply, message] of [
    [{ code: -101 }, "需要登录"],
    [{ code: -404 }, "API -404"],
    [{}, "响应异常"],
    [{ code: 0, data: { ...empty.data, need_login_subtitle: true } }, "需要登录"],
    [{ code: 0, data: { ...empty.data, cid: cid + 1 } }, "不一致"],
    [{ code: 0, data: { subtitle: { subtitles: {} } } }, "格式异常"],
    [{ code: 0, data: { subtitle: { subtitles: [{ lan: "ai-zh" }] } } }, "有效的可下载字幕轨"],
  ] as const) {
    const fixture = scenario("/x/player/wbi/v2", [reply])
    await expect(openVideo(bvid, fixture.request)).rejects.toThrow(message)
    expect(fixture.times).toHaveLength(1)
    expect(logs).not.toHaveBeenCalled()
    logs.mockRestore()
  }
})

test("browser timeouts and connection failures are not retried as empty tracks", async () => {
  const fixture = scenario("", [])
  let calls = 0
  await expect(openVideo(bvid, async path => {
    if (path.startsWith("/x/player")) {
      calls++
      throw new Error("浏览器请求超时")
    }
    return fixture.request(path)
  })).rejects.toThrow("浏览器请求超时")
  expect(calls).toBe(1)
  expect(logs).not.toHaveBeenCalled()
})

async function cli(args: string[], mode = "recover") {
  const preload = join(tmp, "preload.ts")
  await writeFile(preload, `
const fixtures = ${JSON.stringify(Object.fromEntries(defaults))}
const counts = new Map()
globalThis.fetch = async input => {
  const url = new URL(String(input))
  const n = (counts.get(url.pathname) ?? 0) + 1
  counts.set(url.pathname, n)
  if (url.hostname === 'subtitle.bilibili.com') return Response.json(${JSON.stringify(raw)})
  const value = fixtures[url.pathname]
  if (!value) throw new Error('Unexpected URL')
  if (url.pathname.endsWith('/nav')) return Response.json({ ...value, code: -101 })
  if (url.pathname.endsWith('/detail') && n === 1) return Response.json({ code: -352 })
  if (url.pathname.startsWith('/x/player') && (${JSON.stringify(mode)} === 'empty' || n === 1)) return Response.json(${JSON.stringify(empty)})
  return Response.json(value)
}
`)
  const child = Bun.spawn([process.execPath, "--preload", preload, join(base, "scripts/main.ts"), bvid, ...args], {
    cwd: tmp, stdout: "pipe", stderr: "pipe",
  })
  const [code, out, err] = await Promise.all([child.exited, child.stdout.text(), child.stderr.text()])
  return { code, out, err }
}

test("standalone anonymous list and export recover with clean stdout and consistent artifacts", async () => {
  const listed = await cli(["--list"])
  expect(listed.code).toBe(0)
  expect(JSON.parse(listed.out).tracks).toMatchObject([{ code: "ai-zh", kind: "generated" }])
  expect(listed.err).toContain("重试（1/3）")
  const output = join(tmp, "投资", "字幕包")
  const exported = await cli(["--output-dir", output])
  expect(exported.code).toBe(0)
  expect(exported.out.trim()).toBe(join(output, "transcript.md"))
  expect((await readdir(output)).sort()).toEqual(["meta.json", "transcript-raw.json", "transcript.md"])
  const meta = await readFile(join(output, "meta.json"), "utf8")
  expect(JSON.parse(meta)).toMatchObject({ video: { bvid, cid, page: 1 }, track: { code: "ai-zh", kind: "generated" }, cueCount: 2 })
  expect(meta).not.toContain("fixture-private")
  expect(JSON.parse(await readFile(join(output, "transcript-raw.json"), "utf8"))).toEqual(raw)
  const md = await readFile(join(output, "transcript.md"), "utf8")
  expect(md).toContain("00:00:00.000 → 00:00:01.500")
  expect(md).toContain("第二句")
}, 20_000)

test("exhausted CLI leaves no output package or successful stdout", async () => {
  const output = join(tmp, "failed-export")
  const failed = await cli(["--output-dir", output], "empty")
  expect(failed.code).toBe(1)
  expect(failed.out).toBe("")
  expect(failed.err).toContain("已重试 3 次（共 4 次请求）")
  expect((await readdir(tmp)).includes("failed-export")).toBe(false)
}, 15_000)

test("browser adapter preserves vouchers and rejects malformed or failed tool output", async () => {
  const bin = join(tmp, "bin")
  await mkdir(bin)
  const tool = join(bin, "ego-browser")
  const harness = join(tmp, "browser-harness.ts")
  await writeFile(harness, `
import { browserRequest } from ${JSON.stringify(join(base, "scripts/browser.ts"))}
import { openVideo } from ${JSON.stringify(join(base, "scripts/source.ts"))}
try {
  const request = browserRequest('1')
  const result = process.argv[2] === 'open' ? await openVideo(${JSON.stringify(bvid)}, request) : await request('/x/player/wbi/v2')
  console.log(JSON.stringify(result))
} catch (error) {
  console.error(error.message)
  process.exitCode = 1
}
`)
  async function adapter(open = false) {
    const child = Bun.spawn([process.execPath, harness, open ? "open" : "query"], {
      stdout: "pipe", stderr: "pipe", env: { ...process.env, PATH: `${bin}:${process.env.PATH}` },
    })
    const [code, out, err] = await Promise.all([child.exited, child.stdout.text(), child.stderr.text()])
    return { code, out, err }
  }
  await writeFile(tool, `#!/usr/bin/env bun
globalThis.location = { origin: 'https://api.bilibili.com' }
globalThis.fetch = async () => Response.json({ code: 0, data: { v_voucher: true } })
const execute = new (Object.getPrototypeOf(async function() {}).constructor)('taskSpace', process.argv.at(-1))
await execute(async () => ({ page: () => ({ evaluate: async (fn, input) => fn(input) }) }))
`)
  await chmod(tool, 0o700)
  const result = await adapter()
  expect(result.err).toBe("")
  expect(result.code).toBe(0)
  expect(JSON.parse(result.out)).toEqual({ code: 0, data: { v_voucher: true } })
  for (const [body, message] of [
    ["console.log('BILI_RESULT:{}')", "响应异常"],
    ["console.log('BILI_RESULT:undefined')", "未返回有效的 JSON"],
    ["throw new Error('request timed out')", "无法读取浏览器会话"],
  ]) {
    await writeFile(tool, `#!/usr/bin/env bun\n${body}\n`)
    const failed = await adapter(true)
    expect(failed.code).toBe(1)
    expect(failed.out).toBe("")
    expect(failed.err).toContain(message)
    expect(failed.err).not.toContain("重试")
  }
})
