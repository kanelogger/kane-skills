const search = document.querySelector<HTMLFormElement>("[data-search]")
const input = document.querySelector<HTMLInputElement>("#query")
const count = document.querySelector<HTMLElement>("[data-count]")
const empty = document.querySelector<HTMLElement>("[data-empty]")
const catalog = document.getElementById("catalog")
const bench = document.getElementById("workbench")
const record = document.querySelector<HTMLElement>("[data-preview-record]")
const previewTitle = document.querySelector<HTMLElement>("[data-preview-title]")
const previewId = document.querySelector<HTMLElement>("[data-preview-id]")
const previewLink = document.querySelector<HTMLAnchorElement>("[data-preview-link]")
const previewUse = document.querySelector<HTMLElement>("[data-preview-use]")
const previewOutput = document.querySelector<HTMLElement>("[data-preview-output]")
const summary = document.querySelector<HTMLElement>("[data-preview-summary]")
const previewEmpty = document.querySelector<HTMLElement>("[data-preview-empty]")
const picker = document.querySelector<HTMLElement>("[data-specimen-picker]")

if (bench && record && previewTitle && previewId && previewLink && previewUse && previewOutput && summary && previewEmpty && picker && catalog && search && input && count && empty) {
  const groups = [...catalog.querySelectorAll<HTMLElement>("[data-group]")].map(group => ({
    group,
    nav: catalog.querySelector<HTMLElement>('[data-category-link]:has(a[href="#' + group.id + '"])'),
    entries: [...group.querySelectorAll<HTMLElement>("[data-skill]")],
  }))
  const entries = groups.flatMap(item => item.entries)
  const byId = new Map(entries.map(entry => [entry.dataset.skill, entry]))
  const defaultId = previewId.textContent
  const examples = [...picker.querySelectorAll<HTMLButtonElement>("[data-example]")]
  const samples = [...bench.querySelectorAll<HTMLElement>("[data-specimen]")]
  const editSearch = catalog.querySelector<HTMLAnchorElement>("[data-edit-search]")
  const copy = bench.querySelector<HTMLButtonElement>("[data-copy]")
  const compact = matchMedia("(max-width: 720px)")
  const sources = [...bench.querySelectorAll<HTMLDetailsElement>("[data-source-file]")]
  let current: HTMLElement | undefined
  let hover: number | undefined
  let activeQuery = ""

  const show = (entry?: HTMLElement) => {
    const id = entry?.dataset.skill
    if (current === entry && record.hidden === !id) return
    if (current) bench.removeAttribute("data-opening")
    current?.removeAttribute("data-current")
    current = entry
    entry?.setAttribute("data-current", "")
    record.hidden = !id
    previewEmpty.hidden = Boolean(id)
    for (const button of examples) button.setAttribute("aria-pressed", String(button.dataset.example === id))
    if (!entry || !id) return
    const link = entry.querySelector<HTMLAnchorElement>(".entry-link")
    if (!link) return
    previewTitle.textContent = entry.querySelector("[data-skill-title]")?.textContent ?? id
    previewId.textContent = id
    previewLink.href = link.href
    previewUse.textContent = entry.querySelector(".entry-desc")?.textContent ?? ""
    previewOutput.textContent = entry.dataset.output ?? ""
    summary.hidden = samples.some(panel => panel.dataset.specimen === id)
    for (const panel of samples) panel.hidden = panel.dataset.specimen !== id
    copy?.dispatchEvent(new Event("reset-copy"))
  }

  const arrangeSources = () => {
    for (const source of sources) source.open = !compact.matches
  }
  arrangeSources()
  compact.addEventListener("change", arrangeSources)
  bench.addEventListener("animationend", event => {
    if (event.animationName === "artifact-reveal") bench.removeAttribute("data-opening")
  })

  const filter = () => {
    window.clearTimeout(hover)
    const value = input.value.trim().normalize("NFKC").toLowerCase()
    const terms = value.split(/\s+/)
    const matches: HTMLElement[] = []
    for (const { group, nav, entries } of groups) {
      let found = false
      for (const entry of entries) {
        const text = [group.querySelector("h3")?.textContent, group.id, entry.textContent, entry.dataset.output].join(" ").normalize("NFKC").toLowerCase()
        const visible = terms.every(term => text.includes(term))
        entry.hidden = !visible
        if (visible) {
          found = true
          matches.push(entry)
        }
      }
      group.hidden = !found
      if (nav) nav.hidden = !found
    }
    const total = matches.length
    count.textContent = (total === 1 ? count.dataset.single : count.dataset.template?.replace("{n}", String(total))) ?? String(total)
    empty.hidden = total !== 0
    if (editSearch) editSearch.hidden = !value
    if (value) {
      if (value !== activeQuery || !current || !matches.includes(current)) show(matches[0])
    } else if (activeQuery || !current) {
      show(byId.get(defaultId ?? ""))
    }
    activeQuery = value
  }

  for (const button of examples) button.addEventListener("click", () => show(byId.get(button.dataset.example)))
  for (const entry of entries) {
    const button = entry.querySelector<HTMLButtonElement>("[data-preview]")
    if (button) {
      button.hidden = false
      button.addEventListener("click", () => {
        show(entry)
        bench.focus()
      })
    }
    entry.addEventListener("focusin", () => {
      window.clearTimeout(hover)
      show(entry)
    })
    entry.addEventListener("pointerenter", event => {
      if (event.pointerType === "mouse" && matchMedia("(min-width: 901px)").matches) {
        hover = window.setTimeout(() => show(entry), 90)
      }
    })
    entry.addEventListener("pointerleave", () => window.clearTimeout(hover))
  }

  const query = new URL(location.href).searchParams.get("q")
  if (query !== null) input.value = query
  const saveSearch = () => {
    const url = new URL(location.href)
    const value = input.value.trim()
    if (value) url.searchParams.set("q", value)
    else url.searchParams.delete("q")
    url.hash = catalog.id
    history.replaceState(null, "", url)
  }
  input.addEventListener("input", filter)
  search.addEventListener("submit", event => {
    event.preventDefault()
    saveSearch()
    filter()
    catalog.focus()
  })
  window.addEventListener("pageshow", filter)
  empty.querySelector("button")?.addEventListener("click", () => {
    input.value = ""
    saveSearch()
    filter()
    input.focus()
  })
  editSearch?.addEventListener("click", event => {
    event.preventDefault()
    input.focus()
  })
  const fallback = document.querySelector<HTMLElement>("[data-search-fallback]")
  if (fallback) fallback.hidden = true
  search.hidden = false
  picker.hidden = false
  filter()
}

