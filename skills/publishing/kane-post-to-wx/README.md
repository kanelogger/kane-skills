# kane-post-to-wx

把已有成稿排成微信公众号文章，或用指定图片和配文准备贴图。支持本地预览、保存草稿，以及按用户要求从微信公众平台后台正式发表。

在 Codex 中输入 `$kane-post-to-wx` 显式调用。

## 使用示例

- 「用 `kane-post-to-wx` 给这份 Markdown 做公众号排版预览。」
- 「把这篇文章和封面存到我的公众号草稿箱。」
- 「按 01 到 05 的顺序上传这组图片，配文用这个文件，存成贴图草稿。」

文章接受 UTF-8 的 Markdown、HTML 和纯文本，输出 `body.html`、`body.txt` 和 `meta.json`。默认写到稿件同级的新目录 `<稿件名>-wechat/`，也可指定父目录已存在的新路径。Markdown 外链默认转成文末引注，正文插图以标记和上传清单交付，正文 HTML 使用固定的行内样式。

文章排版依赖 Bun 1.3.8+ 和随包锁定的依赖。从技能目录执行：

```bash
bun install --frozen-lockfile --cwd scripts
bun scripts/main.ts "/path/to/article.md" --cover "/path/to/cover.png"
```

命令只准备本地材料。写入需要能操作公众号后台的现成浏览器工具和用户登录；推荐用 ego-browser。贴图直接通过浏览器上传。当前实现走浏览器，不需要配置 AppSecret、IP 白名单或 SSH 隧道。

流程见 [SKILL.md](SKILL.md)。