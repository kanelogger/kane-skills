import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";

import {
  cleanSummaryText,
  extractSummaryFromBody,
  extractTitleFromMarkdown,
  parseFrontmatter,
  preprocessMermaidInMarkdown,
  renderMarkdownDocument,
  replaceMarkdownImagesWithPlaceholders,
  resolveColorToken,
  resolveContentImages,
  serializeFrontmatter,
  stripWrappingQuotes,
} from "baoyu-md";
import { closeRenderer, renderMermaidToPng } from "baoyu-chrome-cdp/mermaid";
import { preprocessWechatScrollComponents } from "./wechat-scroll-components.ts";
import {
  loadWechatExtendConfig,
  resolveRenderStyle,
  type WechatRenderStyle,
  type WechatRenderStyleOverrides,
} from "./wechat-extend-config.ts";

interface ImageInfo {
  placeholder: string;
  localPath: string;
  originalPath: string;
  alt?: string;
}

interface ParsedResult {
  title: string;
  author: string;
  summary: string;
  htmlPath: string;
  contentImages: ImageInfo[];
  style: WechatRenderStyle;
}

function setCssProperty(style: string, property: string, value: string): string {
  const escaped = property.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const declaration = `${property}: ${value};`;
  const pattern = new RegExp(`${escaped}\\s*:[^;]*;?`, "i");
  return pattern.test(style)
    ? style.replace(pattern, declaration)
    : `${style.trim()}${style.trim() && !style.trim().endsWith(";") ? ";" : ""} ${declaration}`.trim();
}

function rewriteInlineStyle(
  html: string,
  selector: RegExp,
  mutate: (style: string) => string,
): string {
  return html.replace(selector, (tag, before: string, style: string, after: string) => (
    `${before}${mutate(style)}${after}`
  ));
}

export function applyWechatRenderStyle(html: string, style: WechatRenderStyle): string {
  let result = html;

  result = rewriteInlineStyle(
    result,
    /(<section\b[^>]*class="[^"]*\bcontainer\b[^"]*"[^>]*style=")([^"]*)("[^>]*>)/gi,
    (css) => setCssProperty(css, "line-height", style.lineHeight ?? "1.75"),
  );
  result = rewriteInlineStyle(
    result,
    /(<p\b[^>]*class="[^"]*\bp\b[^"]*"[^>]*style=")([^"]*)("[^>]*>)/gi,
    (css) => setCssProperty(
      setCssProperty(css, "margin", style.paragraphSpacing ?? "1.5em 8px"),
      "line-height",
      style.lineHeight ?? "1.75",
    ),
  );

  if (style.headingStyle !== "filled") {
    result = rewriteInlineStyle(
      result,
      /(<h[2-4]\b[^>]*style=")([^"]*)("[^>]*>)/gi,
      (css) => {
        let updated = setCssProperty(css, "background", "transparent");
        updated = setCssProperty(updated, "color", style.color ?? "#0F4C81");
        updated = setCssProperty(updated, "display", "block");
        updated = setCssProperty(updated, "text-align", "left");
        if (style.headingStyle === "underline") {
          updated = setCssProperty(updated, "border-bottom", `2px solid ${style.color ?? "#0F4C81"}`);
          updated = setCssProperty(updated, "padding", "0 0 0.35em");
        } else {
          updated = setCssProperty(updated, "border", "0");
          updated = setCssProperty(updated, "padding", "0");
        }
        return updated;
      },
    );
  }

  result = rewriteInlineStyle(
    result,
    /(<blockquote\b[^>]*style=")([^"]*)("[^>]*>)/gi,
    (css) => {
      if (style.blockquoteStyle === "plain") {
        return setCssProperty(setCssProperty(css, "background", "transparent"), "border", "0");
      }
      let updated = setCssProperty(css, "border-left", `4px solid ${style.color ?? "#0F4C81"}`);
      if (style.blockquoteStyle === "border") {
        updated = setCssProperty(updated, "background", "transparent");
      } else {
        updated = setCssProperty(updated, "background", "#f6f8fa");
      }
      return updated;
    },
  );

  return result;
}