let movingTitle: HTMLElement | null | undefined
document.addEventListener("click", event => {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
  const link = (event.target as Element).closest(".entry-link, [data-preview-link]")
  if (!link) return
  const entry = link.closest<HTMLElement>("[data-skill]")
  const id = entry?.dataset.skill ?? document.querySelector("[data-preview-id]")?.textContent
  const title = entry?.querySelector<HTMLElement>("[data-skill-title]") ?? document.querySelector<HTMLElement>("[data-preview-title]")
  if (!id || !title) return
  movingTitle?.style.removeProperty("view-transition-name")
  title.style.viewTransitionName = "skill-" + id
  movingTitle = title
})
window.addEventListener("pageshow", () => movingTitle?.style.removeProperty("view-transition-name"))

if (navigator.clipboard?.writeText) {
  for (const button of document.querySelectorAll<HTMLButtonElement>("[data-copy]")) {
    const id = button.dataset.copy
    if (!id) continue
    const target = document.getElementById(id)
    const feedback = document.querySelector<HTMLElement>('[data-feedback="' + id + '"]')
    const label = button.querySelector("span")
    if (!target || !feedback || !label) continue

    const initial = label.textContent
    let timer: number | undefined
    let attempt = 0
    const clear = () => {
      attempt += 1
      window.clearTimeout(timer)
      label.textContent = initial
      feedback.textContent = ""
      delete button.dataset.state
      delete feedback.dataset.state
    }
    button.hidden = false
    button.addEventListener("reset-copy", clear)
    button.addEventListener("click", async () => {
      clear()
      const id = attempt
      try {
        await navigator.clipboard.writeText(target.textContent ?? "")
        if (id !== attempt) return
        const done = button.dataset.done ?? ""
        label.textContent = done
        feedback.textContent = done
        timer = window.setTimeout(clear, 2200)
      } catch {
        if (id !== attempt) return
        label.textContent = button.dataset.error ?? ""
        button.dataset.state = "error"
        feedback.textContent = button.dataset.failure ?? ""
        feedback.dataset.state = "error"
      }
    })
  }
}
