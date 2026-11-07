import { Defuddle } from "defuddle/node";
import createDOMPurify from "dompurify";
import { JSDOM } from "jsdom";

export interface Article {
  title: string;
  author?: string;
  published?: string;
  site?: string;
  language?: string;
  markdown: string;
  warnings: string[];
}

function text(value: string | null | undefined): string | undefined {
  return value?.replace(/[\u0000-\u001f\u007f]/g, " ").trim() || undefined;
}

function gate(value: string | null | undefined, substantial = false): boolean {
  const name = value?.trim().split(/\s+[|–—]\s+/)[0]?.replace(/[.!…]+$/u, "").trim() || "";
  if (substantial && /^(?:sign in|log in|login|captcha|登录)$/i.test(name)) return false;
  return /^(?:(?:401|403|404|429|500|502|503)\s*[-:]?\s*)?(?:just a moment|attention required|access denied|forbidden|not found|page not found|service unavailable|too many requests|internal server error|bad gateway|sign in|log in|login|login required|authentication required|verify (?:that )?you are (?:a )?human|checking your browser(?: before accessing)?|security verification|robot or human\??|captcha|请完成安全验证|安全验证|访问受限|请先登录|登录|页面不存在)$/i.test(name);
}

function safe(value: string, base: string, image: boolean): string | undefined {
  try {
    const url = new URL(value, base);
    if (url.username || url.password) return;
    if (!["http:", "https:", ...(image ? [] : ["mailto:", "tel:"])].includes(url.protocol)) return;
    return url.href;
  } catch {
    return;
  }
}

function sources(value: string, base: string): string {
  const out: string[] = [];
  let rest = value;
  while (rest) {
    rest = rest.replace(/^[\s,]+/, "");
    if (!rest) break;
    const raw = rest.match(/^\S+/)![0];
    rest = rest.slice(raw.length);
    let desc = "";
    if (!raw.endsWith(",")) {
      const end = rest.indexOf(",");
      desc = (end < 0 ? rest : rest.slice(0, end)).trim();
      rest = end < 0 ? "" : rest.slice(end + 1);
    }
    const url = safe(raw.replace(/,+$/, ""), base, true);
    if (url && (!desc || /^(?:\d+w|(?:\d+(?:\.\d+)?|\.\d+)x)$/.test(desc))) {
      out.push(`${url}${desc ? ` ${desc}` : ""}`);
    }
  }
  return out.join(", ");
}

function keepImages(value: unknown): void {
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    value.forEach(keepImages);
    return;
  }
  const data = value as Record<string, unknown>;
  delete data.image;
  Object.values(data).forEach(keepImages);
}

