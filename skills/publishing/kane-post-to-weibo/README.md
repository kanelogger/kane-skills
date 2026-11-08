# kane-post-to-weibo

用已有素材准备普通微博或头条文章。技能在微博编辑器中填写内容并核对，最后由你在页面点击发布。也可以只生成本地预览，或在平台提供草稿功能时保存并核对草稿。

在 Codex 中输入 `$kane-post-to-weibo` 显式调用。

## 使用示例

- 「把这段文字和这三张图按顺序填到微博，我来点发布。」
- 「用这个视频和配文准备一条微博。」
- 「把 `article.md` 排成微博头条文章，用 `cover.png` 做封面，先给我看本地预览。」

普通微博支持纯文字，也可以用本地图片或视频配文，附件限制以编辑器提示为准。头条文章接收 UTF-8 Markdown，可从 frontmatter 读取 `title`、`summary` 和 `cover_image`，或通过脚本参数覆盖。正文图片与封面可用本地 PNG/JPEG，远程图只列入清单，需另行提供对应的本地文件。

头条文章转换使用 Bun 1.3.8+ 和随包锁定的依赖。从技能目录运行以下命令，得到同级新目录 `<稿件名>-weibo/` 中的 `body.html`、`body.txt` 和 `meta.json`。

```bash
bun install --frozen-lockfile --cwd scripts
bun scripts/main.ts "/path/to/article.md" --cover "/path/to/cover.png"
```

普通微博无需运行脚本。线上填稿通过现成浏览器工具复用已登录的微博会话。文章填稿需要富文本粘贴能力，有媒体时需要本地文件上传能力。离线预览和脚本均可独立使用。

执行流程见 [SKILL.md](SKILL.md)。头条文章的网页入口见[微博客服说明](https://kefu.weibo.com/faqdetail?id=20850)。
