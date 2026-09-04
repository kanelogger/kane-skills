import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

import { closeRenderer } from "baoyu-chrome-cdp/mermaid";

import { convertMarkdown } from "./md-to-wechat.ts";
import {
  loadWechatExtendConfig,
  resolveAccount,
  resolveRenderStyle,
  type WechatRenderStyleOverrides,
} from "./wechat-extend-config.ts";

const WECHAT_URL = "https://mp.weixin.qq.com/";
const RESULT_PREFIX = "WECHAT_EGO_RESULT:";

type PublishMode = "article" | "image-text";

interface CliArgs extends WechatRenderStyleOverrides {
  mode: PublishMode;
  markdown?: string;
  html?: string;
  title?: string;
  author?: string;
  summary?: string;
  content?: string;
  images: string[];
  imagesDir?: string;
  account?: string;
  citeStatus: boolean;
  submit: boolean;
  resume: boolean;
  dryRun: boolean;
  taskSpace: string;
}

interface BrowserPayload {
  mode: PublishMode;
  title: string;
  author: string;
  summary: string;
  content: string;
  html: string;
  images: Array<{ placeholder?: string; path: string }>;
  submit: boolean;
  resume: boolean;
  taskSpace: string;
}

interface EgoResult {
  status: "login-required" | "preview-ready" | "saved";
  taskSpaceId: string | number;
  appmsgid?: string;
  title?: string;
  imageCount?: number;
}

function printUsage(exitCode = 0): never {
  console.log(`Publish WeChat content through ego-browser

Usage:
  bun wechat-ego-browser.ts --markdown article.md [options]
  bun wechat-ego-browser.ts --html article.html [options]
  bun wechat-ego-browser.ts --mode image-text --title 标题 --content 正文 --image image.png [options]

Options:
  --mode <article|image-text>  Publishing mode (default: article)
  --markdown <path>           Markdown source
  --html <path>               Pre-rendered HTML source (article only)
  --title <text>              Override title
  --author <text>             Override author
  --summary <text>            Override summary
  --content <text>            Plain content (image-text mode)
  --image <path>              Image path; repeatable
  --images <dir>              Add all supported images from a directory
  --submit                    Save as draft; default leaves a verified preview open
  --resume                    Resume after completing login in the handed-off task space
  --task-space <name|id>      ego-browser task space (default: wechat-publish)
  --dry-run                   Prepare content only; do not open ego-browser
  --theme <name>              default, grace, simple, or modern
  --color <name|hex>          Primary color
  --style-profile <profile>   personal (default) or classic
  --font-family <css>         Font-family override
  --font-size <css>           Base font size
  --line-height <css>         Body line height
  --paragraph-spacing <css>   Paragraph margin
  --heading-style <style>     filled, underline, or minimal
  --blockquote-style <style>  soft, border, or plain
  --code-theme <name>         Highlight.js code theme
  --no-mac-code-block         Disable Mac-style code block header
  --show-line-number          Show code block line numbers
  --no-cite                   Keep ordinary external links inline
`);
  process.exit(exitCode);
}

function takeValue(argv: string[], index: number, option: string): string {
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`Missing value for ${option}`);
  return value;
}