export async function extractPage(html: string, url: string): Promise<Article> {
  const dom = new JSDOM(html, { url });
  try {
    const doc = dom.window.document;
    const title = doc.title;
    const shell = doc.body.cloneNode(true) as HTMLElement;
    shell.querySelectorAll("script, style, template, noscript, nav, footer").forEach(el => el.remove());
    const body = shell.textContent?.replace(/\s+/g, " ").trim() || "";
    const heading = shell.querySelector("h1, h2")?.textContent;
    const article = shell.querySelector("article, main, [role='main']");
    const substantial = (article?.textContent?.trim().length || 0) > 600;
    if (gate(title, substantial) || gate(heading, substantial) || (!substantial && body.length < 1600 && (
      (doc.querySelector("input[type='password']") && /\b(?:sign in|log in|login)\b|登录/i.test(body)) ||
      /^(?:please )?(?:verify (?:that )?you are (?:a )?human|complete (?:the )?(?:security check|captcha)|checking your browser|enable javascript and cookies to continue|sign in to continue|log in to continue)\b/i.test(body)
    ))) throw new Error("The page contains a login, verification, or error shell, not an article.");

    let base = url;
    try {
      const value = new URL(doc.baseURI);
      if (["http:", "https:"].includes(value.protocol) && !value.username && !value.password) base = value.href;
    } catch {}
    doc.querySelectorAll("base").forEach(el => el.remove());
    const baseEl = doc.createElement("base");
    baseEl.href = base;
    doc.head.append(baseEl);
    doc.body.querySelectorAll("script[type='application/ld+json'], style").forEach(el => doc.head.append(el));
    doc.querySelectorAll('meta[property="og:image"], meta[name="twitter:image"], meta[name="sailthru.image.full"]').forEach(el => el.remove());
    for (const script of doc.querySelectorAll('script[type="application/ld+json"]')) {
      try {
        const value: unknown = JSON.parse(script.textContent || "");
        keepImages(value);
        script.textContent = JSON.stringify(value);
      } catch {}
    }

    for (const el of doc.querySelectorAll("body, body *")) {
      const style = dom.window.getComputedStyle(el);
      if (el.hasAttribute("hidden") || el.getAttribute("aria-hidden") === "true" || style.display === "none" || style.visibility === "hidden" || style.visibility === "collapse") {
        if (el === doc.body) throw new Error("The page body is hidden; capture the rendered page instead.");
        el.remove();
      }
    }

    const purify = createDOMPurify(dom.window);
    purify.sanitize(doc.body, {
      IN_PLACE: true,
      USE_PROFILES: { html: true },
      FORBID_TAGS: ["script", "style", "iframe", "object", "embed", "form", "input", "button", "textarea", "select", "option", "link", "meta", "base"],
      FORBID_ATTR: ["style", "srcdoc"],
    });
    for (const el of doc.body.querySelectorAll("*")) {
      for (const attr of ["href", "src", "poster", "data-src", "data-original", "data-lazy-src"]) {
        if (!el.hasAttribute(attr)) continue;
        const value = safe(el.getAttribute(attr)!, base, attr !== "href");
        if (value) el.setAttribute(attr, value);
        else el.removeAttribute(attr);
      }
      for (const attr of ["srcset", "data-srcset", "data-lazy-srcset"]) {
        if (!el.hasAttribute(attr)) continue;
        const value = sources(el.getAttribute(attr)!, base);
        if (value) el.setAttribute(attr, value);
        else el.removeAttribute(attr);
      }
    }

    doc.body.querySelectorAll("pre").forEach(pre => {
      if (!pre.textContent?.trim()) pre.remove();
    });
    let mark = "KANE_CODE_BLOCK_";
    while (html.includes(mark) || doc.documentElement.textContent?.includes(mark)) mark += "_";
    const codes = Array.from(doc.body.querySelectorAll("pre"), (pre, i) => {
      const code = pre.querySelector("code");
      const value = pre.textContent || "";
      const language = text(code?.getAttribute("data-language") || pre.getAttribute("data-language") || code?.className.match(/(?:^|\s)language-([^\s]+)/)?.[1] || pre.className.match(/(?:^|\s)language-([^\s]+)/)?.[1])?.replace(/[^\w.+#-]/g, "") || "";
      const token = `${mark}${i}_END`;
      const node = doc.createElement("code");
      node.textContent = token;
      if (language) node.setAttribute("data-language", language);
      pre.replaceChildren(node);
      return { value, language, token };
    });

    const result = await Defuddle(doc, url, {
      markdown: true,
      useAsync: false,
      removeSmallImages: false,
      removeHiddenElements: false,
      removeLowScoring: false,
      removeContentPatterns: false,
    });
    if (gate(result.title, substantial)) throw new Error("The extracted page is a login, verification, or error page, not an article.");
    let markdown = result.content.trim();
    for (const code of codes) {
      let width = 3;
      for (const run of code.value.matchAll(/`+/g)) width = Math.max(width, run[0].length + 1);
      const fence = "`".repeat(width);
      const block = `${fence}${code.language}\n${code.value}${code.value.endsWith("\n") ? "" : "\n"}${fence}`;
      markdown = markdown.replace(new RegExp("(`{3,})[^\\n]*\\n" + code.token + "\\n\\1", "g"), () => block);
      if (markdown.includes(code.token)) throw new Error("The extracted code block could not be preserved faithfully.");
    }
    if (!markdown) throw new Error("No article content could be extracted from the page.");
    const warnings: string[] = [];
    const name = text(result.title);
    if (!name) warnings.push("The page has no title; the source hostname is used instead.");
    if (markdown.replace(/\s/g, "").length < 400) {
      warnings.push("The extracted article is short. Manually compare it with the source page before accepting it.");
    }
    return {
      title: name || new URL(url).hostname,
      author: text(result.author),
      published: text(result.published),
      site: text(result.site),
      language: text(result.language),
      markdown,
      warnings,
    };
  } finally {
    dom.window.close();
  }
}
