# kane-post-to-wx

个人微信公众号发布技能。支持 API、Remote API 和 ego-browser 三种路径；浏览器发布默认使用隔离的 ego-browser Task Space，Markdown 默认采用 `personal` 样式配置。

## 默认行为

- 文章和贴图的浏览器操作由 `scripts/wechat-ego-browser.ts` 执行。
- 未传 `--submit` 时只生成并保留可检查的预览。
- API 与 Remote API 路径继续使用 `scripts/wechat-api.ts`。
- Markdown 默认主题为 `default`，个人样式默认主色为 `blue`。
- `prompt-scroll` 代码块会生成“滑动查看完整提示词”组件；图片 alt 以 `长图` 开头会生成“滑动查看长图”组件。

## 快速验证

```bash
cd scripts
npm test
bun wechat-ego-browser.ts --markdown ../references/api-setup.md --dry-run
```

## 发布示例

```bash
# 浏览器文章预览
bun scripts/wechat-ego-browser.ts --markdown article.md

# 明确保存草稿
bun scripts/wechat-ego-browser.ts --markdown article.md --submit

# 贴图预览
bun scripts/wechat-ego-browser.ts --mode image-text --markdown post.md --images ./images

# API 草稿
bun scripts/wechat-api.ts article.md --theme default --cover cover.png
```

详细工作流和配置参见 [SKILL.md](./SKILL.md) 与 [references/ego-browser-posting.md](./references/ego-browser-posting.md)。
