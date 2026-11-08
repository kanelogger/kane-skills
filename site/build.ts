import { copyFile, mkdir, rm } from "node:fs/promises"
import { join, posix } from "node:path"
import { examples } from "./examples"
import { preparation } from "./preparation"
import { specimens } from "./specimens"

const root = join(import.meta.dir, "..")
const out = join(import.meta.dir, "dist")
const repoSlug = "kanelogger/kane-skills"
const repo = "https://github.com/" + repoSlug
const installer = "https://github.com/vercel-labs/skills#install-a-skill"
const langs = ["zh", "en"] as const
type Lang = typeof langs[number]
type Skill = {
  id: string
  cat: string
  title: string
  use: string
  output: string
  prompt: string
  preparation: string
  path: string
  number: string
}

const ui = {
  zh: {
    locale: "zh-CN", switch: "English", skip: "跳到正文", index: "技能目录", start: "如何使用",
    tagline: "装一个技能，交付一件事。",
    intro: "Kane 的开源 Agent 技能库。按任务选一份可独立安装的工作流程，从原始材料做到可核对的交付物。",
    cta: "查找技能", source: "GitHub 仓库", readme: "项目说明", license: "MIT 许可",
    count: (n: number, c: number) => n + " 项技能 · " + c + " 个分类",
    catalogText: "按任务找技能，也可以直接搜索名称、用途或交付物。",
    category: "技能分类", search: "搜索技能", editSearch: "修改搜索", placeholder: "字幕、Markdown…", clear: "清空搜索",
    total: (n: number | string) => "共 " + n + " 项技能", empty: "没有匹配的技能。换个关键词，或清空搜索查看全部技能。",
    steps: [
      ["找到合适的技能", "先看适用场景、交付物和运行前准备，再按需打开 GitHub 核对文档。"],
      ["安装到你的 Agent", "在项目目录运行技能页上的命令，选择要使用的 Agent。也可从 GitHub 复制整个技能目录。"],
      ["在对话中调用", "告诉 Agent 要用哪个技能，给出这次任务的材料、目标和交付要求。"],
    ],
    install: "安装技能", copyCommand: "复制命令", requirements: "安装器说明",
    installHelp: "在项目目录运行命令。若安装器询问目标，选择你使用的 Agent。需要 Node.js 22.20 或更新版本。",
    specimens: "看看技能会交付什么", input: "输入", sample: "产物节选", demo: "示例材料", inspect: "查看技能", prepare: "运行前准备",
    use: "适用场景", output: "交付物", example: "试着这样问", copy: "复制示例", copied: "已复制",
    copyFail: "请选中文本手动复制。", package: "技能文件", guide: "使用说明", spec: "执行指令",
    path: "仓库路径", related: "同类技能", back: "返回技能目录",
  },
  en: {
    locale: "en", switch: "简体中文", skip: "Skip to content", index: "Skill catalog", start: "How to use",
    tagline: "Pick a skill for the job.",
    intro: "Kane’s open-source workflows for your agent. Install one at a time and turn a source into something you can inspect and use.",
    cta: "Find a skill", source: "GitHub repository", readme: "Project README", license: "MIT license",
    count: (n: number, c: number) => n + " skills · " + c + " categories",
    catalogText: "Browse by task or search by name, use case, or deliverable.",
    category: "Skill categories", search: "Search skills", editSearch: "Edit search", placeholder: "Captions, Markdown…", clear: "Clear search",
    total: (n: number | string) => n + (n === 1 ? " skill" : " skills"), empty: "No skills match. Try another keyword or clear the search to see all skills.",
    steps: [
      ["Find a skill for the task", "Check the use case, deliverable, and prerequisites on the skill page. GitHub has the full documentation."],
      ["Install it in your Agent", "Run the command from the skill page in your project directory and choose your Agent. You can also copy the whole skill directory from GitHub."],
      ["Invoke it in your conversation", "Name the skill and give your Agent the input, goal, and deliverable you need."],
    ],
    install: "Install skill", copyCommand: "Copy command", requirements: "Installer documentation",
    installHelp: "Run this in your project directory. Choose your Agent if prompted. Requires Node.js 22.20 or later.",
    specimens: "From input to deliverable", input: "Input", sample: "Output excerpt", demo: "Sample material", inspect: "View skill", prepare: "What you’ll need",
    use: "When to use it", output: "What you get", example: "Try this prompt", copy: "Copy prompt", copied: "Copied",
    copyFail: "Select the text to copy it manually.", package: "Skill files", guide: "User guide", spec: "Agent instructions",
    path: "Repository path", related: "More in this category", back: "Back to the catalog",
  },
}

