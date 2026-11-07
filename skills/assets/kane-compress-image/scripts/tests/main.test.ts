import { afterAll, beforeAll, expect, test } from "bun:test"
import { mkdir, mkdtemp, readFile, readdir, rm, stat, symlink, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join, relative } from "node:path"
import { deflateSync } from "node:zlib"
import sharp from "sharp"

interface Report {
  files: { input: string, output: string, inputBytes: number, outputBytes: number, reductionPercent: number }[]
  errors: { input: string, message: string }[]
  summary: { succeeded: number, failed: number, inputBytes: number, outputBytes: number, reductionPercent: number }
}

const script = join(import.meta.dir, "../main.ts")
const gifHead = "47494638396101000100800000ff00000000ff"
const gifFrame = "21f904000a0000002c0000000001000100000202440100"
const gifSecond = "21f904000a0000002c00000000010001000002024c0100"
let tmp = ""

beforeAll(async () => {
  tmp = await mkdtemp(join(tmpdir(), "kane compress test-"))
})

afterAll(async () => {
  await rm(tmp, { recursive: true, force: true })
})

async function cli(args: string[]) {
  const child = Bun.spawn([process.execPath, script, ...args], { cwd: tmp, stdout: "pipe", stderr: "pipe" })
  const [code, out, err] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
  return { code, out, err }
}

async function png(path: string, width = 64, height = 40) {
  const data = Buffer.alloc(width * height * 4)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      data[i] = x * 3 % 256
      data[i + 1] = y * 5 % 256
      data[i + 2] = (x + y) * 2 % 256
      data[i + 3] = x < width / 4 ? 0 : 255
    }
  }
  await sharp(data, { raw: { width, height, channels: 4 } }).png({ compressionLevel: 0 }).toFile(path)
}

function chunk(type: string, data: Buffer) {
  const bytes = Buffer.alloc(data.length + 12)
  bytes.writeUInt32BE(data.length)
  bytes.write(type, 4, 4, "ascii")
  data.copy(bytes, 8)
  let crc = 0xffffffff
  for (let i = 4; i < data.length + 8; i++) {
    crc ^= bytes[i]
    for (let bit = 0; bit < 8; bit++) crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1
  }
  bytes.writeUInt32BE((crc ^ 0xffffffff) >>> 0, data.length + 8)
  return bytes
}

function apng() {
  const controls = [0, 1].map(seq => {
    const data = Buffer.alloc(26)
    data.writeUInt32BE(seq, 0)
    data.writeUInt32BE(1, 4)
    data.writeUInt32BE(1, 8)
    data.writeUInt16BE(1, 20)
    data.writeUInt16BE(10, 22)
    return chunk("fcTL", data)
  })
  return Buffer.concat([
    Buffer.from("89504e470d0a1a0a", "hex"),
    chunk("IHDR", Buffer.from("00000001000000010802000000", "hex")),
    chunk("acTL", Buffer.from("0000000200000000", "hex")),
    controls[0], chunk("IDAT", deflateSync(Buffer.from([0, 255, 0, 0]))),
    controls[1], chunk("fdAT", Buffer.concat([Buffer.from("00000002", "hex"), deflateSync(Buffer.from([0, 0, 0, 255]))])),
    chunk("IEND", Buffer.alloc(0)),
  ])
}

test("WebP conversion preserves source bytes, dimensions and alpha while reporting actual sizes", async () => {
  const dir = await mkdtemp(join(tmp, "webp-"))
  const source = join(dir, "透明 图片.png")
  await png(source)
  const original = await readFile(source)
  const res = await cli([source, "--json"])
  expect(res.code).toBe(0)
  const report: Report = JSON.parse(res.out)
  expect(report.errors).toEqual([])
  expect(report.summary.succeeded).toBe(1)
  const result = report.files[0]
  const meta = await sharp(result.output).metadata()
  expect([meta.format, meta.width, meta.height, meta.hasAlpha]).toEqual(["webp", 64, 40, true])
  const { data, info } = await sharp(result.output).raw().toBuffer({ resolveWithObject: true })
  expect(data[3]).toBe(0)
  expect(data[(info.width - 1) * info.channels + 3]).toBe(255)
  expect(result.inputBytes).toBe(original.length)
  expect(result.outputBytes).toBe((await stat(result.output)).size)
  expect(result.outputBytes).toBeLessThan(result.inputBytes)
  expect(result.reductionPercent).toBeCloseTo((1 - result.outputBytes / result.inputBytes) * 100, 2)
  expect(report.summary.inputBytes).toBe(result.inputBytes)
  expect(report.summary.outputBytes).toBe(result.outputBytes)
  expect(await readFile(source)).toEqual(original)
})

