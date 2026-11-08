const search = document.querySelector<HTMLElement>("[data-search]")
const input = document.querySelector<HTMLInputElement>("#query")
const count = document.querySelector<HTMLElement>("[data-count]")
const empty = document.querySelector<HTMLElement>("[data-empty]")

if (search && input && count && empty) {
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

  input.addEventListener("input", filter)
  window.addEventListener("pageshow", filter)
  search.hidden = false
  filter()
}

const copy = document.querySelector<HTMLButtonElement>("[data-copy]")
const example = document.querySelector<HTMLElement>("#example")
const feedback = document.querySelector<HTMLElement>("[data-feedback]")

if (copy && example && feedback && navigator.clipboard) {
  copy.hidden = false
  copy.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(example.textContent?.trim() ?? "")
      feedback.textContent = feedback.dataset.success ?? ""
    } catch {
      feedback.textContent = feedback.dataset.failure ?? ""
    }
  })
}