async function readCatalog(lang: Lang) {
  const file = lang === "zh" ? "README-CN.md" : "README.md"
  const raw = await Bun.file(join(root, file)).text()
  const groups = new Map<string, string>()
  const skills: Skill[] = []

  for (const line of raw.split(/\r?\n/)) {
    const heading = line.match(/^### ([a-z]+) [·—] (.+?)[（(]\d+[）)]$/)
    if (heading) groups.set(heading[1], heading[2].trim())

    const row = line.match(/^\| \[\x60([a-z0-9-]+)\x60\]\((skills\/([a-z]+)\/[a-z0-9-]+\/SKILL\.md)\) \| (.+?) \| (.+?) \|/)
    if (!row) continue
    const [, id, path, cat, use, output] = row
    const example = examples[id]
    const prep = preparation[id]
    if (!example || !prep || !groups.has(cat) || path !== "skills/" + cat + "/" + id + "/SKILL.md") {
      throw new Error(file + ": invalid catalog entry for " + id)
    }
    skills.push({
      id, cat, path, use, output,
      title: example[lang === "zh" ? 0 : 1],
      prompt: example[lang === "zh" ? 2 : 3],
      preparation: prep[lang === "zh" ? 0 : 1],
      number: String(skills.length + 1).padStart(2, "0"),
    })
  }

  const actual = new Set(await Array.fromAsync(new Bun.Glob("skills/*/*/SKILL.md").scan(root)))
  for (const skill of skills) {
    if (!actual.delete(skill.path)) throw new Error(file + ": repeated or missing " + skill.path)
  }
  if (actual.size) throw new Error(file + ": catalog is missing " + [...actual].join(", "))
  if (new Set(skills.map(skill => skill.id)).size !== skills.length) throw new Error(file + ": duplicate skill ID")
  return { file, groups, skills }
}

const catalog = { zh: await readCatalog("zh"), en: await readCatalog("en") }
if (catalog.zh.skills.map(s => s.path).join() !== catalog.en.skills.map(s => s.path).join()) {
  throw new Error("README skill catalogs must use the same order")
}

function escape(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;")
}

function inline(value: string) {
  return escape(value).replace(/\x60([^\x60]+)\x60/g, "<code>$1</code>")
}

function route(lang: Lang, id?: string) {
  return [lang === "en" ? "en" : "", id ? "skills/" + id : ""].filter(Boolean).join("/")
}

function local(from: string, to: string) {
  return (posix.relative("/" + from, "/" + to) || ".") + "/"
}

const arrow = '<svg aria-hidden="true" viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M2 8h11m-4-4 4 4-4 4"/></svg>'
const external = '<svg aria-hidden="true" viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M4 12 12 4M5 4h7v7"/></svg>'
const searchIcon = '<svg aria-hidden="true" viewBox="0 0 20 20" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="8.5" cy="8.5" r="4.5"/><path d="m12 12 4 4"/></svg>'
const copyIcon = '<svg aria-hidden="true" viewBox="0 0 20 20" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.4"><rect x="7" y="7" width="9" height="9" rx="1"/><path d="M12 5V4H4v8h1"/></svg>'
const githubIcon = '<svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M12 .8a11.2 11.2 0 0 0-3.54 21.82c.56.1.77-.24.77-.54v-2.09c-3.13.68-3.8-1.33-3.8-1.33-.51-1.3-1.24-1.64-1.24-1.64-1.03-.7.08-.69.08-.69 1.13.08 1.73 1.16 1.73 1.16 1 1.73 2.63 1.23 3.27.94.1-.73.39-1.23.71-1.51-2.5-.29-5.13-1.25-5.13-5.57 0-1.23.44-2.24 1.16-3.03-.12-.28-.5-1.43.11-2.98 0 0 .95-.31 3.1 1.15a10.8 10.8 0 0 1 5.64 0c2.14-1.46 3.09-1.15 3.09-1.15.61 1.55.23 2.7.11 2.98.72.79 1.16 1.8 1.16 3.03 0 4.33-2.63 5.28-5.14 5.56.4.35.76 1.03.76 2.08v3.09c0 .3.2.65.78.54A11.2 11.2 0 0 0 12 .8Z"/></svg>'

function copyButton(lang: Lang, target: string, label: string) {
  const t = ui[lang]
  return '<button class="copy-button" type="button" data-copy="' + target + '" data-done="' + t.copied +
    '" data-failure="' + t.copyFail + '" hidden>' + copyIcon + '<span>' + label + '</span></button>'
}

function frame(lang: Lang, content: string, skill?: Skill) {
  const t = ui[lang]
  const alt = lang === "zh" ? "en" : "zh"
  const from = route(lang, skill?.id)
  const base = local(from, "")
  const home = local(from, route(lang))
  const other = local(from, route(alt, skill?.id))
  const title = skill ? skill.title + " · Kane Skills" : "Kane Skills · " + (lang === "zh" ? "Agent 技能库" : "Agent Skills Library")
  const desc = skill ? skill.use.replaceAll("\x60", "") : t.intro
  return '<!doctype html>\n' +
'<html lang="' + t.locale + '">\n<head>\n' +
'  <meta charset="utf-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1">\n' +
'  <title>' + escape(title) + '</title>\n  <meta name="description" content="' + escape(desc) + '">\n' +
'  <meta property="og:title" content="' + escape(title) + '">\n  <meta property="og:description" content="' + escape(desc) + '">\n' +
'  <link rel="alternate" hreflang="' + ui[alt].locale + '" href="' + other + '">\n' +
'  <link rel="icon" type="image/svg+xml" href="' + base + 'armory.svg">\n' +
'  <link rel="stylesheet" href="' + base + 'styles.css">\n  <script src="' + base + 'client.js" defer></script>\n' +
'</head>\n<body>\n' +
'<a class="skip" href="#main">' + t.skip + '</a>\n' +
'<header class="top"><div class="shell top-inner">\n' +
'  <a class="brand" href="' + home + '"><img src="' + base + 'armory.svg" width="35" height="35" alt=""><span>Kane Skills</span></a>\n' +
'  <nav><a class="top-index" href="' + home + '#catalog">' + t.index + '</a><a class="top-start" href="' + home + '#start">' + t.start + '</a>' +
'<a class="top-source" href="' + repo + '">' + githubIcon + '<span class="sr-only">' + t.source + '</span></a>' +
'<a class="language" href="' + other + '" lang="' + ui[alt].locale + '" hreflang="' + ui[alt].locale + '">' + t.switch + '</a></nav>\n' +
'</div></header>\n' + content + '\n' +
'<footer class="footer"><div class="shell footer-inner"><span>Kane Skills <span aria-hidden="true">/</span> ' +
'<a href="' + repo + '/blob/main/LICENSE">' + t.license + '</a></span><div><a href="' + repo + '/blob/main/' + catalog[lang].file + '">' + t.readme + '</a>' +
'<a href="' + repo + '">' + t.source + ' ' + external + '</a></div></div></footer>\n' +
'</body>\n</html>\n'
}

function row(from: string, lang: Lang, skill: Skill) {
  return '<li class="entry" data-skill data-output="' + escape(skill.output.replaceAll("\x60", "")) + '">' +
    '<a href="' + local(from, route(lang, skill.id)) + '">' +
    '<span class="entry-no" aria-hidden="true">' + skill.number + '</span>' +
    '<span class="entry-name"><strong>' + escape(skill.title) + '</strong><code>' + skill.id + '</code></span>' +
    '<span class="entry-desc">' + inline(skill.use) + '</span><span class="entry-arrow">' + arrow + '</span></a></li>'
}

function specimen(lang: Lang, item: typeof specimens[number]) {
  const t = ui[lang]
  const file = (label: string, name: string, body: string, role: string) =>
    '<figure class="sample-file ' + role + '"><figcaption><span>' + label + '</span><code>' + escape(name) +
    '</code></figcaption><pre><code>' + escape(body) + '</code></pre></figure>'
  return '<div class="sample-pair">' + file(t.input, item.inputName, item.input, "sample-input") +
    file(t.sample, item.outputName, item.output, "sample-output") + '</div><p class="sample-caption">' +
    escape(item.captions[lang === "zh" ? 0 : 1]) + '</p>'
}

function workbench(lang: Lang, from: string) {
  const t = ui[lang]
  const controls = specimens.map((item, i) =>
    '<label class="sample-option"><input type="radio" name="specimen" value="' + item.id + '"' +
    (i === 0 ? ' checked' : '') + '><span>' + escape(item.labels[lang === "zh" ? 0 : 1]) + '</span></label>'
  ).join("")
  const panels = specimens.map((item, i) => {
    const skill = catalog[lang].skills.find(skill => skill.id === item.id)
    if (!skill) throw new Error("Missing specimen skill " + item.id)
    return '<div data-specimen="' + item.id + '"' + (i ? ' hidden' : '') + '>' + specimen(lang, item) +
      '<a class="sample-link" href="' + local(from, route(lang, item.id)) + '">' + t.inspect + '<span class="sr-only"> ' +
      escape(skill.title) + '</span> ' + arrow + '</a></div>'
  }).join("")
  return '<section class="workbench" aria-labelledby="specimen-heading"><div class="workbench-heading"><h2 id="specimen-heading">' +
    t.specimens + '</h2><span>' + t.demo + '</span></div><fieldset class="sample-picker" data-specimen-picker hidden>' +
    '<legend class="sr-only">' + t.specimens + '</legend>' + controls + '</fieldset>' + panels + '</section>'
}

function homePage(lang: Lang) {
  const t = ui[lang]
  const { groups, skills } = catalog[lang]
  const from = route(lang)
  const groupsWithCount = [...groups].map(([id, title], index) => ({
    id, title, index: String(index + 1).padStart(2, "0"),
    size: String(skills.filter(skill => skill.cat === id).length).padStart(2, "0"),
  }))

  const categories = groupsWithCount.map(({ id, title, size }) =>
    '<li data-category-link><a href="#' + id + '"><span>' + escape(title) + '</span><span class="category-count" aria-hidden="true">' +
    size + '</span></a></li>'
  ).join("\n")

  const sections = groupsWithCount.map(({ id, title, index }) =>
    '<section class="group" data-group id="' + id + '" tabindex="-1"><div class="group-heading">' +
    '<h3><span aria-hidden="true">' + index + '</span>' + escape(title) + '</h3><span class="group-id" aria-hidden="true">' + id + '</span></div><ul>' +
    skills.filter(skill => skill.cat === id).map(skill => row(from, lang, skill)).join("\n") + '</ul></section>'
  ).join("\n")

  return frame(lang,
    '<main id="main" tabindex="-1">\n' +
    '<section class="hero"><div class="shell hero-inner"><div class="hero-copy">' +
    '<h1>Kane Skills<span>.</span></h1><p class="tagline">' + t.tagline + '</p><p class="intro">' + t.intro + '</p>' +
    '<form class="search" role="search" id="find" data-search hidden><label class="sr-only" for="query">' + t.search + '</label>' +
    '<div>' + searchIcon + '<input id="query" name="q" type="search" autocomplete="off" placeholder="' + t.placeholder + '"></div>' +
    '<button class="button primary" type="submit">' + t.cta + '</button></form><div class="hero-actions">' +
    '<a class="button primary" href="#catalog" data-search-fallback>' + t.cta + ' ' + arrow + '</a>' +
    '<a class="hero-source" href="' + repo + '">' + t.source + ' ' + external + '</a></div></div>' +
    workbench(lang, from) + '<p class="hero-meta">' + t.count(skills.length, groups.size) +
    '<span aria-hidden="true"> / </span><a href="' + repo + '/blob/main/LICENSE">MIT</a></p></div></section>\n' +
    '<section class="shell catalog" id="catalog" aria-labelledby="catalog-title" tabindex="-1"><div class="section-heading"><div><h2 id="catalog-title">' + t.index + '</h2><p>' + t.catalogText +
    '</p></div><a class="text-link" href="#find" data-edit-search hidden>' + t.editSearch + '</a></div>' +
    '<div class="catalog-layout"><nav class="categories" aria-label="' + t.category + '"><p>' + t.category +
    '</p><ul>' + categories + '</ul></nav><div class="catalog-content"><p class="result-count" role="status" data-count data-template="' +
    t.total("{n}") + '" data-single="' + t.total(1) + '">' + t.total(skills.length) + '</p>' +
    '<div class="empty" data-empty hidden><p>' + t.empty + '</p><button class="reset-search" type="button">' + t.clear + '</button></div>' +
    sections + '</div></div></section>\n' +
    '<section id="start" class="start"><div class="shell"><h2>' + t.start + '</h2><ol>' +
    t.steps.map(([label, body]) => '<li><h3>' + label + '</h3><p>' + body + '</p></li>').join("") +
    '</ol></div></section>\n</main>')
}

async function detailPage(lang: Lang, skill: Skill) {
  const t = ui[lang]
  const { groups, skills } = catalog[lang]
  const from = route(lang, skill.id)
  const home = local(from, route(lang))
  const dir = skill.path.slice(0, -"SKILL.md".length)
  const source = repo + "/blob/main/" + dir
  const guide = await Bun.file(join(root, dir, "README.md")).exists()
  const related = skills.filter(item => item.cat === skill.cat && item.id !== skill.id)
  const sample = specimens.find(item => item.id === skill.id)
  const command = "npx skills add " + repoSlug
  const install = '<section class="install" aria-labelledby="install-title"><div class="install-heading"><h2 id="install-title">' + t.install +
    '</h2>' + copyButton(lang, "install-command", t.copyCommand) + '</div><div class="install-prereq"><h3>' + t.prepare +
    '</h3><p>' + escape(skill.preparation) + '</p></div><pre><code id="install-command">' + escape(command) + ' <span>--skill ' + escape(skill.id) + '</span></code></pre><p>' + t.installHelp + ' <a href="' + installer + '">' +
    t.requirements + '</a></p><p class="copy-feedback" role="status" data-feedback="install-command"></p></section>'

  return frame(lang,
    '<main class="shell detail" id="main" tabindex="-1">\n' +
    '<nav class="breadcrumb" aria-label="' + t.index + '"><a href="' + home + '#catalog">' + t.index + '</a>' +
    '<span aria-hidden="true">/</span><a href="' + home + '#' + skill.cat + '">' + escape(groups.get(skill.cat)!) + '</a></nav>\n' +
    '<header class="detail-heading"><div><h1>' + escape(skill.title) + '</h1><p><code>' + skill.id +
    '</code></p></div><span class="record-number" aria-hidden="true">' + skill.number + '</span></header>\n' +
    '<div class="detail-intro"><section class="skill-summary"><h2>' + t.use + '</h2><p>' + inline(skill.use) +
    '</p><h2>' + t.output + '</h2><p>' + inline(skill.output) + '</p></section>' + install + '</div>' +
    '<div class="detail-layout"><div class="detail-notes">' +
    (sample ? '<section class="detail-specimen"><h2>' + t.sample + '</h2>' + specimen(lang, sample) + '</section>' : '') +
    '<section class="prompt"><div class="prompt-heading"><h2>' + t.example + '</h2>' + copyButton(lang, "example", t.copy) +
    '</div><blockquote id="example">' + escape(skill.prompt) + '</blockquote><p class="copy-feedback" role="status" data-feedback="example"></p></section></div>' +
    '<aside class="files"><h2>' + t.package + '</h2><ul>' +
    (guide ? '<li><a href="' + source + 'README.md"><span>' + t.guide + '<small>README.md</small></span>' + external + '</a></li>' : "") +
    '<li><a href="' + source + 'SKILL.md"><span>' + t.spec + '<small>SKILL.md</small></span>' + external + '</a></li></ul>' +
    '<p>' + t.path + '<a href="' + repo + '/tree/main/' + dir + '"><code>' + dir + '</code></a></p></aside></div>\n' +
    '<section class="related"><h2>' + t.related + '</h2><ul>' + related.map(item => row(from, lang, item)).join("\n") +
    '</ul></section><a class="text-link back" href="' + home + '#catalog">' + arrow + ' ' + t.back + '</a>\n' +
    '</main>', skill)
}

await rm(out, { recursive: true, force: true })
await mkdir(out, { recursive: true })
const build = await Bun.build({ entrypoints: [join(import.meta.dir, "client.ts")], outdir: out, target: "browser" })
if (!build.success) throw new Error(build.logs.join("\n"))
await Promise.all([
  copyFile(join(import.meta.dir, "styles.css"), join(out, "styles.css")),
  copyFile(join(root, "assets/brand/kane-skills-armory-icon.svg"), join(out, "armory.svg")),
])

for (const lang of langs) {
  await Bun.write(join(out, route(lang), "index.html"), homePage(lang))
  for (const skill of catalog[lang].skills) {
    await Bun.write(join(out, route(lang, skill.id), "index.html"), await detailPage(lang, skill))
  }
}
console.log("Built " + catalog.zh.skills.length + " skill pages and a catalog per language in site/dist.")