test("PNG re-encoding preserves 8-bit RGB pixels without palette quantisation", async () => {
  const dir = await mkdtemp(join(tmp, "png-"))
  const source = join(dir, "source.png")
  const pixels = Buffer.from([255, 0, 0, 0, 255, 0, 0, 0, 255, 200, 100, 20])
  await sharp(pixels, { raw: { width: 2, height: 2, channels: 3 } }).png().toFile(source)
  const res = await cli([source, "-f", "png", "--json"])
  expect(res.code).toBe(0)
  const report: Report = JSON.parse(res.out)
  expect((await sharp(report.files[0].output).metadata()).format).toBe("png")
  expect(await sharp(report.files[0].output).raw().toBuffer()).toEqual(pixels)
})

test("JPEG conversion composites transparency on white rather than black", async () => {
  const dir = await mkdtemp(join(tmp, "jpeg-"))
  const source = join(dir, "transparent.png")
  await png(source)
  const output = join(dir, "white.jpg")
  const res = await cli([source, "-f", "jpeg", "-q", "95", "-o", output, "--json"])
  expect(res.code).toBe(0)
  const meta = await sharp(output).metadata()
  expect([meta.format, meta.width, meta.height, meta.hasAlpha]).toEqual(["jpeg", 64, 40, false])
  const pixels = await sharp(output).raw().toBuffer()
  expect([...pixels.subarray(0, 3)].every(value => value >= 250)).toBe(true)
})

test("EXIF orientation is applied before metadata is stripped", async () => {
  const dir = await mkdtemp(join(tmp, "orientation-"))
  const source = join(dir, "portrait.jpg")
  await sharp({ create: { width: 24, height: 16, channels: 3, background: "red" } }).withMetadata({ orientation: 6 }).jpeg().toFile(source)
  const res = await cli([source, "--json"])
  expect(res.code).toBe(0)
  const report: Report = JSON.parse(res.out)
  const meta = await sharp(report.files[0].output).metadata()
  expect([meta.width, meta.height]).toEqual([16, 24])
  expect(meta.orientation).toBeUndefined()
  expect(meta.exif).toBeUndefined()
  expect(meta.icc).toBeUndefined()
  expect((await sharp(source).metadata()).orientation).toBe(6)
})

test("directory recursion preserves relative paths and does not follow symlinks", async () => {
  const dir = await mkdtemp(join(tmp, "directory-"))
  const input = join(dir, "images")
  await mkdir(join(input, "nested"), { recursive: true })
  await png(join(input, "first.png"))
  await png(join(input, "nested", "second.png"))
  await writeFile(join(input, "note.txt"), "not an image")
  const outside = join(dir, "outside")
  await mkdir(outside)
  await png(join(outside, "private.png"))
  await symlink(outside, join(input, "linked"), "dir")
  const flat = await cli([input, "--json"])
  expect(flat.code).toBe(0)
  const flatReport: Report = JSON.parse(flat.out)
  expect(flatReport.files.map(file => relative(input, file.input))).toEqual(["first.png"])
  const output = join(dir, "recursive")
  const res = await cli([input, "-r", "-o", output, "--json"])
  expect(res.code).toBe(0)
  const report: Report = JSON.parse(res.out)
  expect(report.files.map(file => relative(output, file.output)).sort()).toEqual(["first.webp", join("nested", "second.webp")])
  for (const file of report.files) expect((await sharp(file.output).metadata()).width).toBe(64)
})

test("existing files, sources, symlinks and batch output directories remain unchanged", async () => {
  const dir = await mkdtemp(join(tmp, "existing-"))
  const source = join(dir, "source.png")
  await png(source)
  const original = await readFile(source)
  const existing = join(dir, "existing.png")
  await writeFile(existing, "user output")
  const link = join(dir, "link.png")
  await symlink(source, link)
  for (const output of [source, existing, link]) {
    const res = await cli([source, "-f", "png", "-o", output])
    expect(res.code).toBe(1)
  }
  expect(await readFile(source)).toEqual(original)
  expect(await readFile(existing, "utf8")).toBe("user output")
  expect(await readFile(link)).toEqual(original)
  const input = join(dir, "images")
  await mkdir(input)
  await png(join(input, "image.png"))
  const output = join(dir, "old-output")
  expect((await cli([input, "-o", output])).code).toBe(0)
  const saved = await readFile(join(output, "image.webp"))
  await writeFile(join(output, "notes.txt"), "keep")
  expect((await cli([input, "-o", output])).code).toBe(1)
  expect(await readFile(join(output, "image.webp"))).toEqual(saved)
  expect(await readFile(join(output, "notes.txt"), "utf8")).toBe("keep")
})

