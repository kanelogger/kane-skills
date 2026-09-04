# ego-browser Publishing

`wechat-ego-browser.ts` is the default browser publishing path. It uses an isolated ego-browser task space, reuses the user's login state, and keeps the API and Markdown rendering paths independent from browser automation.

## Article

Prepare a verified preview:

```bash
${BUN_X} {baseDir}/scripts/wechat-ego-browser.ts --markdown article.md
```

Save as a draft only when explicitly requested:

```bash
${BUN_X} {baseDir}/scripts/wechat-ego-browser.ts --markdown article.md --submit
```

HTML input is also supported:

```bash
${BUN_X} {baseDir}/scripts/wechat-ego-browser.ts --html article.html
```

## Image-Text

```bash
${BUN_X} {baseDir}/scripts/wechat-ego-browser.ts --mode image-text --markdown post.md --images ./images
${BUN_X} {baseDir}/scripts/wechat-ego-browser.ts --mode image-text --title "标题" --content "正文" --image image.png --submit
```

Image-text posts require 1–9 images. The script rejects larger sets before opening the browser.

## Login Handoff

The first unauthenticated run returns JSON like:

```json
{
  "status": "login-required",
  "taskSpaceId": 123,
  "next": "Complete WeChat login in ego-browser, then rerun with --resume --task-space 123"
}
```

At that point:

1. Ask the user to complete WeChat QR login in the handed-off task space.
2. Wait for explicit confirmation from the user.
3. Resume with the exact task-space id:

```bash
${BUN_X} {baseDir}/scripts/wechat-ego-browser.ts --markdown article.md --resume --task-space 123
```

Never take control back before the user confirms login is complete.

## Verification and Task-Space Lifecycle

- Article mode verifies the title and non-empty body before it can save.
- Inline images must appear in the body after upload; missing placeholders or failed uploads stop the run.
- `--submit` waits for a saved `appmsgid`; absence or a failure toast stops the run.
- Preview mode keeps the completed task space visible for manual review.
- Successful draft mode closes the completed task space.

## Personal Style

The `personal` profile is the default. It starts from the built-in `default` theme and can be adjusted in EXTEND.md:

```md
style_profile: personal
default_theme: default
default_color: blue
style_font_family: -apple-system-font, BlinkMacSystemFont, Helvetica Neue, PingFang SC, Microsoft YaHei, sans-serif
style_font_size: 16px
style_line_height: 1.75
style_paragraph_spacing: 1.5em 8px
style_heading: filled
style_blockquote: soft
style_code_theme: github
style_mac_code_block: 1
style_show_line_number: 0
```

Supported presets:

- `style_heading`: `filled`, `underline`, `minimal`
- `style_blockquote`: `soft`, `border`, `plain`
- `style_profile`: `personal`, `classic`

CLI values override EXTEND.md. Run preparation without opening the browser using `--dry-run`.

## Legacy Rollback

If a WeChat UI change temporarily breaks ego-browser selectors, the previous CDP implementations remain available:

```bash
${BUN_X} {baseDir}/scripts/wechat-article.ts --markdown article.md
${BUN_X} {baseDir}/scripts/wechat-browser.ts --markdown post.md --images ./images
```

