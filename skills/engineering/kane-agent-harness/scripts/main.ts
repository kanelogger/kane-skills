import { readdir, readFile } from "node:fs/promises"
import { join, resolve } from "node:path"
import { parseArgs } from "node:util"
import { audit, incomingLinks } from "./audit"
import { loadCatalog, readBody } from "./catalog"
import { operate, readState, type Action, type Decision } from "./engine"
import { Project, type Change } from "./io"
import { digest, editTemplates, validateTemplates } from "./templates"

const assets = resolve(import.meta.dir, "../assets")
const usage = [
  "catalog [--check] [--id COMPONENT]",
  "templates plan|apply SKILL_SOURCE --edits EDITS.json [--diff]",
  "fingerprint PROJECT RELATIVE_PATH",
  "status|verify PROJECT [--id COMPONENT] [--detail]",
  "plan|apply init|adopt|add|upgrade|remove PROJECT [--id COMPONENT ...] [--decisions DECISIONS.json] [--diff]",
].join("\n")

function delta(before: string, after: string) {
  const old = before.split("\n")
  const next = after.split("\n")
  let start = 0
  let end = 0
  while (start < old.length && start < next.length && old[start] === next[start]) start++
  while (end < old.length - start && end < next.length - start && old[old.length - end - 1] === next[next.length - end - 1]) end++
  return { line: start + 1, removed: old.slice(start, old.length - end), added: next.slice(start, next.length - end) }
}

function changeset(changes: Change[], diff: boolean) {
  return changes.map(({ path, before, after }) => ({
    path, operation: before === null ? "create" : after === null ? "remove" : "update",
    before: digest(before), after: digest(after),
    ...(diff && path !== ".agents/harness.json" ? { diff: delta(before ?? "", after ?? "") } : {}),
  }))
}

function arg(value: string | undefined, label: string) {
  if (!value) throw new Error("Missing " + label + "\n" + usage)
  return value
}

async function json(path: string): Promise<unknown> {
  return JSON.parse(await readFile(path, "utf8"))
}

async function run() {
  const { positionals: [cmd, first, second, ...extra], values } = parseArgs({ args: process.argv.slice(2), allowPositionals: true, options: {
    id: { type: "string", multiple: true }, detail: { type: "boolean" }, diff: { type: "boolean" },
    check: { type: "boolean" }, decisions: { type: "string" }, edits: { type: "string" }, help: { type: "boolean" },
  } })
  if (values.help || !cmd) return { usage }
  if (extra.length) throw new Error(usage)
  const used = Object.keys(values)
  function allow(...keys: string[]) {
    if (used.some(key => !keys.includes(key))) throw new Error("Unsupported option for " + cmd + "\n" + usage)
  }
  const ids = values.id
  if (cmd === "catalog") {
    allow("id", "check")
    if (first) throw new Error(usage)
    const catalog = values.check ? (await validateTemplates(assets)).components : await loadCatalog(assets)
    if (ids?.some(id => !catalog.some(c => c.id === id))) throw new Error("Unknown component ID")
    const components = []
    for (const component of catalog.filter(row => !ids?.length || ids.includes(row.id))) {
      const parts = []
      for (const part of component.parts) parts.push({ ...part, sha256: digest(await readBody(assets, part)) })
      components.push({ ...component, parts })
    }
    return { status: "ok", checked: !!values.check, components }
  }
  if (cmd === "templates") {
    allow("edits", "diff")
    if (first !== "plan" && first !== "apply") throw new Error(usage)
    const dir = resolve(arg(second, "skill source"))
    if (!/^name: kane-agent-harness\s*$/m.test(await readFile(join(dir, "SKILL.md"), "utf8"))) throw new Error("Expected kane-agent-harness skill source")
    const result = await editTemplates(join(dir, "assets"), await json(arg(values.edits, "--edits")), first === "apply")
    return { status: "ok", operation: first, scope: "templates", components: result.components, changes: changeset(result.changes, !!values.diff) }
  }
  if (cmd === "fingerprint") {
    allow()
    const project = await Project.open(arg(first, "project"))
    const path = arg(second, "relative path")
    try { return { path, sha256: digest(await project.read(path)) } }
    catch (error) {
      if (!(await readState(project)).parts.some(p => p.path === path)) throw error
      return { path, sha256: digest(await project.readExact(path)) }
    }
  }
  if (cmd === "status" || cmd === "verify") {
    allow("id", "detail")
    if (second) throw new Error(usage)
    const project = await Project.open(arg(first, "project"))
    const { report, errors } = await audit(project, assets)
    const initialized = await project.read(".agents/harness.json") !== null
    const drift = report.parts.filter(p => p.status.includes("local-change")).map(p => p.key)
    if (cmd === "verify" && (!initialized || errors.length || drift.length)) process.exitCode = 1
    const filtered = report.parts.filter(p => !ids || ids.includes(p.key.split("/")[0]!))
    if (ids?.some(id => !report.components.includes(id) && !report.disabled.includes(id))) throw new Error("Unadopted component ID")
    const parts = filtered.map(({ previous, current, next, installed, ...summary }) => values.detail ? { ...summary, previous, current, next, installed } : summary)
    return { status: !initialized ? "uninitialized" : errors.length ? "invalid" : drift.length ? "local-change" : "ok", scope: "project", components: report.components, disabled: report.disabled, parts, navigation: report.navigation.status, orphans: report.orphans, errors }
  }
  if (cmd !== "plan" && cmd !== "apply" || !["init","adopt","upgrade","add","remove"].includes(first ?? "")) throw new Error(usage)
  allow("id", "decisions", "diff")
  const dir = resolve(arg(second, "project"))
  const project = await Project.open(dir)
  const decisions = values.decisions ? await json(values.decisions) : undefined
  if (decisions !== undefined && !Array.isArray(decisions)) throw new Error("Expected JSON array of decisions")
  const existing = first === "init" && (await readdir(project.root)).some(name => name !== ".git" && name !== ".DS_Store")
  const action = existing ? "adopt" : first as Action
  const result = await operate(project, assets, action, { ids, decisions: decisions as Decision[] | undefined })
  if (result.issues.length) {
    process.exitCode = 1
    return { status: "needs_decision", issues: result.issues, changes: [] }
  }
  const { errors } = await audit(project, assets, result.changes)
  const backlinks = await incomingLinks(project, result.changes, result.missingSources)
  errors.push(...backlinks.errors)
  if (errors.length) {
    process.exitCode = 1
    return { status: "invalid", errors, unverifiedReferences: backlinks.unverified, changes: changeset(result.changes, !!values.diff) }
  }
  if (cmd === "apply" && result.changes.length) await project.commit([...result.changes, ...result.guards])
  return { status: "ok", operation: cmd, scope: "project", action: first, components: result.components, disabled: result.disabled, orphans: result.orphans, unverifiedReferences: backlinks.unverified, changes: changeset(result.changes, !!values.diff) }
}

try { console.log(JSON.stringify(await run(), null, 2)) }
catch (error) {
  console.error(JSON.stringify({ status: "error", message: error instanceof Error ? error.message : String(error) }))
  process.exitCode = 2
}