test("invalid quality, unknown flags and mismatched extensions fail before creating output", async () => {
  const dir = await mkdtemp(join(tmp, "arguments-"))
  const source = join(dir, "source.png")
  await png(source)
  for (const args of [
    ["-q", "0"], ["-q", "101"], ["-q", "20.5"], ["-q", "80oops"],
    ["--unknown"], ["-o"], ["-o", ""], ["-o", join(dir, "wrong.jpg")], ["extra-input.png"],
  ]) expect((await cli([source, ...args])).code).toBe(1)
  expect(await readdir(dir)).toEqual(["source.png"])
})

test("colliding batch names fail before an output directory is created", async () => {
  const dir = await mkdtemp(join(tmp, "collision-"))
  const input = join(dir, "images")
  await mkdir(input)
  await png(join(input, "same.png"))
  await sharp({ create: { width: 2, height: 2, channels: 3, background: "blue" } }).jpeg().toFile(join(input, "same.jpg"))
  const output = join(dir, "new-output")
  expect((await cli([input, "-o", output])).code).toBe(1)
  expect(await readdir(dir)).toEqual(["images"])
  expect((await readdir(input)).sort()).toEqual(["same.jpg", "same.png"])
})

test("animated GIF, WebP, APNG and multi-page TIFF are rejected without taking the first frame", async () => {
  const dir = await mkdtemp(join(tmp, "animation-"))
  const gif = Buffer.from(`${gifHead}${gifFrame}${gifSecond}3b`, "hex")
  expect((await sharp(gif).metadata()).pages).toBe(2)
  await writeFile(join(dir, "animated.gif"), gif)
  await sharp(gif, { animated: true }).webp().toFile(join(dir, "animated.webp"))
  await sharp(gif, { animated: true }).tiff().toFile(join(dir, "pages.tiff"))
  await writeFile(join(dir, "animated.png"), apng())
  for (const name of ["animated.gif", "animated.webp", "pages.tiff", "animated.png"]) {
    const source = join(dir, name)
    const original = await readFile(source)
    const res = await cli([source, "--json"])
    expect(res.code).toBe(1)
    const report: Report = JSON.parse(res.out)
    expect(report.files).toEqual([])
    expect(report.errors.map(error => error.input)).toEqual([source])
    expect(report.summary).toEqual({ succeeded: 0, failed: 1, inputBytes: 0, outputBytes: 0, reductionPercent: 0 })
    expect(await readFile(source)).toEqual(original)
  }
  expect((await readdir(dir)).sort()).toEqual(["animated.gif", "animated.png", "animated.webp", "pages.tiff"])
})

test("batch failures return nonzero, retain successful images and remove incomplete encodes", async () => {
  const dir = await mkdtemp(join(tmp, "partial-"))
  const input = join(dir, "images")
  await mkdir(input)
  const source = join(input, "good.png")
  await png(source)
  const original = await readFile(source)
  const damaged = Buffer.from(original)
  for (let pos = 8; pos < damaged.length; pos += damaged.readUInt32BE(pos) + 12) {
    if (damaged.toString("ascii", pos + 4, pos + 8) === "IDAT") {
      damaged[pos + 8] = 0
      break
    }
  }
  const bad = join(input, "damaged.png")
  await writeFile(bad, damaged)
  expect((await sharp(bad).metadata()).width).toBe(64)
  await writeFile(join(input, "not-image.png"), "not an image")
  const output = join(dir, "output")
  const res = await cli([input, "-o", output, "--json"])
  expect(res.code).toBe(1)
  const report: Report = JSON.parse(res.out)
  expect(report.files.map(file => file.input)).toEqual([source])
  expect(report.errors.map(error => relative(input, error.input)).sort()).toEqual(["damaged.png", "not-image.png"])
  expect(report.summary.succeeded).toBe(1)
  expect(report.summary.failed).toBe(2)
  expect(report.summary.inputBytes).toBe(original.length)
  expect(report.summary.outputBytes).toBe((await stat(join(output, "good.webp"))).size)
  expect(await readdir(output)).toEqual(["good.webp"])
  expect(await readFile(source)).toEqual(original)
  expect(await readFile(bad)).toEqual(damaged)
})

test("larger outputs are retained and honestly reported with a negative reduction", async () => {
  const dir = await mkdtemp(join(tmp, "larger-"))
  const source = join(dir, "pixel.gif")
  await writeFile(source, Buffer.from(`${gifHead}${gifFrame}3b`, "hex"))
  const res = await cli([source, "-f", "png", "--json"])
  expect(res.code).toBe(0)
  const report: Report = JSON.parse(res.out)
  expect(report.files[0].outputBytes).toBeGreaterThan(report.files[0].inputBytes)
  expect(report.summary.reductionPercent).toBeLessThan(0)
  expect((await sharp(report.files[0].output).metadata()).format).toBe("png")
})