export async function convertMarkdown(
  markdownPath: string,
  options: WechatRenderStyleOverrides & { title?: string; citeStatus?: boolean } = {},
): Promise<ParsedResult> {
  const baseDir = path.dirname(markdownPath);
  const content = fs.readFileSync(markdownPath, "utf-8");
  const citeStatus = options.citeStatus ?? true;
  const style = resolveRenderStyle(loadWechatExtendConfig(), options);

  const { frontmatter, body } = parseFrontmatter(content);

  let title = stripWrappingQuotes(options.title ?? "")
    || stripWrappingQuotes(frontmatter.title ?? "")
    || extractTitleFromMarkdown(body);
  if (!title) {
    title = path.basename(markdownPath, path.extname(markdownPath));
  }

  const author = stripWrappingQuotes(frontmatter.author ?? "");
  const frontmatterSummary = stripWrappingQuotes(frontmatter.description ?? "")
    || stripWrappingQuotes(frontmatter.summary ?? "");
  let summary = cleanSummaryText(frontmatterSummary);
  if (!summary) {
    summary = extractSummaryFromBody(body, 120);
  }

  const { markdown: mermaidProcessedBody, images: mermaidImages } =
    await preprocessMermaidInMarkdown(body, {
      baseDir,
      renderFn: renderMermaidToPng,
      onError: (error, block) => {
        const message = error instanceof Error ? error.message : String(error);
        console.error(
          `[md-to-wechat] mermaid render failed (${block.code.slice(0, 40).replace(/\s+/g, " ")}…): ${message}`,
        );
      },
    });

  if (mermaidImages.length > 0) {
    const fresh = mermaidImages.filter((image) => !image.cached).length;
    console.error(
      `[md-to-wechat] mermaid: ${mermaidImages.length} block(s), ${fresh} rendered, ${mermaidImages.length - fresh} cached`,
    );
  }

  const scrollComponents = preprocessWechatScrollComponents(
    mermaidProcessedBody,
    resolveColorToken(style.color),
  );
  const { images, markdown: rewrittenBody } = replaceMarkdownImagesWithPlaceholders(
    scrollComponents.markdown,
    "WECHATIMGPH_",
  );
  const rewrittenMarkdown = `${serializeFrontmatter(frontmatter)}${rewrittenBody}`;

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "wechat-article-images-"));
  const htmlPath = path.join(tempDir, "temp-article.html");

  console.error(
    `[md-to-wechat] Rendering markdown with style: ${style.profile}, theme: ${style.theme}${style.color ? `, color: ${style.color}` : ""}, citeStatus: ${citeStatus}`,
  );

  const { html } = await renderMarkdownDocument(rewrittenMarkdown, {
    citeStatus,
    defaultTitle: title,
    keepTitle: false,
    primaryColor: resolveColorToken(style.color),
    theme: style.theme as Parameters<typeof renderMarkdownDocument>[1]["theme"],
    fontFamily: style.fontFamily,
    fontSize: style.fontSize,
    codeTheme: style.codeTheme,
    isMacCodeBlock: style.macCodeBlock,
    isShowLineNumber: style.showLineNumber,
  });
  fs.writeFileSync(htmlPath, applyWechatRenderStyle(html, style), "utf-8");

  const contentImages = await resolveContentImages(
    [...images, ...scrollComponents.images],
    baseDir,
    tempDir,
    "md-to-wechat",
  );

  return {
    title,
    author,
    summary,
    htmlPath,
    contentImages,
    style,
  };
}

