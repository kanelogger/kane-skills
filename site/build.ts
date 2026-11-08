import { copyFile, cp, mkdir, rm } from "node:fs/promises"
import { join, posix } from "node:path"
import { examples } from "./examples"
import { preparation } from "./preparation"
import { categoryLabels, deliverables, specimens } from "./specimens"

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
  deliverable: string
  prompt: string
  preparation: string
  path: string
  number: string
}

const ui = {
  zh: {
    locale: "zh-CN", switch: "English", skip: "跳到正文", index: "技能目录",
    tagline: "装一个技能，交付一件事。",
    intro: "Kane 的开源 Agent 技能库。按任务选一份可独立安装的工作流程，从原始材料做到可核对的交付物。",
    cta: "查找技能", source: "GitHub 仓库", readme: "项目说明", license: "MIT 许可",
    count: (n: number, c: number) => n + " 项技能 · " + c + " 个分类",
    catalogText: "按任务找技能，也可以直接搜索名称、用途或交付物。",
    category: "技能分类", search: "搜索技能", editSearch: "修改搜索", placeholder: "字幕、Markdown…", clear: "清空搜索",
    total: (n: number | string) => "共 " + n + " 项技能", empty: "没有匹配的技能。换个关键词，或清空搜索查看全部技能。",
    install: "安装技能", copyCommand: "复制命令", requirements: "安装器说明",
    installHelp: "在项目目录运行命令。若安装器询问目标，选择你使用的 Agent。需要 Node.js 22.20 或更新版本。",
    specimens: "工作台", input: "原始材料", sample: "产物节选", demo: "查看样例", inspect: "查看用法", prepare: "运行前准备", preview: "预览", copyError: "复制失败",
    use: "适用场景", output: "交付物", example: "试着这样问", copy: "复制示例", copied: "已复制",
    copyFail: "请选中文本手动复制。", package: "技能文件", guide: "使用说明", spec: "Agent 用法",
    path: "仓库路径", related: "同类技能", back: "返回技能目录",
  },
  en: {
    locale: "en", switch: "简体中文", skip: "Skip to content", index: "Skill catalog",
    tagline: "One skill. One deliverable.",
    intro: "Kane’s open-source workflows for your agent. Install one at a time and turn a source into something you can inspect and use.",
    cta: "Find a skill", source: "GitHub repository", readme: "Project README", license: "MIT license",
    count: (n: number, c: number) => n + " skills · " + c + " categories",
    catalogText: "Browse by task or search by name, use case, or deliverable.",
    category: "Skill categories", search: "Search skills", editSearch: "Edit search", placeholder: "Captions, Markdown…", clear: "Clear search",
    total: (n: number | string) => n + (n === 1 ? " skill" : " skills"), empty: "No skills match. Try another keyword or clear the search to see all skills.",
    install: "Install skill", copyCommand: "Copy command", requirements: "Installer documentation",
    installHelp: "Run this in your project directory. Choose your Agent if prompted. Requires Node.js 22.20 or later.",
    specimens: "Workbench", input: "Source material", sample: "Output excerpt", demo: "View examples", inspect: "View usage", prepare: "What you’ll need", preview: "Preview", copyError: "Copy failed",
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
    if (heading) groups.set(heading[1], categoryLabels[heading[1]]?.[lang === "zh" ? 0 : 1] ?? heading[2].trim())

    const row = line.match(/^\| \[\x60([a-z0-9-]+)\x60\]\((skills\/([a-z]+)\/[a-z0-9-]+\/SKILL\.md)\) \| (.+?) \| (.+?) \|/)
    if (!row) continue
    const [, id, path, cat, use, output] = row
    const example = examples[id]
    const prep = preparation[id]
    if (!example || !prep || !groups.has(cat) || path !== "skills/" + cat + "/" + id + "/SKILL.md") {
      throw new Error(file + ": invalid catalog entry for " + id)
    }
    skills.push({
      id, cat, path, output,
      use: use.replace(/^显式调用，/, "").replace(/^Invoke explicitly to explain/, "Explain"),
      deliverable: deliverables[id]?.[lang === "zh" ? 0 : 1] ?? output,
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
    '" data-error="' + t.copyError + '" data-failure="' + t.copyFail + '" hidden>' + copyIcon + '<span>' + label + '</span></button>'
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
'  <style>@media (prefers-reduced-motion: no-preference) { @view-transition { navigation: auto; } }</style>\n' +
'  <link rel="stylesheet" href="' + base + 'styles.css">\n  <script src="' + base + 'client.js" defer></script>\n' +
'</head>\n<body>\n' +
'<a class="skip" href="#main">' + t.skip + '</a>\n' +
'<header class="top"><div class="shell top-inner">\n' +
'  <a class="brand" href="' + home + '"><img src="' + base + 'armory.svg" width="35" height="35" alt=""><span>Kane Skills</span></a>\n' +
'  <nav><a class="top-index" href="' + home + '#catalog">' + t.index + '</a>' +
'<a class="top-source" href="' + repo + '">' + githubIcon + '<span class="sr-only">' + t.source + '</span></a>' +
'<a class="language" href="' + other + '" lang="' + ui[alt].locale + '" hreflang="' + ui[alt].locale + '">' + t.switch + '</a></nav>\n' +
'</div></header>\n' + content + '\n' +
'<footer class="footer"><div class="shell footer-inner"><span>Kane Skills <span aria-hidden="true">/</span> ' +
'<a href="' + repo + '/blob/main/LICENSE">' + t.license + '</a></span><div><a href="' + repo + '/blob/main/' + catalog[lang].file + '">' + t.readme + '</a>' +
'<a href="' + repo + '">' + t.source + ' ' + external + '</a></div></div></footer>\n' +
'</body>\n</html>\n'
}

function row(from: string, lang: Lang, skill: Skill, preview = false) {
  const t = ui[lang]
  return '<li class="entry" data-skill="' + skill.id + '" data-output="' + escape(skill.output.replaceAll("\x60", "")) + '">' +
    '<a class="entry-link" href="' + local(from, route(lang, skill.id)) + '">' +
    '<span class="entry-no" aria-hidden="true">' + skill.number + '</span>' +
    '<span class="entry-name"><strong data-skill-title>' + escape(skill.title) + '</strong><span class="entry-desc">' +
    inline(skill.use) + '</span><span class="sr-only">' + skill.id + '</span></span>' +
    '<span class="entry-output"><small>' + t.output + '</small><span>' + inline(skill.deliverable) + '</span></span>' +
    '<span class="entry-arrow">' + arrow + '</span></a>' +
    (preview ? '<button class="entry-preview" type="button" data-preview hidden aria-label="' + t.preview + ' ' +
      escape(skill.title) + '">' + t.preview + '</button>' : '') + '</li>'
}

function specimen(lang: Lang, item: typeof specimens[number], active: boolean) {
  const t = ui[lang]
  const i = lang === "zh" ? 0 : 1
  const title = escape(item.output[i])
  let artifact: string
  if ("time" in item) {
    artifact = '<div class="caption-artifact"><code>' + item.time + '</code><p>' + title + '</p></div>'
  } else if (item.id === "kane-url-to-markdown") {
    artifact = '<div class="note-artifact"><h3>' + title + '</h3><p>' +
      (lang === "zh" ? "按任务选技能，整包安装。" : "Pick a skill for the task and install its whole package.") +
      '</p><a href="https://github.com/kanelogger/kane-skills">' + (lang === "zh" ? "项目说明" : "Project README") +
      '</a><small><code>source: https://kanelogger.github.io/kane-skills/</code></small></div>'
  } else {
    artifact = '<dl class="retro-artifact"><div><dt>' + (lang === "zh" ? "发现" : "Finding") + '</dt><dd>' +
      (lang === "zh" ? "漏掉英文标题，导致重新构建。" : "A missing English title caused a rebuild.") +
      '</dd></div><div><dt>' + (lang === "zh" ? "下一步" : "Next action") + '</dt><dd>' + title +
      '</dd></div><div><dt>' + (lang === "zh" ? "怎么验证" : "Verify") + '</dt><dd>' +
      (lang === "zh" ? "新增技能一次构建即可双语上线。" : "The next skill ships in both languages in one build.") +
      '</dd></div></dl>'
  }
  return '<div class="sample" data-specimen="' + item.id + '"' + (active ? '' : ' hidden') + '><div class="sample-pair">' +
    '<details class="sample-file sample-input" data-source-file open><summary><span>' + t.input + '</span><code>' + item.inputName +
    '</code></summary><pre><code>' + escape(item.input[i]) + '</code></pre></details>' +
    '<figure class="sample-file sample-output"><figcaption><span>' + t.sample + '</span><code>' + item.outputName +
    '</code></figcaption>' + artifact + '</figure></div><p class="sample-caption">' + escape(item.captions[i]) + '</p></div>'
}

function commandLine(id: string, preview = false) {
  return '<span>npx</span> <span>skills</span> <span>add</span> <span>' + repoSlug +
    '</span> <span>--skill</span> <span' + (preview ? ' data-preview-id' : '') + '>' + id + '</span>'
}

function workbench(lang: Lang, from: string) {
  const t = ui[lang]
  const i = lang === "zh" ? 0 : 1
  const first = catalog[lang].skills.find(skill => skill.id === specimens[0].id)
  if (!first) throw new Error("Missing opening specimen")
  const controls = specimens.map(item =>
    '<button type="button" data-example="' + item.id + '" aria-pressed="' + String(item.id === first.id) + '">' +
    escape(item.labels[i]) + '</button>'
  ).join("")
  return '<aside class="workbench" id="workbench" data-opening aria-labelledby="workbench-label" tabindex="-1"><div class="bench-bar">' +
    '<h2 id="workbench-label">' + t.specimens + '</h2><div class="sample-picker" data-specimen-picker hidden role="group" aria-label="' +
    t.demo + '">' + controls + '</div></div><p data-preview-empty hidden>' + t.empty + '</p><div class="bench-record" data-preview-record>' +
    '<h3 class="bench-title" data-preview-title>' + escape(first.title) + '</h3>' +
    specimens.map(item => specimen(lang, item, item.id === first.id)).join("") +
    '<div class="preview-summary" data-preview-summary hidden><p data-preview-use></p><p><strong>' + t.output +
    '</strong> <span data-preview-output></span></p></div>' +
    '<div class="bench-install"><pre><code id="preview-command">' + commandLine(first.id, true) + '</code></pre>' +
    '<div class="bench-actions">' + copyButton(lang, "preview-command", t.copyCommand) +
    '<a class="sample-link" data-preview-link href="' + local(from, route(lang, first.id)) + '">' + t.inspect + ' ' + arrow +
    '</a><a class="bench-back" href="#catalog">' + t.back + '</a></div>' +
    '<p class="copy-feedback" role="status" data-feedback="preview-command"></p></div></div></aside>'
}

function homePage(lang: Lang) {
  const t = ui[lang]
  const { groups, skills } = catalog[lang]
  const from = route(lang)
  const indexed = [...groups].map(([id, title], i) => ({id, title, index: String(i + 1).padStart(2, "0")}))
  const categories = indexed.map(({ id, title, index }) =>
    '<li data-category-link><a href="#' + id + '"><span aria-hidden="true">' + index + '</span>' + escape(title) + '</a></li>'
  ).join("\n")
  const sections = indexed.map(({ id, title, index }) =>
    '<section class="group" data-group id="' + id + '" tabindex="-1"><div class="group-heading">' +
    '<h3><span aria-hidden="true">' + index + '</span>' + escape(title) + '</h3></div><ul>' +
    skills.filter(skill => skill.cat === id).map(skill => row(from, lang, skill, true)).join("\n") + '</ul></section>'
  ).join("\n")
  return frame(lang,
    '<main id="main" tabindex="-1"><section class="hero"><div class="shell hero-inner"><div class="hero-copy">' +
    '<h1>' + t.tagline + '</h1><p class="intro">' + t.intro + '</p></div><div class="hero-tools">' +
    '<form class="search" role="search" id="find" data-search hidden><label class="sr-only" for="query">' + t.search + '</label>' +
    '<div>' + searchIcon + '<input id="query" name="q" type="search" autocomplete="off" placeholder="' + t.placeholder + '"></div>' +
    '<button class="button primary" type="submit">' + t.cta + '</button></form>' +
    '<a class="button primary" href="#catalog" data-search-fallback>' + t.cta + ' ' + arrow + '</a>' +
    '<p class="hero-meta">' + t.count(skills.length, groups.size) + ' <span aria-hidden="true">/</span> ' +
    '<a href="' + repo + '/blob/main/LICENSE">MIT</a></p></div></div></section>' +
    '<div class="shell archive">' + workbench(lang, from) +
    '<section class="catalog" id="catalog" aria-labelledby="catalog-title" tabindex="-1"><div class="section-heading">' +
    '<h2 id="catalog-title">' + t.index + '</h2><a class="text-link" href="#find" data-edit-search hidden>' + t.editSearch + '</a></div>' +
    '<nav class="categories" aria-label="' + t.category + '"><ul>' + categories + '</ul></nav>' +
    '<div class="catalog-content"><p class="result-count" role="status" data-count data-template="' +
    t.total("{n}") + '" data-single="' + t.total(1) + '">' + t.total(skills.length) + '</p>' +
    '<div class="empty" data-empty hidden><p>' + t.empty + '</p><button class="reset-search" type="button">' + t.clear + '</button></div>' +
    sections + '</div></section></div></main>')
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
  const install = '<section class="install" aria-labelledby="install-title"><div class="install-heading"><h2 id="install-title">' + t.install +
    '</h2>' + copyButton(lang, "install-command", t.copyCommand) + '</div><pre><code id="install-command">' +
    commandLine(skill.id) + '</code></pre><p class="copy-feedback" role="status" data-feedback="install-command"></p>' +
    '<div class="install-prereq"><h3>' + t.prepare + '</h3><p>' + escape(skill.preparation) +
    '</p></div><p class="install-help">' + t.installHelp + ' <a href="' + installer + '">' + t.requirements + '</a></p></section>'

  return frame(lang,
    '<main class="shell detail" id="main" tabindex="-1">\n' +
    '<nav class="breadcrumb" aria-label="' + t.index + '"><a href="' + home + '#catalog">' + t.index + '</a>' +
    '<span aria-hidden="true">/</span><a href="' + home + '#' + skill.cat + '">' + escape(groups.get(skill.cat)!) + '</a></nav>\n' +
    '<header class="detail-heading"><div><h1 data-skill-title style="view-transition-name:skill-' + skill.id + '">' + escape(skill.title) + '</h1><p><code>' + skill.id +
    '</code></p></div></header>\n' +
    '<div class="detail-intro"><section class="skill-summary"><h2>' + t.use + '</h2><p>' + inline(skill.use) +
    '</p><h2>' + t.output + '</h2><p>' + inline(skill.output) + '</p></section>' + install + '</div>' +
    '<div class="detail-layout"><div class="detail-notes">' +
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
  cp(join(import.meta.dir, "fonts"), join(out, "fonts"), { recursive: true }),
  copyFile(join(root, "assets/brand/kane-skills-armory-icon.svg"), join(out, "armory.svg")),
])

for (const lang of langs) {
  await Bun.write(join(out, route(lang), "index.html"), homePage(lang))
  for (const skill of catalog[lang].skills) {
    await Bun.write(join(out, route(lang, skill.id), "index.html"), await detailPage(lang, skill))
  }
}
console.log("Built " + catalog.zh.skills.length + " skill pages and a catalog per language in site/dist.")
