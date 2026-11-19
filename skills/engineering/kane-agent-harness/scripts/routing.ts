import { posix } from "node:path"

function destination(value: string, source: string, target: string, routes: Map<string, string>) {
  const raw = value.startsWith("<") ? value.slice(1, -1) : value
  if (!raw || /^(?:#|[/?]|[a-z][a-z\d+.-]*:)/i.test(raw)) return value
  const [file, suffix = ""] = raw.split(/(?=[?#])(.+)/, 2)
  let path: string
  try {
    path = posix.normalize(posix.join(posix.dirname(source), decodeURIComponent(file)))
  } catch {
    return value
  }
  const mapped = routes.get(path)
  if (mapped === "") return null
  const next = mapped ?? path
  if (next === path && posix.dirname(source) === posix.dirname(target)) return value
  if (next === target && suffix.startsWith("#")) return suffix
  const rel = posix.relative(posix.dirname(target), next).split("/").map(encodeURIComponent).join("/")
  return rel + suffix
}

function proseLines(body: string) {
  let fence = ""
  return body.split("\n").map(line => {
    const mark = line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/)
    const quoted = !!fence || !!mark || /^(?: {4}|\t)/.test(line)
    if (mark && !fence) fence = mark[1]!
    else if (mark && mark[1]![0] === fence[0] && mark[1]!.length >= fence.length && !mark[2]!.trim()) fence = ""
    return { line, quoted }
  })
}

const definition = /^( {0,3}\[([^\]]+)\]:[ \t]*)(<[^>\n]+>|\S+)(.*)$/
const labelKey = (label: string) => label.trim().replace(/\s+/g, " ").toLowerCase()

export function routeBody(body: string, sourcePath: string, targetPath: string, routes: Map<string, string>): string {
  const lines = proseLines(body)
  const unavailable = new Set<string>()
  const definitions = new Map<number, string>()
  for (const [index, { line, quoted }] of lines.entries()) {
    const match = !quoted && definition.exec(line)
    if (!match) continue
    const next = destination(match[3]!, sourcePath, targetPath, routes)
    if (next === null) unavailable.add(labelKey(match[2]!))
    definitions.set(index, next === null ? "" : match[1] + next + match[4])
  }
  const tokens = /(`+)([^\n]*?)\1|(!?)\[((?:\\.|[^\]\\])*)\](?:\((<[^>\n]+>|(?:\\.|[^()\s\\]|\([^()\s]*\))+)(\s+(?:"[^"]*"|'[^']*'))?\)|\[([^\]]*)\])?/g
  return lines.map(({ line, quoted }, index) => {
    if (quoted) return line
    if (definitions.has(index)) return definitions.get(index)!
    return line.replace(tokens, (match, ticks, _code, image, label, url, title, reference) => {
      if (ticks) return match
      if (url === undefined) return unavailable.has(labelKey(reference || label)) ? label : match
      const next = destination(url, sourcePath, targetPath, routes)
      return next === null ? label : `${image}[${label}](${next}${title ?? ""})`
    })
  }).join("\n")
}
