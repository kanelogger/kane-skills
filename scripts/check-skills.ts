import { readdir, readFile, realpath, stat } from "node:fs/promises"
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path"

const root = await realpath(resolve(process.argv[2] ?? join(import.meta.dir, "..")))
const cats = ["reading", "creation", "editing", "assets", "publishing", "planning", "engineering"]
const legacy = new Set([
  "article-analyzer", "blog-checker", "concept-fable", "document-clarifier",
  "douban-dice-review", "merge-drafts", "subtext-article", "github-reuse-scout",
  "it-system-skill-distiller", "requirement-explorer", "simplify-codebase", "git-commit-push",
])
const errors: string[] = []
const names = new Set<string>()
const counts = new Map<string, number>()
const paths: string[] = []
const input = await readFile(join(root, "docs/user-input-tools.md"), "utf8")
const rules = input.split("## 工具选择（按优先级）\n\n")[1]?.split("\n## User Input Tools")[0]?.trim()
if (!rules) throw new Error("Canonical user-input rules not found")

function check(ok: boolean, path: string, msg: string) {
  if (!ok) errors.push(`${relative(root, path)}: ${msg}`)
}

function record(val: unknown): val is Record<string, unknown> {
  return val !== null && typeof val === "object" && !Array.isArray(val)
}

function within(base: string, path: string) {
  const rel = relative(base, path)
  return !isAbsolute(rel) && rel !== ".." && !rel.startsWith(`..${sep}`)
}

async function files(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true })
  const groups = await Promise.all(entries.filter(e => !e.name.startsWith(".") && e.name !== "node_modules").map(async e => {
    const path = join(dir, e.name)
    if (e.isSymbolicLink()) {
      check(within(dir, await realpath(path)), path, "symlink escapes its package subtree")
      return []
    }
    return e.isDirectory() ? files(path) : [path]
  }))
  return groups.flat().sort()
}

