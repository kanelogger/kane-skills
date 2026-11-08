# Kane Skills 网站

运行 `bun site/build.ts` 生成静态站。用 `python3 -m http.server 8000 --bind 127.0.0.1 --directory site/dist` 启动本地预览，然后打开 `http://127.0.0.1:8000/`。

中英文目录的分类、用途和交付物分别来自根目录的两份 README。新增、移动或移除技能后，同步更新 README 表格和 `site/examples.ts` 中的标题及示例。构建会校验两份目录与实际技能路径一致。

GitHub Pages 使用 GitHub Actions 作为发布来源。合并到 `main` 后，工作流构建网站并上传 `site/dist`。网站默认显示简体中文，英文入口位于 `/en/`。