function parseArgs(argv: string[]): CliArgs {
  if (argv.length === 0 || argv.includes("--help") || argv.includes("-h")) printUsage();

  const parsed: CliArgs = {
    mode: "article",
    images: [],
    citeStatus: true,
    submit: false,
    resume: false,
    dryRun: false,
    taskSpace: "wechat-publish",
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === "--mode") parsed.mode = takeValue(argv, i++, arg) as PublishMode;
    else if (arg === "--markdown") parsed.markdown = takeValue(argv, i++, arg);
    else if (arg === "--html") parsed.html = takeValue(argv, i++, arg);
    else if (arg === "--title") parsed.title = takeValue(argv, i++, arg);
    else if (arg === "--author") parsed.author = takeValue(argv, i++, arg);
    else if (arg === "--summary") parsed.summary = takeValue(argv, i++, arg);
    else if (arg === "--content") parsed.content = takeValue(argv, i++, arg);
    else if (arg === "--image") parsed.images.push(takeValue(argv, i++, arg));
    else if (arg === "--images") parsed.imagesDir = takeValue(argv, i++, arg);
    else if (arg === "--account") parsed.account = takeValue(argv, i++, arg);
    else if (arg === "--task-space") parsed.taskSpace = takeValue(argv, i++, arg);
    else if (arg === "--theme") parsed.theme = takeValue(argv, i++, arg);
    else if (arg === "--color") parsed.color = takeValue(argv, i++, arg);
    else if (arg === "--style-profile") parsed.profile = takeValue(argv, i++, arg) as CliArgs["profile"];
    else if (arg === "--font-family") parsed.fontFamily = takeValue(argv, i++, arg);
    else if (arg === "--font-size") parsed.fontSize = takeValue(argv, i++, arg);
    else if (arg === "--line-height") parsed.lineHeight = takeValue(argv, i++, arg);
    else if (arg === "--paragraph-spacing") parsed.paragraphSpacing = takeValue(argv, i++, arg);
    else if (arg === "--heading-style") parsed.headingStyle = takeValue(argv, i++, arg) as CliArgs["headingStyle"];
    else if (arg === "--blockquote-style") parsed.blockquoteStyle = takeValue(argv, i++, arg) as CliArgs["blockquoteStyle"];
    else if (arg === "--code-theme") parsed.codeTheme = takeValue(argv, i++, arg);
    else if (arg === "--submit") parsed.submit = true;
    else if (arg === "--resume") parsed.resume = true;
    else if (arg === "--dry-run") parsed.dryRun = true;
    else if (arg === "--cite") parsed.citeStatus = true;
    else if (arg === "--no-cite") parsed.citeStatus = false;
    else if (arg === "--no-mac-code-block") parsed.macCodeBlock = false;
    else if (arg === "--show-line-number") parsed.showLineNumber = true;
    else throw new Error(`Unknown option: ${arg}`);
  }

  if (parsed.mode !== "article" && parsed.mode !== "image-text") {
    throw new Error(`Invalid --mode: ${parsed.mode}`);
  }
  return parsed;
}

function absoluteExistingPath(input: string, label: string): string {
  const resolved = path.resolve(input);
  if (!fs.existsSync(resolved)) throw new Error(`${label} not found: ${resolved}`);
  return resolved;
}

function collectImages(args: CliArgs): string[] {
  const images = args.images.map((item) => absoluteExistingPath(item, "Image"));
  if (args.imagesDir) {
    const directory = absoluteExistingPath(args.imagesDir, "Images directory");
    const entries = fs.readdirSync(directory)
      .filter((name) => /\.(png|jpe?g|gif|webp)$/i.test(name))
      .sort()
      .map((name) => path.join(directory, name));
    images.push(...entries);
  }
  if (images.length > 9 && args.mode === "image-text") {
    throw new Error(`Image-text posts support at most 9 images; got ${images.length}`);
  }
  return images;
}

