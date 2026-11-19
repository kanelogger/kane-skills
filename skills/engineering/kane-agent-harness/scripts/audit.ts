import { readdir } from "node:fs/promises"
import { join } from "node:path"
import { inspectAdoption } from "./engine"
import { Project, pathParts, type Change } from "./io"
import { checkLinks, lostAnchors } from "./links"
import { hidesDisplay } from "./inline-display"

type Inspection = Awaited<ReturnType<typeof inspectAdoption>>
const ignored = new Set(["node_modules", "vendor", "dist", "build", "target", "coverage", "venv", "__pycache__"])

function view(project: Project, changes: Change[]) {
  const writes = new Map(changes.map(row => [row.path, row.after]))
  return {
    read: async (path: string) => writes.has(path) ? writes.get(path)! : project.read(path),
    readExact: async (path: string) => writes.has(path) ? writes.get(path)! : project.readExact(path),
    exists: async (path: string) => {
      if (writes.has(path)) return writes.get(path) !== null
      for (const [file, text] of writes) if (text !== null && file.startsWith(path + "/")) return true
      return project.exists(path)
    },
  }
}

function managed(report: Inspection) {
  const sources = new Map<string, string>()
  for (const part of report.parts) {
    if (part.mode !== "reference" && part.current !== null) sources.set(part.path, (sources.get(part.path) ?? "") + "\n" + part.current)
  }
  if (report.navigation.current) sources.set("AGENTS.md", (sources.get("AGENTS.md") ?? "") + "\n" + report.navigation.current)
  return sources
}

function visibleNavigation(body: string, report: Inspection) {
  const marker = crypto.randomUUID()
  const marked = body.replace(/(^|\n)<!-- kane-agent-harness:(begin|end) navigation -->(?=\r?\n|$)/g,
    (_, prefix: string, side: string) => prefix + "<!-- " + marker + " " + side + " -->")
  const html = new HTMLRewriter().on("[hidden], template, dialog:not([open])", {
    element(el) { el.remove() },
  }).on("[style]", {
    element(el) { if (hidesDisplay(el.getAttribute("style")!)) el.remove() },
  }).transform(Bun.markdown.html(marked))
  let inside = false
  let ended = false
  let heading = false
  let title = ""
  let row: Set<string> | undefined
  const rows: Set<string>[] = []
  new HTMLRewriter()
    .onDocument({ comments(node) {
      if (node.text === " " + marker + " begin ") inside = true
      if (inside && node.text === " " + marker + " end ") {
        inside = false
        ended = true
      }
    } })
    .on("h2", {
      element(el) {
        if (!inside) return
        title = ""
        el.onEndTag(() => { if (inside && title === "协作规范导航") heading = true })
      },
      text(node) { if (inside) title += node.text },
    })
    .on("ul > li", { element(el) {
      if (!inside) return
      row = new Set()
      rows.push(row)
      el.onEndTag(() => { row = undefined })
    } })
    .on("li a[href]", { element(el) {
      if (inside) row?.add(el.getAttribute("href")!)
    } })
    .transform(html)
  return ended && heading && rows.length === report.components.length && report.components.every((id, index) =>
    report.parts.filter(part => part.mode !== "pending" && part.key.startsWith(id + "/")).every(part =>
      rows[index]!.has(Bun.escapeHTML(part.path.split("/").map(encodeURIComponent).join("/")))))
}

async function markdownFiles(dir: string, unverified: string[], prefix = ""): Promise<string[]> {
  const files: string[] = []
  const items = await readdir(join(dir, prefix), { withFileTypes: true }).catch((err: Error) => {
    unverified.push((prefix || ".") + " " + err.message)
    return []
  })
  for (const item of items) {
    if (item.name.startsWith(".") || ignored.has(item.name) || item.isSymbolicLink()) continue
    const path = prefix + item.name
    try { pathParts(path) } catch { continue }
    if (item.isDirectory()) files.push(...await markdownFiles(dir, unverified, path + "/"))
    else if (item.isFile() && /\.(md|markdown)$/i.test(item.name)) files.push(path)
  }
  return files
}

export async function audit(project: Project, assets: string, changes: Change[] = []) {
  const next = view(project, changes)
  const report = await inspectAdoption(next, assets)
  const sources = managed(report)
  const spec = report.parts.find(p => p.key === "requirements/requirements" && p.current !== null)
  const paths = new Set(sources.keys())
  if (spec) {
    paths.add(spec.path)
    sources.delete(spec.path)
  }
  const links = await checkLinks(next.read, [...paths], { sources, exists: next.exists })
  const errors = [...report.issues.map(i => i.key + " " + i.reason), ...links]
  if (report.navigation.status !== "current" && (report.parts.length || report.navigation.status !== "absent")) errors.push("AGENTS.md navigation: " + report.navigation.status)
  if (report.navigation.status === "current" && !visibleNavigation(await next.read("AGENTS.md") ?? "", report)) {
    report.navigation.status = "invalid"
    errors.push("AGENTS.md 的受管导航未能显示标题与每个部件的目标链接，请检查代码围栏、HTML 隐藏容器和导航内的链接。")
  }
  for (const part of report.parts) {
    if (part.status.includes("missing") || part.status.includes("invalid")) errors.push(part.key + ": " + part.status.join(", "))
  }
  return { report, errors: [...new Set(errors)] }
}

export async function incomingLinks(project: Project, changes: Change[], missingSources: string[] = []) {
  const moved = new Set(missingSources)
  const deleted = new Set(changes.filter(c => c.after === null).map(c => c.path))
  const lost = new Map<string, Set<string>>()
  for (const change of changes) {
    if (change.before === null || change.after === null || !/\.(?:md|markdown)$/i.test(change.path)) continue
    const anchors = lostAnchors(change.before, change.after)
    if (anchors.size) lost.set(change.path, anchors)
  }
  const errors: string[] = []
  const unverified: string[] = []
  if (!deleted.size && !lost.size && !moved.size) return { errors, unverified }
  const old = view(project, [])
  const next = view(project, changes)
  const writes = new Map(changes.map(c => [c.path, c]))
  const paths = await markdownFiles(project.root, unverified)
  const include = (target: string, _source: string, anchor: string) => moved.has(target) || deleted.has(target) || !!lost.get(target)?.has(anchor)
  for (const path of paths) {
    if (deleted.has(path)) continue
    try {
      const change = writes.get(path)
      const before = change ? change.before : await project.readMarkdown(path)
      const after = change ? change.after : before
      if (after === null) continue
      const sources = new Map([[path, after]])
      const broken = await checkLinks(next.read, [path], { sources, exists: next.exists, include })
      if (!broken.length) continue
      sources.set(path, before ?? "")
      const previous = new Set(await checkLinks(old.read, [path], { sources, exists: old.exists,
        include: (target, source, anchor) => !moved.has(target) && include(target, source, anchor) }))
      errors.push(...broken.filter(issue => !previous.has(issue)))
    } catch (err) {
      unverified.push(path + " " + (err instanceof Error ? err.message : String(err)))
    }
  }
  return { errors, unverified }
}
