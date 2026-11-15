# kane-post-to-wx

把已有成稿排成微信公众号文章，或用指定图片和配文准备贴图。支持本地预览、保存草稿，以及按用户要求从微信公众平台后台正式发表。

在 Codex 中输入 `$kane-post-to-wx` 显式调用。

## 使用示例

- 「用 `kane-post-to-wx` 给这份 Markdown 做公众号排版预览。」
- 「把这篇文章和封面存到我的公众号草稿箱。」
- 「按 01 到 05 的顺序上传这组图片，配文用这个文件，存成贴图草稿。」

文章接受 UTF-8 的 Markdown、HTML 和纯文本，输出 `body.html`、`preview.html`、`body.txt` 和 `meta.json`。默认写到稿件同级的新目录 `<稿件名>-wechat/`，也可指定父目录已存在的新路径。Markdown 外链默认转成文末引注，正文插图以标记和上传清单交付。样式放在独立 CSS 主题文件中，导出时转换为行内样式。

文章排版依赖 Bun 1.3.8+ 和随包锁定的依赖。从技能目录执行：

```bash
bun install --frozen-lockfile --cwd scripts
bun scripts/main.ts "/path/to/article.md" --cover "/path/to/cover.png"
```

命令只准备本地材料。写入需要能操作公众号后台的现成浏览器工具和用户登录；推荐用 ego-browser。贴图直接通过浏览器上传。当前实现走浏览器，不需要配置 AppSecret、IP 白名单或 SSH 隧道。

文章上传、保存草稿或正式发表前，技能会先让你选择本篇使用的主题，推荐绿色标准版 `irene-green`，等你回答后再进入后台写入。本次请求已经指定主题时直接采用，不重复提问；「用默认主题」也是有效选择。仅本地预览可以直接使用默认主题，贴图不询问正文主题。

## 主题与本地预览

| 主题 | 排版特点 |
| --- | --- |
| `irene-green`（默认） | 以 `#25b449` 为主色的绿色标准版，绿色标题与标签采用白字 |

```bash
bun scripts/main.ts --list-themes
bun scripts/main.ts "/path/to/article.md" -o "/path/to/article-green"
open "/path/to/article-green/preview.html"
```

当前仅内置 `irene-green` 标准版，样式独立位于 `themes/irene-green.css`。本地脚本不指定主题时无需传 `--theme`；这个默认值不替代线上写入前的主题提问。`preview.html` 可直接用浏览器打开，不需要启动服务，显示标题和实际本地图片；远程图片只显示标记，不联网加载。`body.html` 用于富文本粘贴，不含重复的文章主标题，图片仍为上传占位标记。上传清单记录每张图的目标样式，但微信上传不会自动继承这些样式，需要在后台按支持的能力恢复并核对。微信可能调整样式，保存草稿前须核对后台或手机预览。

完整组件样稿仅保留绿色标准版，见 [examples/theme-showcase-green.md](examples/theme-showcase-green.md)，可直接运行：

```bash
bun scripts/main.ts examples/theme-showcase-green.md -o "/path/to/new-preview"
open "/path/to/new-preview/preview.html"
```

[样式来源与扩展说明](references/style-sources.md)区分了原文观察值、最终绿色配色与补齐的组件。

绿色版保留同一组件结构，主色为 `#25b449`；绿色背景的二级标题、四级标题、实色标题标签和行内标签按用户指定采用白字，浅底与无底色元素采用深绿色文字。背景、边框、渐变、图片阴影与代码块同步配色；警告和危险信息保留各自的语义色。绿色样稿见 [examples/theme-showcase-green.md](examples/theme-showcase-green.md)，直接运行即可使用默认标准版，也可显式传入 `--theme irene-green`。

## 修改某个内容块

