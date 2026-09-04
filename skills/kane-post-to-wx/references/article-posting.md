# Article Posting (文章发表)

Post markdown articles to WeChat Official Account with full formatting support.

## Usage

```bash
# Post markdown article
${BUN_X} ./scripts/wechat-ego-browser.ts --markdown article.md

# With theme
${BUN_X} ./scripts/wechat-ego-browser.ts --markdown article.md --theme grace

# Disable bottom citations for ordinary external links
${BUN_X} ./scripts/wechat-ego-browser.ts --markdown article.md --no-cite

# With explicit options
${BUN_X} ./scripts/wechat-ego-browser.ts --markdown article.md --author "作者名" --summary "摘要"
```

## Parameters

| Parameter | Description |
|-----------|-------------|
| `--markdown <path>` | Markdown file to convert and post |
| `--theme <name>` | Theme: default, grace, simple, modern |
| `--no-cite` | Keep ordinary external links inline instead of converting them to bottom citations |
| `--title <text>` | Override title (auto-extracted from markdown) |
| `--author <name>` | Author name |
| `--summary <text>` | Article summary |
| `--html <path>` | Pre-rendered HTML file (alternative to markdown) |
| `--style-profile <name>` | Style profile: `personal` (default) or `classic` |
| `--font-family <css>` | Font-family override |
| `--font-size <css>` | Base font size |
| `--line-height <css>` | Body line height |
| `--paragraph-spacing <css>` | Paragraph margin |
| `--heading-style <name>` | `filled`, `underline`, or `minimal` |
| `--blockquote-style <name>` | `soft`, `border`, or `plain` |
| `--code-theme <name>` | Code highlight theme |
| `--submit` | Save as draft; omitted means verified preview |
| `--resume` | Resume an ego-browser task space after confirmed login |

## Markdown Format

```markdown
---
title: Article Title
author: Author Name
---

# Title (becomes article title)

Regular paragraph with **bold** and *italic*.

## Section Header

![Image description](./image.png)

- List item 1
- List item 2

> Blockquote text

[Link text](https://example.com)
```

Markdown mode converts ordinary external links into bottom citations by default for WeChat-friendly output. Use `--no-cite` to disable that behavior.

## Scrollable Prompt and Long Image

Use a `prompt-scroll` fenced block for a complete prompt that should stay on long lines and swipe horizontally:

````markdown
```prompt-scroll
You are a senior engineer. Read the current contracts and tests before changing code.
Return the implementation, verification evidence, and any remaining risk in one response.
```
````

It renders a blue outlined “← 滑动查看完整提示词 →” hint above a light, rounded code viewport. `prompt` is accepted as a shorter alias.

Start an image alt with `长图` or `Long image` to present it in a wide horizontal viewport:

```markdown
![长图：完整工作流](./images/full-workflow.png)
![Long image: architecture](./images/architecture.png)
```

It renders “← 滑动查看长图 →” above a rounded viewport whose content is 180% wide with a 720px minimum. Ordinary fenced code and ordinary images keep their existing style.

## Image Handling

1. **Parse**: Ordinary images are replaced with `WECHATIMGPH_N`; scrollable long images use `WECHATSCROLLIMGPH_N`
2. **Render**: HTML is generated with placeholders in text
3. **Paste**: HTML content is pasted into WeChat editor
4. **Replace**: For each placeholder:
   - Find and select the placeholder text
   - Delete the placeholder
   - Upload the image through the editor's file input
   - Verify that the body image count increased

## Scripts

| Script | Purpose |
|--------|---------|
| `wechat-ego-browser.ts` | Default ego-browser article publisher |
| `wechat-article.ts` | Legacy Chrome CDP article publisher |
| `md-to-wechat.ts` | Markdown to HTML with placeholders |

## Example Session

```
User: /post-to-wechat --markdown ./article.md

Claude:
1. Parses markdown, finds 5 images
2. Generates HTML with placeholders
3. Opens an isolated ego-browser task space and navigates to WeChat editor
4. Pastes HTML content
5. For each image:
   - Selects WECHATIMGPH_1
   - Deletes the placeholder
   - Uploads and verifies the image
6. Reports: "Article composed with 5 images."
```
