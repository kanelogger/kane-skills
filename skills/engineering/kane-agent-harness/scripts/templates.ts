import { createHash } from "node:crypto"
import { mkdir, mkdtemp, readdir, rmdir, unlink, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { loadCatalog, readBody, type Component } from "./catalog"
import { Project, type Change } from "./io"
import { checkLinks } from "./links"
import { routeBody } from "./routing"

export const digest = (body: string | null) => body === null ? null : createHash("sha256").update(body).digest("hex")

export async function validateTemplates(assets: string) {
  const components = await loadCatalog(assets)
  const bodies = new Map<string, string>()
  for (const component of components) {
    for (const part of component.parts) bodies.set(part.source, await readBody(assets, part))
  }
  async function checkLayout(selected: Component[]) {
    const files = new Map<string, string>([["AGENTS.md", ""]])
    const routes = new Map<string, string>()
    for (const component of components) for (const part of component.parts) routes.set(part.path, "")
    for (const component of selected) for (const part of component.parts) routes.set(part.path, part.path)
    for (const { parts } of selected) {
      for (const part of parts) {
        const raw = bodies.get(part.source)!
        const body = /\.(?:md|markdown)$/i.test(part.path) ? routeBody(raw, part.path, part.path, routes) : raw
        files.set(part.path, (files.get(part.path) ?? "") + "\n" + body)
      }
    }
    const paths = [...files.keys()]
    const read = async (path: string) => files.get(path) ?? null
    const exists = async (path: string) => files.has(path) || paths.some(file => file.startsWith(path + "/"))
    return checkLinks(read, paths, { exists })
  }
  const layouts = [components.filter(item => item.default), components, ...components.map(item => [item])]
  const errors = (await Promise.all(layouts.map(checkLayout))).flat()
  if (errors.length) throw new Error("Template links: " + [...new Set(errors)].join("\n"))
  const registered = new Set(["catalog.json", ...bodies.keys()])
  for (const path of await inventory(assets)) if (!registered.has(path)) throw new Error("Unregistered template asset: " + path)
  return { components, sources: [...bodies].map(([source, body]) => ({ source, sha256: digest(body) })) }
}

function assetName(path: string) {
  if (path === "catalog.json") return
  if (!path.endsWith(".tmpl") || path.split("/").some(part => !part || part === "." || part === ".." || part.startsWith(".") && part !== ".gitignore.tmpl") || /[\\:\x00-\x1f]/.test(path)) throw new Error("Invalid template source path: " + path)
}

async function inventory(dir: string, prefix = ""): Promise<string[]> {
  const files: string[] = []
  for (const item of await readdir(dir, { withFileTypes: true })) {
    if (item.name.startsWith(".") && item.name !== ".gitignore.tmpl") continue
    const path = prefix + item.name
    if (!item.isDirectory() && path !== "catalog.json" && !path.endsWith(".tmpl")) continue
    if (item.isDirectory()) files.push(...await inventory(join(dir, item.name), path + "/"))
    else if (item.isFile()) { assetName(path); files.push(path) }
    else throw new Error("Expected regular template file: " + path)
  }
  return files.sort()
}

export async function editTemplates(assets: string, input: unknown, write: boolean) {
  if (!Array.isArray(input) || !input.length) throw new Error("Provide a nonempty JSON array of template edits.")
  const project = await Project.open(assets)
  const files = new Map<string, string>()
  for (const path of await inventory(assets)) {
    const body = await project.read(path)
    if (body === null) throw new Error("Template changed during inventory: " + path)
    files.set(path, body)
  }
  const edits = new Map<string, string | null>()
  for (const edit of input) {
    if (!edit || typeof edit.path !== "string" || (typeof edit.after !== "string" && edit.after !== null) || !("beforeSha256" in edit)) throw new Error("Each edit needs path, beforeSha256 and after.")
    assetName(edit.path)
    if (edits.has(edit.path)) throw new Error("Duplicate template edit: " + edit.path)
    if (digest(files.get(edit.path) ?? null) !== edit.beforeSha256) throw new Error("Stale template edit: " + edit.path)
    edits.set(edit.path, edit.after)
  }
  const changes: Change[] = [...new Set([...files.keys(), ...edits.keys()])].map(path => ({
    path, before: files.get(path) ?? null, after: edits.has(path) ? edits.get(path)! : files.get(path)!,
  }))
  const stage = await mkdtemp(join(tmpdir(), "kane-harness-catalog-"))
  const staged: string[] = []
  const dirs = new Set<string>()
  try {
    for (const change of changes) if (change.after !== null) {
      const path = join(stage, change.path)
      let dir = dirname(path)
      while (dir !== stage) { dirs.add(dir); dir = dirname(dir) }
      await mkdir(dirname(path), { recursive: true })
      await writeFile(path, change.after, { flag: "wx", mode: 0o600 })
      staged.push(path)
    }
    const checked = await validateTemplates(stage)
    if (write) await project.commit(changes)
    return { changes: changes.filter(c => c.before !== c.after), components: checked.components.map(item => item.id) }
  } finally {
    for (const path of staged) await unlink(path)
    for (const dir of [...dirs].sort((a, b) => b.length - a.length)) await rmdir(dir)
    await rmdir(stage)
  }
}
