# kane-url-to-markdown

通过现成工具获取网页正文并保存为 Markdown：公开页优先用运行时的网页读取工具；动态页或登录页复用已有浏览器。技能不再自带 HTTP 下载器，不摘要、不翻译。

在 Codex 中输入 `$kane-url-to-markdown` 显式调用。

## 使用

```text
用 kane-url-to-markdown 把 https://example.com/article 保存为 Markdown。
把这个需要登录的网页转成 md，使用我已登录的浏览器，保存到 notes/article.md。
```

Agent 负责调用工具并检查完整性，包内脚本负责保存及必要的 HTML 转换。整个目录可独立复制，不依赖本仓库其他技能。

## 脚本接口

需要 Bun，也可使用 `npx -y bun`。输入必须明确选择一种，不能只给 URL：

```bash
bun '<skill-dir>/scripts/main.ts' 'https://example.com/article' --markdown './tool-result.md' --output './article.md'
bun '<skill-dir>/scripts/main.ts' 'https://example.com/最终地址' --ego-space 12 --output './article.md'
bun '<skill-dir>/scripts/main.ts' 'https://example.com/最终地址' --bsk-session '<session-id>' --output './article.md'
bun '<skill-dir>/scripts/main.ts' 'https://example.com/最终地址' --html './page.html' --output './article.md'
```

每个示例单独执行。`--markdown` 保存工具已返回的完整 Markdown，不重新转换，无需安装第三方包。可选 frontmatter 使用 `title`、`author`、`published`、`site`、`language`、最终 `url` 字段；标题也可取正文开头的一级标题。

其他三种输入使用包内 Defuddle、JSDOM、DOMPurify，首次运行前单独安装锁定依赖：

```bash
bun install --frozen-lockfile --cwd '<skill-dir>/scripts'
```

浏览器会话由 Agent 按工具规则建立并打开目标页，脚本仅读取，不创建、导航、登录或关闭会话。`--html` 用于其他工具取得的正文 HTML。详见 [技能流程](SKILL.md) 和 [浏览器获取](references/browser-capture.md)。

## 输出与限制

- 默认输出 `url-to-markdown/<最终域名>/<页面名>.md`；`--output` 可指定新文件，已有文件拒绝覆盖。stdout 是输出路径、最终 URL、标题、字符数、捕获方式及警告的 JSON。
- 文件包含来源元数据和正文。`capture` 标记 `tool-markdown`、`ego-browser`、`browser-skill` 或 `browser-html`；标题缺失时用域名并警告，不编造作者和日期。
- 只处理无凭据、无自定义端口的 HTTPS URL。文件输入须为 UTF-8，文件和浏览器 HTML 上限 10 MiB。HTML 转换不执行页面脚本、不加载外部资源、不做远程补取。
- 工具返回摘要、截断内容、登录墙或验证码时不算成功，必须核对正文范围及开头 / 中段 / 结尾。Markdown 的代码、列表、表格、缩进和图片说明保持原样，相对链接按最终 URL 补全。
- 不导出浏览器凭据，不绕过登录权限或验证码。图片仅保留远程链接，不下载媒体；不处理 PDF、整站爬取或音视频转写。

## 验证

HTML 依赖安装后运行 `bun test '<skill-dir>/scripts/tests'`。测试覆盖正文结构、代码保真、隐藏内容与危险链接、工具 Markdown 保存及旧文件保护；真实站点及浏览器会话仍需实际核验。