正文根元素为 `#nice`。可分别配置段落 `p`、各级标题 `h1`–`h6`、引用 `blockquote`、列表 `ul` / `ol` / `li`、代码块 `pre` / `pre code`、行内代码 `p code` / `li code`、表格 `table` / `th` / `td`、链接 `a`、强调 `strong` / `em` 和分隔线 `hr`。例如创建 `custom.css`：

```css
#nice h2 {
  color: #a13c2f;
  font-size: 22px;
}

#nice blockquote {
  border-left: 1px solid #a13c2f;
  background: #fff5f0;
}

#nice .code-block pre {
  padding: 20px;
  background: #252525;
  color: #f5f5f5;
}

#nice .code-block pre code {
  color: #f5f5f5;
}

#nice th {
  background: #f4e2d8;
}
```

代码块的 `pre` 容器与内部 `code` 分别控制背景、间距和文字颜色；覆盖系列主题时使用示例中的完整选择器，避免优先级不足，也避免误改行内代码。

```bash
bun scripts/main.ts "/path/to/article.md" --theme-css "/path/to/custom.css"
```

加载顺序为 `themes/irene-green.css` → 用户自行添加的主题（如有）→ `--theme-css`。按 CSS 优先级合并，相同优先级下后者覆盖前者；不再依赖其他内置主题。`meta.json` 记录主题名和加载的 CSS 文件。常用配置可保存到本技能 `themes/` 内，文件名使用小写字母、数字和连字符，例如 `my-theme.css`，即可通过 `--theme my-theme` 选择。

## 提示块、代码块与组件变体

普通引用使用 `>`。带用途的提示块支持 `[!NOTE]`、`[!TIP]`、`[!IMPORTANT]`、`[!WARNING]`、`[!CAUTION]`、`[!PROMPT]`，可在标记后给出自定义标题：

```markdown
> [!WARNING] 操作前检查
> 覆盖文件前先核对输出位置。
```

围栏代码可用 `prompt`、`md`、`js`、`ts`、`json`、`bash`、`python`、`html`、`css`、`yaml`、`text` 等语言，标准主题会显示提示词或语言标签。当前提供块样式和标签，不做语法高亮。

标准主题还提供以下局部类名，可在 Markdown 内的 HTML 中使用；只保留这些白名单类名和围栏代码的语言类名，不保留任意外部类名：

| 模块 | 可选类名 |
| --- | --- |
| 加粗 | `emphasis-marker`、`emphasis-underline`、`emphasis-neutral` |
| 二至四级标题 | `heading-plain`、`heading-underline`、`heading-band`、`heading-badge` |
| 图片 | `image-plain`、`image-frame`、`image-shadow` |
| 行内块 | `quote-inline-block`，可搭配 `inline-kbd`、`inline-tag`、`inline-muted`；普通行内代码使用反引号即可 |

例如 `<strong class="emphasis-marker">重点</strong>`、`<h3 class="heading-underline">小节</h3>`、`<img class="image-shadow" src="sample-green.png" alt="示意图">`、`<code class="inline-kbd">Cmd+K</code>`。普通反引号代码自动获得 `quote-inline-block` 样式。

主题只支持可转换为行内样式的普通 CSS 规则，可使用 `:nth-child()`、`:last-child` 等结构伪类。为确保预览与粘贴使用同一套样式，不支持 `@import`、媒体查询、字体下载、嵌套规则、伪元素、交互状态、资源 URL 或 CSS 转义。每个 CSS 文件须为 256 KiB 以内的 UTF-8 文件。稿件自身的 CSS 会先被清理，再应用主题。

本功能参考了 [markdown2html](https://github.com/TaleAi/markdown2html) 的「独立主题 CSS → Juice 内联 → 富文本复制」流程，未直接复制其主题；其特定的标题装饰、公式、代码行号等 DOM 结构未实现，第三方主题需按本技能实际结构调整。

渲染与主题验证：`bun test scripts/tests/render.test.ts`。

流程见 [SKILL.md](SKILL.md)。
