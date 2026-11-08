const search = document.querySelector<HTMLFormElement>("[data-search]")
const input = document.querySelector<HTMLInputElement>("#query")
const count = document.querySelector<HTMLElement>("[data-count]")
const empty = document.querySelector<HTMLElement>("[data-empty]")
const catalog = document.getElementById("catalog")

if (search && input && count && empty && catalog) {
  const groups = [...document.querySelectorAll<HTMLElement>("[data-group]")].map(group => ({
    group,
    link: document.querySelector<HTMLAnchorElement>('[data-category-link] a[href="#' + group.id + '"]'),
    skills: [...group.querySelectorAll<HTMLElement>("[data-skill]")].map(entry => ({
      entry,
      text: [group.querySelector("h3")?.textContent, group.id, entry.textContent, entry.dataset.output].join(" ").normalize("NFKC").toLowerCase(),
    })),
  }))

  const filter = () => {
    const terms = input.value.trim().normalize("NFKC").toLowerCase().split(/\s+/)
    let total = 0
    for (const { group, link, skills } of groups) {
      let matches = 0
      for (const { entry, text } of skills) {
        const visible = terms.every(term => text.includes(term))
        entry.hidden = !visible
        matches += Number(visible)
      }
      group.hidden = matches === 0
      if (link?.parentElement) {
        link.parentElement.hidden = matches === 0
        const label = link.querySelector(".category-count")
        if (label) label.textContent = String(matches).padStart(2, "0")
      }
      total += matches
    }
    const label = total === 1 ? count.dataset.single : count.dataset.template?.replace("{n}", String(total))
    count.textContent = label ?? String(total)
    empty.hidden = total !== 0
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
    catalog.scrollIntoView()
    catalog.focus({ preventScroll: true })
  })
  window.addEventListener("pageshow", filter)
  empty.querySelector("button")?.addEventListener("click", () => {
    input.value = ""
    saveSearch()
    filter()
    input.focus()
  })
  const editSearch = document.querySelector<HTMLAnchorElement>("[data-edit-search]")
  if (editSearch) {
    editSearch.hidden = false
    editSearch.addEventListener("click", event => {
      event.preventDefault()
      input.focus()
    })
  }
  const fallback = document.querySelector<HTMLElement>("[data-search-fallback]")
  if (fallback) fallback.hidden = true
  search.hidden = false
  filter()
}

const picker = document.querySelector<HTMLFieldSetElement>("[data-specimen-picker]")
if (picker) {
  const panels = [...document.querySelectorAll<HTMLElement>("[data-specimen]")]
  const select = () => {
    const value = picker.querySelector<HTMLInputElement>("input:checked")?.value
    for (const panel of panels) panel.hidden = panel.dataset.specimen !== value
  }
  picker.addEventListener("change", select)
  window.addEventListener("pageshow", select)
  picker.hidden = false
  select()
}

if (navigator.clipboard?.writeText) {
  for (const button of document.querySelectorAll<HTMLButtonElement>("[data-copy]")) {
    const id = button.dataset.copy
    if (!id) continue
    const target = document.getElementById(id)
    const feedback = document.querySelector<HTMLElement>('[data-feedback="' + id + '"]')
    const label = button.querySelector("span")
    if (!target || !feedback || !label) continue

    const initial = label.textContent
    let reset: number | undefined
    button.hidden = false
    button.addEventListener("click", async () => {
      window.clearTimeout(reset)
      try {
        await navigator.clipboard.writeText(target.textContent ?? "")
        const done = button.dataset.done ?? ""
        label.textContent = done
        feedback.textContent = done
        feedback.dataset.state = "done"
        reset = window.setTimeout(() => {
          label.textContent = initial
          feedback.textContent = ""
        }, 2200)
      } catch {
        label.textContent = initial
        feedback.textContent = button.dataset.failure ?? ""
        feedback.dataset.state = "error"
      }
    })
  }
}
