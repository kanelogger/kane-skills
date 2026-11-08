# Kane Skills 网站

运行 `bun site/build.ts` 生成静态站。用 `python3 -m http.server 8000 --bind 127.0.0.1 --directory site/dist` 启动本地预览，然后打开 `http://127.0.0.1:8000/`。

中英文目录的分类、用途和交付物分别来自根目录的两份 README。新增、移动或移除技能后，同步更新 README 表格、`site/examples.ts` 中的标题和示例，以及 `site/preparation.ts` 中的运行前准备。构建会校验两份目录与实际技能路径一致。

GitHub Pages 使用 GitHub Actions 作为发布来源。合并到 `main` 后，工作流构建网站并上传 `site/dist`。网站默认显示简体中文，英文入口位于 `/en/`。

这是 GitHub 开源项目的落地页。访客应能从首页找到合适的技能，从详情了解用途与交付物，查看 GitHub 源码，并复制对应的单技能安装命令。安装命令按技能名生成，使用 Skills CLI 安装整个技能目录。

发布前以 [Awwwards](https://www.awwwards.com/mobile-excellence-guidelines.pdf)、[The Webby Awards](https://www.webbyawards.com/judging-criteria/) 和 [The FWA](https://thefwa.com/submit) 的获奖作品与公开标准为品质目标。反复用桌面和手机检查视觉设计、导航、内容、性能和交互，实际验证从查找到复制、安装的流程。