function parseHtmlMeta(html: string): { title: string; author: string; summary: string } {
  const read = (pattern: RegExp) => html.match(pattern)?.[1]?.trim() ?? "";
  return {
    title: read(/<title>([\s\S]*?)<\/title>/i) || read(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i).replace(/<[^>]+>/g, ""),
    author: read(/<meta\s+name=["']author["']\s+content=["']([^"']*)["']/i),
    summary: read(/<meta\s+name=["']description["']\s+content=["']([^"']*)["']/i),
  };
}

function parseImageTextMarkdown(markdown: string): { title: string; content: string } {
  const frontmatter = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  const body = frontmatter ? markdown.slice(frontmatter[0].length) : markdown;
  const title = frontmatter?.[1]?.match(/^title:\s*(.+)$/m)?.[1]?.trim().replace(/^['"]|['"]$/g, "")
    || body.match(/^#\s+(.+)$/m)?.[1]?.trim()
    || "";
  const content = body.split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#") && !line.startsWith("!["))
    .join("\n")
    .slice(0, 1000);
  return { title: title.slice(0, 20), content };
}

async function preparePayload(args: CliArgs): Promise<{ payload: BrowserPayload; style: ReturnType<typeof resolveRenderStyle> }> {
  const config = loadWechatExtendConfig();
  const account = resolveAccount(config, args.account);
  const style = resolveRenderStyle(config, args);
  const extraImages = collectImages(args);

  if (args.mode === "image-text") {
    let title = args.title ?? "";
    let content = args.content ?? "";
    if (args.markdown) {
      const markdownPath = absoluteExistingPath(args.markdown, "Markdown file");
      const parsed = parseImageTextMarkdown(fs.readFileSync(markdownPath, "utf8"));
      title ||= parsed.title;
      content ||= parsed.content;
    }
    title = title.slice(0, 20);
    content = content.slice(0, 1000);
    if (!title) throw new Error("Image-text title is required");
    if (!content) throw new Error("Image-text content is required");
    if (extraImages.length === 0) throw new Error("Image-text mode requires at least one image");

    return {
      style,
      payload: {
        mode: args.mode,
        title,
        author: args.author ?? account.default_author ?? "",
        summary: args.summary ?? "",
        content,
        html: "",
        images: extraImages.map((imagePath) => ({ path: imagePath })),
        submit: args.submit,
        resume: args.resume,
        taskSpace: args.taskSpace,
      },
    };
  }

  let title = args.title ?? "";
  let author = args.author ?? account.default_author ?? "";
  let summary = args.summary ?? "";
  let html = "";
  let contentImages: Array<{ placeholder?: string; path: string }> = [];

  if (args.markdown) {
    const markdownPath = absoluteExistingPath(args.markdown, "Markdown file");
    const converted = await convertMarkdown(markdownPath, {
      ...style,
      title: args.title,
      citeStatus: args.citeStatus,
    });
    title ||= converted.title;
    author ||= converted.author;
    summary ||= converted.summary;
    html = fs.readFileSync(converted.htmlPath, "utf8");
    contentImages = converted.contentImages.map((image) => ({
      placeholder: image.placeholder,
      path: image.localPath,
    }));
  } else if (args.html) {
    const htmlPath = absoluteExistingPath(args.html, "HTML file");
    html = fs.readFileSync(htmlPath, "utf8");
    const meta = parseHtmlMeta(html);
    title ||= meta.title;
    author ||= meta.author;
    summary ||= meta.summary;
  } else {
    throw new Error("Article mode requires --markdown or --html");
  }

  if (!title) throw new Error("Article title is required");
  if (title.length > 64) throw new Error(`Article title is too long: ${title.length} (max 64)`);
  contentImages.push(...extraImages.map((imagePath) => ({ path: imagePath })));

  return {
    style,
    payload: {
      mode: args.mode,
      title,
      author,
      summary,
      content: args.content ?? "",
      html,
      images: contentImages,
      submit: args.submit,
      resume: args.resume,
      taskSpace: args.taskSpace,
    },
  };
}

function buildBrowserScript(payload: BrowserPayload): string {
  return `
const payload = ${JSON.stringify(payload)};
const RESULT_PREFIX = ${JSON.stringify(RESULT_PREFIX)};
const WECHAT_URL = ${JSON.stringify(WECHAT_URL)};

async function emit(result) {
  cliLog(RESULT_PREFIX + JSON.stringify(result));
}

async function chooseEditorTab() {
  await wait(2);
  const tabs = await listTabs();
  const candidates = tabs.filter((tab) => String(tab.url || '').includes('mp.weixin.qq.com'));
  const editor = candidates.find((tab) => /appmsg|operate_appmsg|newspic/.test(String(tab.url || '')))
    || candidates[candidates.length - 1];
  if (!editor) throw new Error('WeChat editor tab was not found');
  await switchTab(editor.targetId || editor.id);
  return editor;
}

async function openEditor(menuNames) {
  const target = await js(String.raw\`(() => {
    const names = \${JSON.stringify(menuNames)};
    const items = [...document.querySelectorAll('.new-creation__menu .new-creation__menu-item')];
    const item = items.find((candidate) => {
      const text = candidate.querySelector('.new-creation__menu-title')?.textContent?.trim()
        || candidate.textContent?.trim()
        || '';
      return names.includes(text);
    });
    if (!item) return { ok: false, available: items.map((candidate) => candidate.textContent?.trim() || '') };
    item.scrollIntoView({ block: 'center' });
    const rect = item.getBoundingClientRect();
    return { ok: true, x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  })()\`);
  if (!target?.ok) throw new Error('WeChat creation menu was not found: ' + JSON.stringify(target));
  await click([target.x, target.y], { label: 'open WeChat editor' });
  await chooseEditorTab();
}

async function setInput(selector, value) {
  if (!value) return;
  const result = await js(String.raw\`(() => {
    const selector = \${JSON.stringify(selector)};
    const value = \${JSON.stringify(value)};
    const element = document.querySelector(selector);
    if (!element) return { ok: false };
    element.focus();
    element.value = value;
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
    element.dispatchEvent(new Event('blur', { bubbles: true }));
    return { ok: element.value === value };
  })()\`);
  if (!result?.ok) throw new Error('Failed to fill ' + selector);
}

async function saveDraft() {
  const clicked = await js(String.raw\`(() => {
    const button = document.querySelector('#js_submit button')
      || [...document.querySelectorAll('button')].find((candidate) => /保存为草稿|保存草稿/.test(candidate.textContent || ''));
    if (!button) return false;
    button.click();
    return true;
  })()\`);
  if (!clicked) throw new Error('Save draft button was not found');

  for (let attempt = 0; attempt < 60; attempt++) {
    await wait(1);
    const state = await js(String.raw\`(() => {
      const appmsgid = new URL(location.href).searchParams.get('appmsgid') || '';
      const messages = [...document.querySelectorAll('.weui-desktop-toast, .weui-desktop-toptips, .js_tips')]
        .map((node) => (node.textContent || '').trim()).filter(Boolean);
      const loading = !!document.querySelector('#js_submit.btn_loading, #js_submit button:disabled');
      return { appmsgid, messages, loading };
    })()\`);
    const failure = state.messages?.find((message) => /保存.*失败|草稿.*失败|save.*fail/i.test(message));
    if (failure) throw new Error('Draft save failed: ' + failure);
    if (state.appmsgid && !state.loading) return state.appmsgid;
  }
  throw new Error('Draft save did not complete within 60 seconds');
}

async function uploadArticleImage(image) {
  const before = await js(String.raw\`document.querySelectorAll('.rich_media_content .ProseMirror img').length\`);
  if (image.placeholder) {
    const selected = await js(String.raw\`(() => {
      const placeholder = \${JSON.stringify(image.placeholder)};
      const editor = document.querySelector('.rich_media_content .ProseMirror');
      if (!editor) return false;
      const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
      let node;
      while ((node = walker.nextNode())) {
        const index = node.nodeValue.indexOf(placeholder);
        if (index < 0) continue;
        const range = document.createRange();
        range.setStart(node, index);
        range.setEnd(node, index + placeholder.length);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
        document.execCommand('delete');
        editor.focus();
        return true;
      }
      return false;
    })()\`);
    if (!selected) throw new Error('Image placeholder was not found: ' + image.placeholder);
  }
  await uploadFile('input[type="file"][accept*="image"]', image.path);
  for (let attempt = 0; attempt < 45; attempt++) {
    await wait(1);
    const count = await js(String.raw\`document.querySelectorAll('.rich_media_content .ProseMirror img').length\`);
    if (count > before) return;
  }
  throw new Error('Image did not appear in article editor: ' + image.path);
}

async function composeArticle() {
  await openEditor(['文章']);
  await waitForElement('#title', { timeout: 30 });
  await setInput('#title', payload.title);
  await setInput('#author', payload.author);

  const inserted = await js(String.raw\`(() => {
    const html = \${JSON.stringify(payload.html)};
    const template = document.createElement('template');
    template.innerHTML = html;
    const output = template.content.querySelector('#output');
    const editor = document.querySelector('.rich_media_content .ProseMirror');
    if (!editor) return { ok: false, reason: 'body-editor-missing' };
    editor.focus();
    const range = document.createRange();
    range.selectNodeContents(editor);
    range.deleteContents();
    range.collapse(true);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    document.execCommand('insertHTML', false, output ? output.innerHTML : template.innerHTML);
    editor.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertHTML' }));
    return { ok: (editor.textContent || '').trim().length > 0 };
  })()\`);
  if (!inserted?.ok) throw new Error('Failed to insert article HTML: ' + JSON.stringify(inserted));

  for (const image of payload.images) await uploadArticleImage(image);
  await setInput('#js_description', payload.summary);

  const verified = await js(String.raw\`(() => {
    const title = document.querySelector('#title')?.value || '';
    const body = document.querySelector('.rich_media_content .ProseMirror')?.textContent?.trim() || '';
    return { ok: title === \${JSON.stringify(payload.title)} && body.length > 0, title, bodyLength: body.length };
  })()\`);
  if (!verified?.ok) throw new Error('Article verification failed: ' + JSON.stringify(verified));
}

async function composeImageText() {
  await openEditor(['贴图', '图文']);
  await waitForElement('#title', { timeout: 30 });
  const documentNode = await cdp('DOM.getDocument', { depth: -1, pierce: true });
  const inputNode = await cdp('DOM.querySelector', {
    nodeId: documentNode.root.nodeId,
    selector: 'input[type="file"][accept*="image"]'
  });
  if (!inputNode.nodeId) throw new Error('Image upload input was not found');
  await cdp('DOM.setFileInputFiles', {
    nodeId: inputNode.nodeId,
    files: payload.images.map((image) => image.path)
  });
  let uploaded = false;
  for (let attempt = 0; attempt < 45; attempt++) {
    await wait(1);
    const count = await js(String.raw\`document.querySelectorAll('.weui-desktop-upload__thumb, .pic_item, [class*="upload__thumb"]').length\`);
    if (count >= payload.images.length) {
      uploaded = true;
      break;
    }
  }
  if (!uploaded) throw new Error('Image-text uploads did not complete');
  await setInput('#title', payload.title);
  const inserted = await js(String.raw\`(() => {
    const editor = document.querySelector('.ProseMirror[contenteditable="true"], .js_pmEditorArea');
    if (!editor) return false;
    editor.focus();
    editor.innerHTML = '<p>' + payload.content.split('\\n').filter(Boolean).join('</p><p>') + '</p>';
    editor.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText' }));
    return (editor.textContent || '').trim().length > 0;
  })()\`);
  if (!inserted) throw new Error('Image-text editor could not be filled');
}

const task = payload.resume
  ? await takeOverTaskSpace(payload.taskSpace)
  : await useOrCreateTaskSpace(payload.taskSpace);
await openOrReuseTab(WECHAT_URL, { wait: true, timeout: 30 });
const info = await pageInfo();

if (!String(info.url || '').includes('/cgi-bin/')) {
  const handoff = await handOffTaskSpace(task.id);
  if (!handoff?.done) throw new Error('Could not hand the login task space to the user: ' + JSON.stringify(handoff));
  await emit({ status: 'login-required', taskSpaceId: task.id });
} else {
  if (payload.mode === 'article') await composeArticle();
  else await composeImageText();

  if (payload.submit) {
    const appmsgid = await saveDraft();
    await emit({ status: 'saved', taskSpaceId: task.id, appmsgid, title: payload.title, imageCount: payload.images.length });
  } else {
    await captureScreenshot();
    await emit({ status: 'preview-ready', taskSpaceId: task.id, title: payload.title, imageCount: payload.images.length });
  }
}
`;
}

function runEgoBrowser(script: string): string {
  const result = spawnSync("ego-browser", ["nodejs"], {
    input: script,
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
    maxBuffer: 16 * 1024 * 1024,
  });
  if (result.error) throw new Error(`Failed to start ego-browser: ${result.error.message}`);
  if (result.status !== 0) {
    throw new Error(`ego-browser failed (${result.status}): ${(result.stderr || result.stdout).trim()}`);
  }
  return `${result.stdout}\n${result.stderr}`;
}

function parseEgoResult(output: string): EgoResult {
  const line = output.split("\n").findLast((entry) => entry.includes(RESULT_PREFIX));
  if (!line) throw new Error(`ego-browser returned no result marker:\n${output.trim()}`);
  return JSON.parse(line.slice(line.indexOf(RESULT_PREFIX) + RESULT_PREFIX.length)) as EgoResult;
}

function completeTaskSpace(taskSpaceId: string | number, keep: boolean): void {
  const script = `
const task = await useOrCreateTaskSpace(${JSON.stringify(taskSpaceId)});
const result = await completeTaskSpace(task.id, { keep: ${keep} });
cliLog(${JSON.stringify(RESULT_PREFIX)} + JSON.stringify(result));
`;
  const result = parseEgoResult(runEgoBrowser(script)) as unknown as { done?: boolean; skipped?: string };
  if (!result.done) {
    throw new Error(`Could not complete ego-browser task space: ${JSON.stringify(result)}`);
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  try {
    const { payload, style } = await preparePayload(args);
    if (args.dryRun) {
      console.log(JSON.stringify({
        success: true,
        dryRun: true,
        mode: payload.mode,
        title: payload.title,
        author: payload.author || undefined,
        summary: payload.summary || undefined,
        imageCount: payload.images.length,
        submit: payload.submit,
        taskSpace: payload.taskSpace,
        style,
      }, null, 2));
      return;
    }

    const result = parseEgoResult(runEgoBrowser(buildBrowserScript(payload)));
    if (result.status === "login-required") {
      console.log(JSON.stringify({
        ...result,
        next: `Complete WeChat login in ego-browser, then rerun with --resume --task-space ${result.taskSpaceId}`,
      }, null, 2));
      return;
    }

    completeTaskSpace(result.taskSpaceId, result.status === "preview-ready");
    console.log(JSON.stringify({ success: true, method: "ego-browser", ...result, style }, null, 2));
  } finally {
    await closeRenderer();
  }
}

if (import.meta.main) {
  await main().catch((error) => {
    console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  });
}
