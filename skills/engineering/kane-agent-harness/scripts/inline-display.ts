const cssSpace = /[ \t\r\n\f]+/g
const protectedTokens = /\/\*[\s\S]*?(?:\*\/|$)|"(?:\\[\s\S]|[^"\\\r\n\f])*"?|'(?:\\[\s\S]|[^'\\\r\n\f])*'?|\\(?:[\da-f]{1,6}(?:\r\n|[ \t\r\n\f])?|[\s\S])/gi
const closing = new Map([["(", ")"], ["[", "]"], ["{", "}"]])
const outside = new Set(["block", "inline", "run-in"])
const inside = new Set(["flow", "flow-root", "table", "flex", "grid", "ruby", "math"])
const resets = new Set(["initial", "inherit", "unset", "revert", "revert-layer"])
const single = new Set([
  "contents", "inline-block", "inline-table", "inline-flex", "inline-grid",
  "table-row-group", "table-header-group", "table-footer-group", "table-row", "table-cell",
  "table-column-group", "table-column", "table-caption", "ruby-base", "ruby-text",
  "ruby-base-container", "ruby-text-container", "-webkit-box", "-webkit-inline-box",
  "-webkit-flex", "-webkit-inline-flex",
])

function mask(token: string) {
  if (token.startsWith("/*")) return " "
  if (!token.startsWith("\\")) return "?"
  const hex = token.slice(1).match(/^[\da-f]{1,6}/i)
  const code = hex ? parseInt(hex[0], 16) : token.charCodeAt(1)
  const char = code < 128 ? String.fromCharCode(code) : "?"
  return /[a-z\d_-]/i.test(char) ? char : "?"
}

function* declarations(attribute: string) {
  const decoded = attribute.replace(/&#(?:x[\da-f]+|\d+);?|&[a-z][\da-z]*;/gi, entity =>
    Bun.markdown.render(entity.endsWith(";") ? entity : entity + ";", { paragraph: text => text }))
  const css = decoded.replace(protectedTokens, mask).replace(cssSpace, " ").toLowerCase()
  const stack: string[] = []
  let start = 0
  for (const token of css.matchAll(/[()[\]{};]/g)) {
    const char = token[0]
    const close = closing.get(char)
    if (close) stack.push(close)
    else if (char === stack.at(-1)) stack.pop()
    else if (!stack.length && char === ";") {
      yield css.slice(start, token.index)
      start = token.index + 1
    }
  }
  yield css.slice(start)
}

function otherDisplay(value: string) {
  if (single.has(value)) return true
  const words = value.split(" ")
  const outer = words.filter(word => outside.has(word))
  const inner = words.filter(word => inside.has(word))
  const list = words.includes("list-item")
  return outer.length <= 1 && inner.length <= 1 && words.length === outer.length + inner.length + Number(list) &&
    (!list || !inner.length || inner[0] === "flow" || inner[0] === "flow-root")
}

export function hidesDisplay(attribute: string) {
  let important = false
  let hidden = false
  for (const declaration of declarations(attribute)) {
    const match = /^ *(display|all) *: *([^!]*?)( *! *important)? *$/.exec(declaration)
    if (!match || important && !match[3]) continue
    const value = match[2]!
    const reset = resets.has(value) || /^(?:var|env)\(.*\)$/.test(value)
    if (!reset && (match[1] === "all" || value !== "none" && !otherDisplay(value))) continue
    hidden = value === "none"
    important = Boolean(match[3])
  }
  return hidden
}