function printUsage(): never {
  console.log(`Convert Markdown to WeChat-ready HTML with image placeholders

Usage:
  npx -y bun md-to-wechat.ts <markdown_file> [options]

Options:
  --title <title>     Override title
  --theme <name>      Theme name (default, grace, simple, modern)
  --color <name|hex>  Primary color (blue, green, vermilion, etc. or hex)
  --style-profile <p> Style profile: personal (default) or classic
  --font-family <css> Font-family override
  --font-size <css>   Base font size (for example 16px)
  --line-height <css> Body line height (for example 1.75)
  --paragraph-spacing <css> Paragraph margin (for example "1.5em 8px")
  --heading-style <p> filled, underline, or minimal
  --blockquote-style <p> soft, border, or plain
  --code-theme <name> Highlight.js code theme
  --no-mac-code-block Disable the Mac-style code block header
  --show-line-number  Show code block line numbers
  --no-cite           Disable bottom citations for ordinary external links
  --help              Show this help

Output JSON format:
{
  "title": "Article Title",
  "htmlPath": "/tmp/wechat-article-images/temp-article.html",
  "contentImages": [
    {
      "placeholder": "WECHATIMGPH_1",
      "localPath": "/tmp/wechat-image/img.png",
      "originalPath": "imgs/image.png"
    }
  ]
}

Example:
  npx -y bun md-to-wechat.ts article.md
  npx -y bun md-to-wechat.ts article.md --theme grace
  npx -y bun md-to-wechat.ts article.md --theme modern --color blue
  npx -y bun md-to-wechat.ts article.md --no-cite
`);
  process.exit(0);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    printUsage();
  }

  let markdownPath: string | undefined;
  let title: string | undefined;
  let theme: string | undefined;
  let color: string | undefined;
  let styleProfile: WechatRenderStyleOverrides["profile"];
  let fontFamily: string | undefined;
  let fontSize: string | undefined;
  let lineHeight: string | undefined;
  let paragraphSpacing: string | undefined;
  let headingStyle: WechatRenderStyleOverrides["headingStyle"];
  let blockquoteStyle: WechatRenderStyleOverrides["blockquoteStyle"];
  let codeTheme: string | undefined;
  let macCodeBlock: boolean | undefined;
  let showLineNumber: boolean | undefined;
  let citeStatus = true;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    if (arg === "--title" && args[i + 1]) {
      title = args[++i];
    } else if (arg === "--theme" && args[i + 1]) {
      theme = args[++i];
    } else if (arg === "--color" && args[i + 1]) {
      color = args[++i];
    } else if (arg === "--style-profile" && args[i + 1]) {
      styleProfile = args[++i] as WechatRenderStyleOverrides["profile"];
    } else if (arg === "--font-family" && args[i + 1]) {
      fontFamily = args[++i];
    } else if (arg === "--font-size" && args[i + 1]) {
      fontSize = args[++i];
    } else if (arg === "--line-height" && args[i + 1]) {
      lineHeight = args[++i];
    } else if (arg === "--paragraph-spacing" && args[i + 1]) {
      paragraphSpacing = args[++i];
    } else if (arg === "--heading-style" && args[i + 1]) {
      headingStyle = args[++i] as WechatRenderStyleOverrides["headingStyle"];
    } else if (arg === "--blockquote-style" && args[i + 1]) {
      blockquoteStyle = args[++i] as WechatRenderStyleOverrides["blockquoteStyle"];
    } else if (arg === "--code-theme" && args[i + 1]) {
      codeTheme = args[++i];
    } else if (arg === "--no-mac-code-block") {
      macCodeBlock = false;
    } else if (arg === "--show-line-number") {
      showLineNumber = true;
    } else if (arg === "--cite") {
      citeStatus = true;
    } else if (arg === "--no-cite") {
      citeStatus = false;
    } else if (!arg.startsWith("-")) {
      markdownPath = arg;
    }
  }

  if (!markdownPath) {
    console.error("Error: Markdown file path is required");
    process.exit(1);
  }

  if (!fs.existsSync(markdownPath)) {
    console.error(`Error: File not found: ${markdownPath}`);
    process.exit(1);
  }

  const result = await convertMarkdown(markdownPath, {
    title,
    theme,
    color,
    citeStatus,
    profile: styleProfile,
    fontFamily,
    fontSize,
    lineHeight,
    paragraphSpacing,
    headingStyle,
    blockquoteStyle,
    codeTheme,
    macCodeBlock,
    showLineNumber,
  });
  console.log(JSON.stringify(result, null, 2));
}

if (import.meta.main) {
  try {
    await main();
  } catch (error) {
    console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  } finally {
    await closeRenderer();
  }
}
