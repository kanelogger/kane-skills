const classes = new Set([
  "quote-inline-block", "inline-kbd", "inline-tag", "inline-muted",
  "emphasis-marker", "emphasis-underline", "emphasis-neutral",
  "heading-plain", "heading-underline", "heading-band", "heading-badge",
  "image-plain", "image-frame", "image-shadow",
  "quote-block", "quote-note", "quote-tip", "quote-important", "quote-warning", "quote-caution", "quote-prompt",
])

const labels: Record<string, string> = {
  note: "提示", tip: "小技巧", important: "重点", warning: "注意", caution: "警告", prompt: "提示词",
  md: "Markdown", markdown: "Markdown", js: "JavaScript", javascript: "JavaScript",
  ts: "TypeScript", typescript: "TypeScript", json: "JSON", bash: "Shell", sh: "Shell", shell: "Shell",
  py: "Python", python: "Python", html: "HTML", css: "CSS", yaml: "YAML", yml: "YAML",
  text: "纯文本", plaintext: "纯文本",
}

function label(name: string) {
  return Object.hasOwn(labels, name) ? labels[name] : name.toUpperCase()
}

export function cleanClasses(doc: Document) {
  for (const el of doc.body.querySelectorAll("[class]")) {
    const kept = [...el.classList].filter(name => classes.has(name)
      || (el.tagName === "CODE" && el.parentElement?.tagName === "PRE" && /^language-[a-z0-9+#.-]{1,32}$/i.test(name)))
    if (kept.length) el.setAttribute("class", kept.join(" "))
    else el.removeAttribute("class")
  }
}

export function decorateBlocks(doc: Document) {
  for (const quote of doc.body.querySelectorAll("blockquote")) {
    const p = quote.firstElementChild
    const node = p?.tagName === "P" ? p.firstChild : null
    const match = node?.nodeType === 3 ? node.textContent?.match(/^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION|PROMPT)\][\t ]*([^\n]*)(?:\n|$)/i) : null
    let type = [...quote.classList].find(name => /^quote-(note|tip|important|warning|caution|prompt)$/.test(name))?.slice(6)
    if (match && node) {
      type = match[1].toLowerCase()
      node.textContent = node.textContent!.slice(match[0].length)
      if (!p?.textContent?.trim() && !p?.querySelector("img,br")) p?.remove()
    }
    if (!type) continue
    quote.classList.add("quote-block", `quote-${type}`)
    const title = doc.createElement("section")
    title.className = "quote-block-label"
    title.textContent = match?.[2].trim() || label(type)
    quote.prepend(title)
  }

  for (const pre of doc.body.querySelectorAll("pre")) {
    let code = pre.firstElementChild?.tagName === "CODE" && pre.children.length === 1 ? pre.firstElementChild : null
    if (!code) {
      code = doc.createElement("code")
      code.append(...pre.childNodes)
      pre.append(code)
    }
    const lang = [...code.classList].find(name => name.startsWith("language-"))?.slice(9).toLowerCase() || "text"
    const box = doc.createElement("section")
    box.classList.add("quote-block", "code-block", lang === "prompt" ? "quote-prompt" : "quote-code")
    const title = doc.createElement("section")
    title.className = "quote-block-label"
    title.textContent = label(lang)
    pre.replaceWith(box)
    pre.classList.add("quote-block-body")
    box.append(title, pre)
  }

  for (const code of doc.body.querySelectorAll("code")) {
    if (!code.closest("pre")) code.classList.add("quote-inline-block")
  }
}
