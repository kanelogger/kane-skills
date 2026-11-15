# 主题配置

当前仅内置 `themes/irene-green.css` 标准主题，所有基础布局、组件和绿色配色都在此文件内，不依赖其他主题。用户自行添加主题时，先加载标准主题再加载用户主题；`--theme-css` 最后叠加。加载顺序不改变 CSS 优先级，建议沿用 `#nice` 作用域，避免低优先级规则无法覆盖默认值。

## 选择与预览

文章要求写入公众号时，先取得用户对本篇主题的明确选择；未指定就提问并等待回答，不以脚本默认值直接代选。只做本地预览时可以直接采用 `irene-green`。写入前检查 `meta.json` 的 `theme.name` 与用户选择一致。

```bash
bun "{baseDir}/scripts/main.ts" --list-themes
bun "{baseDir}/scripts/main.ts" "/path/to/article.md" -o "/path/to/article-green"
bun "{baseDir}/scripts/main.ts" "/path/to/article.md" --theme irene-green --theme-css "/path/to/custom.css" -o "/path/to/article-custom"
```

输出目录必须是新路径。用浏览器打开输出的 `preview.html`，按用户关注的模块检查实际效果，预览展示主标题和本地实际图片。`body.html` 用于公众号粘贴，移除重复的文章标题，图片使用上传标记；不把含本地图片地址的预览粘贴到公众号。主题名和 CSS 路径保存在 `meta.json` 的 `theme` 字段，图片目标样式保存在 `images[].style`；上传后仍须在编辑器中恢复并核对。

## 可分别配置的元素

| 模块 | 选择器示例 |
| --- | --- |
| 正文基础 | `#nice`、`#nice p` |
| 标题 | `#nice h1` 至 `#nice h6` |
| 引用 | `#nice blockquote`、`#nice blockquote p` |
| 列表 | `#nice ul`、`#nice ol`、`#nice li` |
| 代码块 | `#nice .code-block pre`、`#nice .code-block pre code` |
| 行内代码 | `#nice p code`、`#nice li code` |
| 表格 | `#nice table`、`#nice th`、`#nice td`、`#nice tbody tr:nth-child(even)` |
| 强调与链接 | `#nice strong`、`#nice em`、`#nice a` |
| 分隔线 | `#nice hr` |
| 提示块 | `#nice blockquote.quote-note`、`.quote-tip`、`.quote-important`、`.quote-warning`、`.quote-caution`、`.quote-prompt` |
| 代码容器与标签 | `#nice .code-block`、`#nice .code-block > .quote-block-label`、`#nice .quote-prompt pre code` |
| 行内块 | `#nice .quote-inline-block`、`.inline-kbd`、`.inline-tag`、`.inline-muted` |

例如只改变标题和代码块：

```css
#nice h2 {
  font-size: 22px;
  color: #8c382d;
}

#nice .code-block pre {
  padding: 20px;
  background: #282828;
  color: #f5f5f5;
}

#nice .code-block pre code {
  color: #f5f5f5;
}
```

`pre` 控制代码块的内边距和背景，内部 `code` 有独立的文字颜色，需分别覆盖。仅写 `#nice pre` 的优先级低于系列主题的 `#nice .code-block pre`，后加载也无法覆盖；上述选择器与主题规则同等优先级，不需要 `!important`，也不会改变行内代码。

用户希望保留一套可重复使用的主题时，将规则保存为 `themes/<名称>.css`；名称只用小写字母、数字和连字符，首字符为字母或数字，然后通过 `--theme <名称>` 选择。临时修改保存在用户指定位置或新的临时 CSS 文件中，不改默认主题。

## 组件语法

- 纯引用仍用 Markdown `>`。提示块在首行写 `> [!NOTE]`、`> [!TIP]`、`> [!IMPORTANT]`、`> [!WARNING]`、`> [!CAUTION]` 或 `> [!PROMPT]`，内容放下一行；标记后可写自定义标题。
- 代码围栏使用 `prompt`、`md` / `markdown`、`js` / `javascript`、`ts` / `typescript`、`json`、`bash` / `sh`、`python` / `py`、`html`、`css`、`yaml` / `yml` 或 `text`。未知的安全语言名仍保留并显示名称；内容只作文字，不执行，也不做语法高亮。
- 生成的结构为 `.code-block` → `.quote-block-label` + `pre.quote-block-body` → `code.language-*`。提示词额外使用 `.quote-prompt`，程序代码使用 `.quote-code`，可按这些结构分别配置。
- 反引号行内代码自动获得 `.quote-inline-block`。也可写 `<code class="inline-kbd">Cmd+K</code>` 或 `<span class="quote-inline-block inline-tag">提示词</span>`。
- 标准主题的标题变体为 `heading-plain`、`heading-underline`、`heading-band`、`heading-badge`；强调变体为 `emphasis-marker`、`emphasis-underline`、`emphasis-neutral`；图片变体为 `image-plain`、`image-frame`、`image-shadow`。将类名放在对应的 HTML 元素上，保留原标题层级。
- 只允许组件白名单与 `pre code` 的安全语言类名；自带 style、事件属性和其他类名仍清除。不能为支持主题而放宽为任意 HTML 属性。
- 自定义 CSS 若调整行内代码，请避免同时命中 `pre code`。代码块、行内代码、提示词应分别设置字号和背景。

## 导出约束

- 先净化稿件 HTML，清除稿件自己的 CSS，再将主题通过 Juice 转换为元素的 `style`。不访问微信接口，不下载外部样式或字体。
- 使用普通平铺规则，可用结构伪类；不使用 `@` 规则、嵌套、伪元素或交互状态。微信富文本无法可靠保留依赖样式表的效果。
- CSS 文件须为 UTF-8，每份最多 256 KiB；不允许资源 URL、CSS 转义或可执行表达式。校验失败时停止，不用无样式正文代替成功结果。
- 可以分别调整不同模块，代码块当前不做语法高亮。第三方主题若依赖标题装饰 `span`、特殊代码行号或公式容器，须改成实际存在的元素选择器，不声称直接兼容。
- 检查标题、引用、列表、代码与表格的字号、对比度及窄屏换行。CSS 成功内联不等于微信原样接受，写入后仍须按浏览器投稿流程核对。
