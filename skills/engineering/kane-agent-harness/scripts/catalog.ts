import { pathParts, Project } from "./io"

export type Part = { id: string; path: string; source: string; preferReference?: boolean }
export type Component = { id: string; title: string; default: boolean; parts: Part[] }

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

function identifier(value: unknown, seen: Set<string>): string {
  if (typeof value !== "string" || !/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(value) || seen.has(value)) {
    throw new Error("目录标识缺失、格式无效或重复：" + String(value))
  }
  seen.add(value)
  return value
}

export function validTargetPath(value: unknown): value is string {
  if (typeof value !== "string" || /[?#]/.test(value)) return false
  try {
    const path = pathParts(value).join("/").toLowerCase()
    return path !== ".agents" && path !== ".agents/harness.json" && !path.startsWith(".agents/harness.json/")
  } catch {
    return false
  }
}

function sourcePath(value: unknown): string {
  if (typeof value !== "string" || !value.endsWith(".tmpl") || /[?#]/.test(value)) {
    throw new Error("无效的正文来源：" + String(value))
  }
  if (pathParts(value).some(name => name.startsWith(".") && name !== ".gitignore.tmpl")) {
    throw new Error("正文来源不可使用私有目录或文件：" + value)
  }
  return value
}

async function assetText(assets: string, name: string): Promise<string> {
  const project = await Project.open(assets)
  const body = await project.read(name)
  if (body === null || !body.trim()) throw new Error("未找到有效的模板资源：" + name)
  return body
}

export async function readBody(assets: string, part: Part): Promise<string> {
  const body = await assetText(assets, sourcePath(part.source))
  if (body.includes("kane-agent-harness:")) throw new Error("模板正文包含保留标记：" + part.source)
  return body
}

function checkLayout(components: Component[]) {
  const entries = new Map<string, { path: string; directory: boolean }>()
  function register(path: string, directory: boolean) {
    const key = path.normalize("NFC").toLowerCase()
    const prior = entries.get(key)
    if (prior && (prior.path !== path || prior.directory !== directory || (!directory && !/\.(?:md|markdown)$/i.test(path)))) {
      throw new Error("目标路径冲突：" + path + " 与 " + prior.path)
    }
    entries.set(key, { path, directory })
  }
  register(".agents", true)
  register("AGENTS.md", false)
  for (const { parts } of components) {
    for (const part of parts) {
      const names = part.path.split("/")
      for (let i = 1; i < names.length; i++) register(names.slice(0, i).join("/"), true)
      register(part.path, false)
    }
  }
}

export async function loadCatalog(assets: string): Promise<Component[]> {
  const rows: unknown = JSON.parse(await assetText(assets, "catalog.json"))
  if (!Array.isArray(rows) || !rows.length) throw new Error("部件目录应为非空数组")
  const components = new Set<string>()
  const parts = new Set<string>()
  const catalog = rows.map((row: unknown) => {
    if (!record(row) || typeof row.title !== "string" || !row.title.trim() || /[\r\n\x00-\x1f\x7f]/.test(row.title) ||
        typeof row.default !== "boolean" || !Array.isArray(row.parts) || !row.parts.length) {
      throw new Error("部件目录包含无效条目")
    }
    return {
      id: identifier(row.id, components),
      title: row.title,
      default: row.default,
      parts: row.parts.map((part: unknown) => {
        if (!record(part) || !validTargetPath(part.path)) throw new Error("无效的目标文件条目：" + row.id)
        if (part.preferReference !== undefined && typeof part.preferReference !== "boolean") {
          throw new Error("preferReference 须为布尔值：" + part.id)
        }
        return {
          id: identifier(part.id, parts),
          path: part.path,
          source: sourcePath(part.source),
          ...(part.preferReference === true ? { preferReference: true } : {}),
        }
      }),
    }
  })
  checkLayout(catalog)
  return catalog
}
