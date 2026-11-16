import { afterEach, beforeEach, expect, test } from "bun:test"
import { createHash } from "node:crypto"
import { cp, lstat, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { exportAssets } from "../sync-assets"

const assets = resolve(import.meta.dir, "../../assets")
type Entry = { source: string; asset: string; file: string; sha256: string }
type Catalog = { files: Entry[]; source: { snapshot_sha256: string } }
let base = ""
let source = ""
let destination = ""

beforeEach(async () => {
  base = await mkdtemp(join(tmpdir(), "bun-assets-test-"))
  source = join(base, "source")
  destination = join(base, "assets")
  const catalog = JSON.parse(await readFile(join(assets, "catalog.json"), "utf8")) as Catalog
  for (const entry of catalog.files) {
    const target = join(source, entry.source)
    await mkdir(dirname(target), { recursive: true })
    await writeFile(target, await readFile(join(assets, entry.file)))
  }
})

afterEach(async () => {
  await rm(base, { recursive: true, force: true })
})

test("export retains the existing snapshot and repeats without rewrites", async () => {
  const catalog = JSON.parse(await readFile(join(assets, "catalog.json"), "utf8")) as Catalog
  const first = await exportAssets(source, destination)
  expect(first.status).toBe("passed")
  expect(first.snapshot_sha256).toBe(catalog.source.snapshot_sha256)
  const exported = JSON.parse(await readFile(join(destination, "catalog.json"), "utf8")) as Catalog
  expect(exported.files.length).toBe(23)
  for (const entry of exported.files) {
    expect(entry.file).toBe(`${entry.asset}.tmpl`)
    const content = await readFile(join(destination, entry.file))
    expect(content).toEqual(await readFile(join(source, entry.source)))
    expect(createHash("sha256").update(content).digest("hex")).toBe(entry.sha256)
  }
  const second = await exportAssets(source, destination)
  expect(second.status).toBe("passed")
  expect(second.changed).toEqual([])
})

test("drift check reports stale content without writing", async () => {
  await cp(assets, destination, { recursive: true })
  const catalog = JSON.parse(await readFile(join(assets, "catalog.json"), "utf8")) as Catalog
  const asset = catalog.files.find(entry => entry.asset === "base/docs/git.md")!
  const path = join(destination, asset.file)
  await writeFile(path, "local drift\n")
  const result = await exportAssets(source, destination, true)
  expect(result.status).toBe("stale")
  expect(result.changed).toContain(asset.file)
  expect(await readFile(path, "utf8")).toBe("local drift\n")
})

test("a missing source fails before creating output", async () => {
  await rm(join(source, "AGENTS.md"))
  expect((await exportAssets(source, destination)).status).toBe("failed")
  expect(await lstat(destination).then(() => true, () => false)).toBe(false)
})

test("symlink destinations are refused without modifying outside files", async () => {
  await cp(assets, destination, { recursive: true })
  const outside = join(base, "outside")
  await mkdir(outside)
  await writeFile(join(outside, "git.md.tmpl"), "outside\n")
  await rm(join(destination, "base/docs"), { recursive: true })
  await symlink(outside, join(destination, "base/docs"), "dir")
  expect((await exportAssets(source, destination)).status).toBe("failed")
  expect(await readFile(join(outside, "git.md.tmpl"), "utf8")).toBe("outside\n")
})
