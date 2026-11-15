export const examples: Record<string, [zhTitle: string, enTitle: string, zhPrompt: string, enPrompt: string]> = {
  "article-analyzer": [
    "长文分析", "Long-form analysis",
    "用 article-analyzer 分析这篇报告。梳理它的核心论点和证据，再给我一份总览。",
    "Use article-analyzer to map this report’s main claims and evidence, then give me an overview.",
  ],
  "kane-explainer": [
    "视觉解读", "Visual explanation",
    "用 kane-explainer 把这次技术改动做成分步互动教程，让新人跟着走一遍。",
    "Use kane-explainer to turn this technical change into a step-by-step interactive lesson for newcomers.",
  ],
  "concept-fable": [
    "概念寓言", "Concept fables",
    "用 concept-fable 写一则中文寓言解释路径依赖，并讲清故事和理论的对应关系。",
    "Use concept-fable to explain path dependence through a Chinese fable and map the story back to the theory.",
  ],
  "douban-dice-review": [
    "豆瓣式影评", "Douban-style film review",
    "用 douban-dice-review 为这部电影写一篇六句短评，附上理论骰子的选择。",
    "Use douban-dice-review to write a six-sentence review of this film and show the theory dice you selected.",
  ],
  "subtext-article": [
    "字幕成文", "Transcript to article",
    "用 subtext-article 把这份访谈字幕整理成中文文章，保留源文和可读转写。",
    "Use subtext-article to turn this interview transcript into a Chinese article and keep the source and readable transcript.",
  ],
  "document-clarifier": [
    "成稿澄清", "Document clarification",
    "用 document-clarifier 把这份方案改到新同事能读懂，保留已有领域术语。",
    "Use document-clarifier to make this proposal clear to a new teammate and preserve established domain terms.",
  ],
  "kane-translate": [
    "文章与文档翻译", "Article and document translation",
    "用 kane-translate 把这篇文章译成中文，读者是熟悉行业的从业者，请沿用附带的术语表。",
    "Use kane-translate to translate this article into Chinese for industry readers and follow the attached glossary.",
  ],
  "merge-drafts": [
    "多稿合一", "Draft merging",
    "用 merge-drafts 把这三版草稿合成一篇，保留第二版的结构和第三版独有的例子。",
    "Use merge-drafts to combine these three drafts, keeping the structure of the second and the unique examples from the third.",
  ],
  "blog-checker": [
    "技术博客审校", "Technical blog review",
    "用 blog-checker 审阅这篇中文技术博客，列出最影响理解的问题和原文位置。",
    "Use blog-checker to review this Chinese technical post. Point out the main issues and where they appear.",
  ],
  "kane-article-illustrator": [
    "文章插图", "Article illustrations",
    "用 kane-article-illustrator 为这篇文章配图，集中补齐交付形式、受众、风格、尺寸和数量等要求，再根据我的回答完善配图。",
    "Use kane-article-illustrator for this article. Clarify the deliverable, audience, style, dimensions, and count together, then shape the illustrations around my answers.",
  ],
  "kane-cover-image": [
    "绘制封面", "Cover design",
    "$kane-cover-image 只写 1 张封面的完整提示词，主题是把零散笔记整理成知识体系，面向知识工作者，用于个人博客头图。采用米白底、深蓝铅笔线条和少量橙色的温暖手绘风，1536×1024，完整画幅展示，不裁切；无任何可见文字。主体要有零散卡片汇入一本打开的书，禁止人物、机器人和品牌标志。",
    "$kane-cover-image Deliver only the complete prompt for one cover. The topic is turning scattered notes into a knowledge system, for knowledge workers viewing a personal blog header. Use a warm hand-drawn style with an off-white background, dark blue pencil lines, and small orange accents, at 1536×1024. Show the full frame without cropping and include no visible text. Show scattered cards flowing into an open book; exclude people, robots, and brand logos.",
  ],
  "kane-infographic": [
    "信息图", "Infographics",
    "$kane-infographic 把这份团队周工时记录做成 1 张信息图的完整独立提示词，仅交付提示词：开发 40 小时、评审 25 小时、沟通 20 小时、学习 15 小时。受众是团队成员，用于周会复盘；采用简洁编辑式风格，白底蓝绿配色，1080×1350，简体中文。保留四类工时及合计，突出时间分配，不将样本写成行业统计。",
    "$kane-infographic Create a complete standalone prompt for one infographic using this team’s weekly time log: development 40 hours, review 25 hours, communication 20 hours, learning 15 hours. Deliver the prompt only. The audience is team members at a weekly retrospective. Use a clean editorial style, white background with blue and green, 1080×1350, and English copy. Show all four categories and the total, emphasize time allocation, and do not present this sample as industry statistics.",
  ],
  "kane-bilibili-transcript": [
    "B 站字幕导出", "Bilibili caption export",
    "用 kane-bilibili-transcript 导出这个 B 站视频第 2 P 的中文字幕为 SRT。",
    "Use kane-bilibili-transcript to export existing Chinese captions from part 2 of this Bilibili video as SRT.",
  ],
  "kane-youtube-transcript": [
    "YouTube 字幕导出", "YouTube caption export",
    "用 kane-youtube-transcript 导出这条视频已有的英文字幕，格式用 Markdown。",
    "Use kane-youtube-transcript to export the existing English captions for this video as Markdown.",
  ],
  "kane-compress-image": [
    "图片压缩", "Image compression",
    "用 kane-compress-image 把这个目录和子目录里的静态图片压成 WebP，保留原图并报告体积变化。",
    "Use kane-compress-image to compress the static images in this folder and its subfolders to WebP. Keep the originals and report the size changes.",
  ],
  "kane-url-to-markdown": [
    "网页转 Markdown", "Webpage to Markdown",
    "用 kane-url-to-markdown 把这个网页的正文保存成 Markdown，保留来源和原文结构。",
    "Use kane-url-to-markdown to save the body of this page as Markdown, preserving the source and article structure.",
  ],
  "kane-post-to-wx": [
    "微信公众号排版与发布", "WeChat Official Account publishing",
    "用 kane-post-to-wx 给这份 Markdown 和封面做公众号排版，先给我本地预览。",
    "Use kane-post-to-wx to format this Markdown and cover for a WeChat Official Account. Show me a local preview first.",
  ],
  "kane-post-to-x": [
    "X 帖子与长文", "X posts and Articles",
    "用 kane-post-to-x 把这篇 Markdown 排成 X Articles，只生成本地预览。",
    "Use kane-post-to-x to format this Markdown as an X Article and generate a local preview only.",
  ],
  "kane-post-to-weibo": [
    "微博与头条文章", "Weibo posts and headline articles",
    "用 kane-post-to-weibo 把这段文字和三张图按顺序填到微博，我来点发布。",
    "Use kane-post-to-weibo to fill the Weibo editor with this text and these three images in order. I’ll publish it.",
  ],
  "kane-clarify-questions": [
    "提问完善", "Context Clarification",
    "$kane-clarify-questions 我想组织一次团队工作坊，现有想法附在下面。请补齐会影响方案的上下文，整理已确认事实、采用的假设和仍未确定的事项。",
    "$kane-clarify-questions I want to organize a team workshop; my current ideas are below. Clarify the context that would affect the plan, then summarize confirmed facts, assumptions adopted, and remaining unknowns.",
  ],
  "requirement-explorer": [
    "软件需求梳理", "Software requirements",
    "用 requirement-explorer 梳理这个业务想法，和我确认流程及边界，最后给我一份需求文档。",
    "Use requirement-explorer to clarify this business idea with me, confirm its flows and scope, and produce a requirements document.",
  ],
  "github-reuse-scout": [
    "开源复用选型", "Open-source reuse",
    "用 github-reuse-scout 调研 GitHub 上有哪些项目能支撑这个需求，比较架构和迁移成本。",
    "Use github-reuse-scout to find GitHub projects that fit this need and compare their architectures and migration costs.",
  ],
  "kane-task-planner": [
    "任务执行规划", "Task execution planning",
    "$kane-task-planner 为把这批访谈整理成专题报告做执行前规划，优先复用当前可用技能，说明主要环节、建议执行方式和预期产出，只给大致计划。",
    "$kane-task-planner Plan how to turn these interviews into a thematic report. Prioritize available skills and outline the main steps, suggested methods, and expected outputs. Provide a high-level plan only.",
  ],
  "kane-migrate-to-rust": [
    "安全 Rust 迁移", "Safe Rust migration",
    "使用 $kane-migrate-to-rust，将 /path/to/legacy-project 迁移至安全 Rust，验证现有输出一致，并记录测试结果和实测性能。",
    "Use $kane-migrate-to-rust to migrate /path/to/legacy-project to safe Rust, check output parity, and record test results and measured performance.",
  ],
  "it-system-skill-distiller": [
    "IT 系统能力提炼", "IT system capability extraction",
    "用 it-system-skill-distiller 从这个业务系统的代码和文档里提炼一份 Agent 能力包。",
    "Use it-system-skill-distiller to turn this business system’s code and docs into an Agent capability package.",
  ],
  "simplify-codebase": [
    "代码库简化", "Codebase simplification",
    "用 simplify-codebase 审计这个模块，按证据列出可以移除的复杂度，先给我审计结果。",
    "Use simplify-codebase to audit this module. Rank the opportunities to remove complexity by evidence and show me the audit first.",
  ],
  "git-commit-push": [
    "Git 提交与推送", "Git commit and push",
    "用 git-commit-push，以快捷模式提交本次任务的改动，并推送当前分支。",
    "Use git-commit-push in Quick mode to commit this task’s changes and push the current branch.",
  ],
  "kane-task-retro": [
    "任务复盘", "Task retrospective",
    "用 kane-task-retro 对照原始目标和交付结果复盘这次任务，找一个下次能验证的改进。",
    "Use kane-task-retro to compare this task’s delivery with its original goal and identify one improvement we can verify next time.",
  ],
  "kane-task-cleanup": [
    "任务文件清理", "Task file cleanup",
    "用 kane-task-cleanup 盘点这次任务的临时文件，先给我看清单。",
    "Use kane-task-cleanup to inventory this task’s temporary files and show me the list first.",
  ],
}