function prose(text: string, path: string) {
  let fence = ""
  const out: string[] = []
  for (const line of text.split("\n")) {
    const mark = line.match(/^\s*(`{3,}|~{3,})(.*)$/)
    if (mark) {
      if (!fence) fence = mark[1]
      else if (mark[1][0] === fence[0] && mark[1].length >= fence.length && !mark[2].trim()) fence = ""
      continue
    }
    if (!fence) out.push(line)
  }
  check(!fence, path, "unclosed Markdown fence")
  return out.join("\n")
}

async function links(path: string, text: string, base: string, contained: boolean) {
  for (const match of text.matchAll(/!?\[[^\]\n]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) {
    const target = match[1]
    if (/^(?:https?:|mailto:|#)/.test(target)) continue
    const dest = resolve(dirname(path), decodeURIComponent(target.split("#")[0]))
    check(!contained || within(base, dest), path, `local link escapes skill: ${target}`)
    try {
      const actual = await realpath(dest)
      check(!contained || within(base, actual), path, `link resolves outside skill: ${target}`)
      check((await stat(actual)).isFile() || (await stat(actual)).isDirectory(), path, `invalid link: ${target}`)
    } catch {
      check(false, path, `missing local link: ${target}`)
    }
  }
}

for (const cat of await readdir(join(root, "skills"), { withFileTypes: true })) {
  if (!cat.isDirectory()) continue
  check(cats.includes(cat.name), join(root, "skills", cat.name), "unknown category")
  let count = 0
  for (const entry of await readdir(join(root, "skills", cat.name), { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const base = join(root, "skills", cat.name, entry.name)
    const path = join(base, "SKILL.md")
    const text = await readFile(path, "utf8")
    const front = text.match(/^---\n([\s\S]*?)\n---(?:\n|$)/)
    check(Boolean(front), path, "missing YAML frontmatter")
    const meta: unknown = front ? Bun.YAML.parse(front[1]) : null
    if (!record(meta)) {
      check(false, path, "frontmatter must be a mapping")
      continue
    }
    const name = meta.name
    const desc = meta.description
    check(typeof name === "string" && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name) && name.length <= 64, path, "invalid name")
    check(typeof name === "string" && !/(?:anthropic|claude)/.test(name), path, "reserved name")
    check(name === entry.name, path, "name must match directory")
    check(typeof name === "string" && (name.startsWith("kane-") || legacy.has(name)), path, "new skills need kane- prefix")
    check(typeof name === "string" && !names.has(name), path, "duplicate name")
    check(typeof desc === "string" && desc.trim().length > 0 && [...desc].length <= 1024 && !/<[^>]*>/.test(desc), path, "invalid description")
    if (typeof name === "string") names.add(name)
    const body = text.slice(front?.[0].length ?? 0)
    check(body.trim().split("\n").length < 500, path, "body must be under 500 lines")
    check((body.match(/^## User Input Tools$/gm) ?? []).length === 1, path, "expected exactly one User Input Tools section")
    check(body.match(/^## .+$/m)?.[0] === "## User Input Tools", path, "user-input rules must precede the main workflow")
    const section = body.split("## User Input Tools\n")[1]?.split("\n## ")[0] ?? ""
    check(section.includes(rules), path, "user-input rules differ from canonical source")
    const bundled = await files(base)
    const scripts = bundled.filter(p => /\/scripts\/[^/]+\.(?:ts|js|py)$/.test(p))
    if (scripts.length) {
      check(/^## (?:脚本目录|Script Directory)$/m.test(body), path, "missing script directory section")
      check(body.includes("{baseDir}"), path, "missing script base directory convention")
      for (const script of scripts) check(body.includes(relative(base, script)), path, `unlisted script: ${relative(base, script)}`)
    }
    for (const file of bundled) {
      const raw = await readFile(file, "utf8")
      if (file.endsWith(".json")) JSON.parse(raw)
      if (file.endsWith(".yaml")) Bun.YAML.parse(raw)
      if (!file.endsWith(".md")) continue
      const text = prose(raw, file)
      await links(file, text, base, true)
      if (/(?:^|\/)(references|knowledge|prompt)\//.test(relative(base, file)) && raw.trim().split("\n").length > 100) {
        check(/^## (?:目录|Contents)$/m.test(text), file, "long reference needs a table of contents")
      }
      if (file === path || file.includes(`${sep}references${sep}`)) {
        for (const match of text.matchAll(/`((?:references|scripts|assets|prompt|knowledge|data|capability)\/[\w./-]+\.(?:md|ts|py|js|json|yaml))`/g)) {
          const dest = join(base, match[1])
          try {
            check(within(base, await realpath(dest)), file, `resource escapes skill: ${match[1]}`)
          } catch {
            check(false, file, `missing bundled resource: ${match[1]}`)
          }
        }
        if (file.includes(`${sep}references${sep}`)) {
          for (const match of text.matchAll(/\[[^\]\n]*\]\(([^)\s]+\.md)(?:#[^)]+)?\)/g)) {
            check(resolve(dirname(file), match[1]) === file, file, "reference must not route through another Markdown file")
          }
        }
      }
    }
    check(bundled.includes(join(base, "README.md")), path, "missing user README")
    paths.push(relative(root, path))
    count += 1
  }
  counts.set(cat.name, count)
}

for (const file of ["README.md", "README-CN.md"]) {
  const path = join(root, file)
  const text = await readFile(path, "utf8")
  await links(path, prose(text, path), root, false)
  check(text.includes(`Skills-${paths.length}-green.svg`), path, "skill badge count mismatch")
  check(new RegExp(`(?:The ${paths.length} skills|${paths.length} 个技能)`).test(text), path, "total count mismatch")
  for (const cat of cats) check(new RegExp(`^### ${cat} .+[（(]${counts.get(cat)}[）)]$`, "m").test(text), path, `category count missing: ${cat}`)
  const rows = [...text.matchAll(/\[(`[^`]+`)\]\((skills\/[^)]+)\)/g)]
  check(rows.length === paths.length, path, "skill list count mismatch")
  for (const skill of paths) check(rows.some(row => row[2] === skill && row[1] === `\`${skill.split("/").at(-2)}\``), path, `name must link directly to ${skill}`)
}

if (errors.length) {
  console.error(errors.join("\n"))
  process.exit(1)
}
console.log(`OK: ${paths.length} skills; frontmatter, user-input rules, bundled links, script indexes and README lists verified.`)
