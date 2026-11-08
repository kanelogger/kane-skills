import { copyFile, mkdir, rm } from "node:fs/promises"
import { join, posix } from "node:path"
import { examples } from "./examples"

const root = join(import.meta.dir, "..")
const out = join(import.meta.dir, "dist")
const repo = "https://github.com/kanelogger/kane-skills"
const langs = ["zh", "en"] as const
type Lang = typeof langs[number]
type Skill = {
  id: string
  cat: string
  title: string
  use: string
  output: string
  prompt: string
  path: string
  number: string
}

const ui = {
  zh: {
    locale: "zh-CN", switch: "English", skip: "跳到正文", index: "技能目录", start: "如何使用",
    intro: "Kane 的开源 Agent 技能库。把阅读、写作、发布和开发中的工作方法，封装成可单独使用的技能包。",
    cta: "浏览技能", source: "GitHub 仓库", readme: "项目说明", license: "MIT 许可",
    count: (n: number, c: number) => n + " 项技能 · " + c + " 个分类",
    catalogText: "按任务找技能，也可以直接搜索名称、用途或交付物。",
    category: "技能分类", search: "搜索技能", placeholder: "试试「字幕」或「Markdown」",
    total: (n: number | string) => "共 " + n + " 项技能", empty: "没有匹配的技能。换个关键词，或清空搜索查看全部技能。",
    steps: [
      ["找到合适的技能", "先看技能页的适用场景和交付物，再到 GitHub 确认所需工具与使用限制。"],
      ["复制整个技能目录", "把包含 SKILL.md 的目录安装或复制到你的 Agent 能读取的位置，保留随包的脚本和参考资料。"],
      ["在对话中调用", "告诉 Agent 要用哪个技能，给出这次任务的材料、目标和交付要求。"],
    ],
    use: "适用场景", output: "交付物", example: "试着这样问", copy: "复制示例", copied: "已复制",
    copyFail: "请选中文本手动复制。", package: "技能文件", guide: "使用说明", spec: "执行指令",
    path: "仓库路径", related: "同类技能", back: "返回技能目录",
  },
  en: {
    locale: "en", switch: "简体中文", skip: "Skip to content", index: "Skill catalog", start: "How to use",
    intro: "Kane’s open-source collection of reusable Agent Skills for reading, writing, publishing, and software development.",
    cta: "Browse skills", source: "GitHub repository", readme: "Project README", license: "MIT license",
    count: (n: number, c: number) => n + " skills · " + c + " categories",
    catalogText: "Browse by task or search by name, use case, or deliverable.",
    category: "Skill categories", search: "Search skills", placeholder: "Try “captions” or “Markdown”",
    total: (n: number | string) => n + (n === 1 ? " skill" : " skills"), empty: "No skills match. Try another keyword or clear the search to see all skills.",
    steps: [
      ["Find a skill for the task", "Check the use case and deliverable on the skill page. See GitHub for requirements and limitations."],
      ["Copy the whole skill directory", "Install or copy the directory containing SKILL.md where your Agent can read it. Keep the bundled scripts and references with it."],
      ["Invoke it in your conversation", "Name the skill and give your Agent the input, goal, and deliverable you need."],
    ],
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
    if (!example || !groups.has(cat) || path !== "skills/" + cat + "/" + id + "/SKILL.md") {
      throw new Error(file + ": invalid catalog entry for " + id)
    }
    skills.push({
      id, cat, path, use, output,
      title: example[lang === "zh" ? 0 : 1],
      prompt: example[lang === "zh" ? 2 : 3],
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
'  <nav><a class="top-index" href="' + home + '#catalog">' + t.index + '</a><a href="' + home + '#start">' + t.start + '</a>' +
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

function homePage(lang: Lang) {
  const t = ui[lang]
  const { groups, skills } = catalog[lang]
  const from = route(lang)
  const plate = '<div class="plate" aria-hidden="true">' +
    '<svg class="engraving" viewBox="0 0 360 310" fill="none"><g stroke="currentColor">' +
    '<path opacity=".46" d="M17 42V17h25m276 0h25v25m0 226v25h-25m-276 0H17v-25M180 19v272M27 155h306"/>' +
    '<circle opacity=".38" cx="180" cy="155" r="121"/><circle opacity=".64" cx="180" cy="155" r="111"/>' +
    '<circle opacity=".29" cx="180" cy="155" r="91" stroke-dasharray="1 5"/>' +
    '<path opacity=".62" d="m180 28 5 6-5 6-5-6zm0 242 5 6-5 6-5-6zM53 155l6-5 6 5-6 5zm242 0 6-5 6 5-6 5z"/>' +
    '</g></svg><img src="' + local(from, "") + 'armory.svg" width="166" height="166" alt=""></div>'

  const categories = [...groups].map(([id, title]) =>
    '<li data-category-link><a href="#' + id + '"><span>' + escape(title) + '</span><span class="category-count" aria-hidden="true">' +
    String(skills.filter(skill => skill.cat === id).length).padStart(2, "0") + '</span></a></li>'
  ).join("\n")

  const sections = [...groups].map(([id, title]) =>
    '<section class="group" data-group id="' + id + '"><div class="group-heading">' +
    '<h3>' + escape(title) + '</h3><span class="group-id" aria-hidden="true">' + id + '</span></div><ul>' +
    skills.filter(skill => skill.cat === id).map(skill => row(from, lang, skill)).join("\n") + '</ul></section>'
  ).join("\n")

  return frame(lang,
    '<main id="main" tabindex="-1">\n' +
    '<section class="hero"><div class="shell hero-inner"><div class="hero-copy">' +
    '<h1>Kane Skills<span>.</span></h1><p class="intro">' + t.intro + '</p><div class="hero-actions">' +
    '<a class="button primary" href="#catalog">' + t.cta + ' ' + arrow + '</a>' +
    '<a class="hero-source" href="' + repo + '">' + t.source + ' ' + external + '</a></div></div>' +
    '<div class="hero-art">' + plate + '</div><p class="hero-meta">' + t.count(skills.length, groups.size) +
    '<span aria-hidden="true"> / </span><a href="' + repo + '/blob/main/LICENSE">MIT</a></p></div></section>\n' +
    '<section class="shell catalog" id="catalog"><div class="section-heading"><div><h2>' + t.index + '</h2><p>' + t.catalogText + '</p></div>' +
    '<div class="search" data-search hidden><label class="sr-only" for="query">' + t.search + '</label>' + searchIcon +
    '<input id="query" type="search" autocomplete="off" placeholder="' + t.placeholder + '"></div></div>' +
    '<div class="catalog-layout"><nav class="categories" aria-label="' + t.category + '"><p>' + t.category +
    '</p><ul>' + categories + '</ul></nav><div class="catalog-content"><p class="result-count" role="status" data-count data-template="' +
    t.total("{n}") + '" data-single="' + t.total(1) + '">' + t.total(skills.length) + '</p>' +
    '<p class="empty" data-empty hidden>' + t.empty + '</p>' + sections + '</div></div></section>\n' +
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

  return frame(lang,
    '<main class="shell detail" id="main" tabindex="-1">\n' +
    '<nav class="breadcrumb" aria-label="' + t.index + '"><a href="' + home + '#catalog">' + t.index + '</a>' +
    '<span aria-hidden="true">/</span><a href="' + home + '#' + skill.cat + '">' + escape(groups.get(skill.cat)!) + '</a></nav>\n' +
    '<header class="detail-heading"><div><h1>' + escape(skill.title) + '</h1><p><code>' + skill.id +
    '</code></p></div><div class="record-number" aria-hidden="true">' + skill.number + '</div></header>\n' +
    '<div class="detail-layout"><div class="detail-body"><section><h2>' + t.use + '</h2><p>' + inline(skill.use) +
    '</p></section><section><h2>' + t.output + '</h2><p>' + inline(skill.output) + '</p></section>' +
    '<section><div class="prompt-heading"><h2>' + t.example + '</h2><button type="button" data-copy hidden>' + t.copy + '</button></div>' +
    '<blockquote id="example">' + escape(skill.prompt) + '</blockquote><p class="copy-feedback" role="status" data-feedback ' +
    'data-success="' + t.copied + '" data-failure="' + t.copyFail + '"></p></section></div>' +
    '<aside class="files"><h2>' + t.package + '</h2><ul>' +
    (guide ? '<li><a href="' + source + 'README.md"><span>' + t.guide + '<small>README.md</small></span>' + external + '</a></li>' : "") +
    '<li><a href="' + source + 'SKILL.md"><span>' + t.spec + '<small>SKILL.md</small></span>' + external + '</a></li></ul>' +
    '<p>' + t.path + '<code>' + dir + '</code></p><a class="text-link" href="' + home + '#start">' + t.start + ' ' + arrow + '</a></aside></div>\n' +
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
