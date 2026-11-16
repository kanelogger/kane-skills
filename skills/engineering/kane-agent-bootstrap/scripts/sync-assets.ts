import { createHash } from "node:crypto"
import { lstat, mkdir, readFile, realpath, writeFile } from "node:fs/promises"
import { join, resolve } from "node:path"

const base = ["docs/code-standards.md", "docs/integrating.md", "docs/git.md"]
const adapt = [
  "AGENTS.md", ".gitignore", "LESSONS.md", "docs/testing.md", "docs/workflow.md",
  "docs/subsystems/README.md", "docs/agent-environment/README.md",
  "docs/agent-environment/capabilities.md", "docs/agent-environment/commands.md",
  "docs/agent-environment/network-filesystem.md", "docs/agent-environment/skills.md",
]
const optional: [string, boolean, string][] = [
  ["agents.yml", true, "需要角色配置时，核对本轮可用工具与模型后采用"],
  ["docs/AGENTS.directory.template.md", false, "有目录局部约束时保留模板；实例化需填写"],
  ["docs/subsystems/TEMPLATE.md", false, "模块职责稳定且需要独立说明时保留模板；实例化需填写"],
  ["docs/adr/README.md", true, "需要长期决策记录时，合并已有索引及状态"],
  ["docs/adr/TEMPLATE.md", false, "需要长期决策记录时保留模板；实例化需填写"],
  ["docs/agent-environment/development-rehearsal.md", true, "需要验证新上下文或恢复流程时采用"],
  ["tasks/README.md", true, "需跨会话、复杂协调或长期追溯时与已有任务入口合并"],
  ["tasks/TEMPLATE.md", false, "采用仓库任务记录时保留模板；实例化需填写"],
]

type Spec = { source: string; asset: string; target: string; strategy: string; needs_adaptation: boolean; when: string }
type Entry = Spec & { file: string; sha256: string }
type ExportReport = { status: "passed" | "failed" | "stale"; errors?: Record<string, string>[]; asset_count?: number; snapshot_sha256?: string; changed?: string[]; check_only?: boolean }

const sha = (data: Uint8Array | string) => createHash("sha256").update(data).digest("hex")

function specs(): Spec[] {
  return [
    ...base.map(source => ({ source, asset: `base/${source}`, target: source, strategy: "copy", needs_adaptation: false, when: "规范适用、目标无冲突且引用齐全时采用" })),
    ...adapt.map(source => ({ source, asset: `templates/${source}`, target: source, strategy: "adapt", needs_adaptation: true, when: "按实际项目事实合并或改写；可引用已有同类说明" })),
    { source: "docs/project.template.yml", asset: "templates/docs/project.template.yml", target: "project.yml", strategy: "adapt", needs_adaptation: true, when: "以实际配置、业务及能力需要生成项目环境声明" },
    ...optional.map(([source, needs_adaptation, when]) => ({ source, asset: `templates/${source}`, target: source, strategy: "optional", needs_adaptation, when })),
  ].sort((a, b) => a.source < b.source ? -1 : a.source > b.source ? 1 : 0)
}

async function info(path: string) {
  try {
    return await lstat(path)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null
    throw error
  }
}

async function linked(root: string, path: string) {
  let current = root
  if ((await info(current))?.isSymbolicLink()) return true
  for (const part of path.split("/")) {
    current = join(current, part)
    if ((await info(current))?.isSymbolicLink()) return true
  }
  return false
}

export async function exportAssets(source: string, assets: string, check = false): Promise<ExportReport> {
  const entries: Entry[] = []
  const contents = new Map<string, Buffer>()
  const errors: Record<string, string>[] = []
  for (const spec of specs()) {
    const path = join(source, spec.source)
    if (await linked(source, spec.source) || !(await info(path))?.isFile()) {
      errors.push({ source: spec.source, error: "source_missing_or_not_regular" })
      continue
    }
    const data = await readFile(path)
    const file = `${spec.asset}.tmpl`
    contents.set(file, data)
    entries.push({ asset: spec.asset, file, source: spec.source, target: spec.target, strategy: spec.strategy, needs_adaptation: spec.needs_adaptation, when: spec.when, sha256: sha(data) })
  }
  if (errors.length) return { status: "failed", errors }
  const snapshot = sha(entries.map(entry => `${entry.source}\0${entry.sha256}\n`).join(""))
  const catalog = { schema_version: 1, source: { name: "prototype-03", snapshot_sha256: snapshot }, files: entries }
  contents.set("catalog.json", Buffer.from(`${JSON.stringify(catalog, null, 2)}\n`))
  const changed: string[] = []
  for (const path of [...contents.keys()].sort()) {
    const target = join(assets, path)
    const item = await info(target)
    if (await linked(assets, path)) {
      errors.push({ asset: path, error: "symlink_destination" })
    } else if (item && !item.isFile()) {
      errors.push({ asset: path, error: "destination_not_regular" })
    } else if (!item || !(await readFile(target)).equals(contents.get(path)!)) {
      changed.push(path)
    }
  }
  if (errors.length) return { status: "failed", errors }
  if (!check) {
    for (const path of changed) {
      const target = join(assets, path)
      await mkdir(join(target, ".."), { recursive: true })
      await writeFile(target, contents.get(path)!)
    }
  }
  return { status: check && changed.length ? "stale" : "passed", asset_count: entries.length, snapshot_sha256: snapshot, changed, check_only: check }
}

if (import.meta.main) {
  const args = process.argv.slice(2)
  if (args.includes("--help") || args.includes("-h")) {
    console.log("Usage: bun sync-assets.ts SOURCE [--check]")
  } else {
    try {
      const paths = args.filter(arg => arg !== "--check")
      if (paths.length !== 1 || paths[0].startsWith("--")) throw new Error("invalid_arguments")
      const source = await realpath(resolve(paths[0]))
      if (!(await lstat(source)).isDirectory()) throw new Error("invalid_source")
      const result = await exportAssets(source, resolve(import.meta.dir, "../assets"), args.includes("--check"))
      console.log(JSON.stringify(result, null, 2))
      process.exitCode = result.status === "passed" ? 0 : 1
    } catch {
      console.log(JSON.stringify({ status: "failed", error: "invalid_source_or_arguments" }, null, 2))
      process.exitCode = 1
    }
  }
}
