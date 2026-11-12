# ![Kane Skills](assets/brand/kane-skills-armory-logo.svg)

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Skills](https://img.shields.io/badge/Skills-25-green.svg)](skills/)

> 语言版本: [English README](README.md) | [中文 README](README-CN.md)

Kane 创建的可复用智能体技能库。

本仓库是一个公开、独立封装的技能库。每个技能包都可以被检视、复制与适配，且不依赖私有项目配置。

[浏览技能目录](https://kanelogger.github.io/kane-skills/)

---

## 本仓库是什么

- 一组以独立、自包含单元形式封装的**智能体技能（Agent Skills）**。
- 每个技能都包含 `SKILL.md`；大多数技能另附 `README.md` 公开速查。
- 根据需要可附带 `scripts/`、`assets/`、`evals/`、`references/`、`agents/` 等目录。
- 技能应能单独复制和使用；因此中文排版约定直接写在相关技能中，有意保持少量重复，避免依赖仓库级共享文件。


## 技能列表

25 个技能分为 7 个分类，放在 `skills/<分类>/<技能名>/` 下，每个技能按用户眼前的主要任务唯一归类，而非按输入来源分类。单独使用某个技能时，复制或安装包含 `SKILL.md` 的技能目录即可。

所有技能均需显式调用。在 Codex 中输入 `$技能名`，例如 `$kane-translate`。

### reading · 阅读与解读（2）

| 技能 | 使用场景 | 输出 | 文档 |
| ---- | -------- | ---- | ---- |
| [`article-analyzer`](skills/reading/article-analyzer/SKILL.md) | 分析文章、论文、报告或长篇论述。 | 一组 Markdown 分析文件及 `99-summary.md`。 | [SKILL](skills/reading/article-analyzer/SKILL.md) |
| [`kane-explainer`](skills/reading/kane-explainer/SKILL.md) | 显式调用，将文章、复杂话题或技术变更做成视觉解释。 | 大图少字的 HTML、分步互动教程或按问题选择的结构图解。 | [SKILL](skills/reading/kane-explainer/SKILL.md) |

### creation · 创作与成文（3）

| 技能 | 使用场景 | 输出 | 文档 |
| ---- | -------- | ---- | ---- |
| [`concept-fable`](skills/creation/concept-fable/SKILL.md) | 通过三段式中文寓言解释高阶概念。 | 故事、概念揭示、理论映射、边界与阅读方向。 | [SKILL](skills/creation/concept-fable/SKILL.md) |
| [`douban-dice-review`](skills/creation/douban-dice-review/SKILL.md) | 用六枚理论骰子撰写简洁的豆瓣式影评。 | 骰子总结与六句影评。 | [SKILL](skills/creation/douban-dice-review/SKILL.md) |
| [`subtext-article`](skills/creation/subtext-article/SKILL.md) | 将字幕、自动语音识别输出或转录文本转换为忠实的中文文章。 | 包含源文副本、可读转写和同名 Markdown 终稿的文件夹。 | [SKILL](skills/creation/subtext-article/SKILL.md) |

### editing · 文稿加工与审校（4）

| 技能 | 使用场景 | 输出 | 文档 |
| ---- | -------- | ---- | ---- |
| [`document-clarifier`](skills/editing/document-clarifier/SKILL.md) | 对已有成稿去黑话、补必要背景并统一既定领域术语。 | 清晰改写稿或保留原件的文件副本。 | [SKILL](skills/editing/document-clarifier/SKILL.md) |
| [`kane-translate`](skills/editing/kane-translate/SKILL.md) | 先分析再翻译文章与文档，可追加审校与润色。 | 符合目标语言、受众、风格及可选术语表的译文。 | [SKILL](skills/editing/kane-translate/SKILL.md) |
| [`merge-drafts`](skills/editing/merge-drafts/SKILL.md) | 将多份草稿合并为一篇润色后的文章。 | 最终合并文章及合并报告。 | [SKILL](skills/editing/merge-drafts/SKILL.md) |
| [`blog-checker`](skills/editing/blog-checker/SKILL.md) | 审阅中文技术博客文章。 | 结构化诊断审阅。 | [SKILL](skills/editing/blog-checker/SKILL.md) |

### assets · 素材获取与处理（4）

| 技能 | 使用场景 | 输出 | 文档 |
| ---- | -------- | ---- | ---- |
| [`kane-bilibili-transcript`](skills/assets/kane-bilibili-transcript/SKILL.md) | 按视频链接或 ID 获取 B 站已有字幕，选择分 P、语言和字幕类型。 | 包含元数据、原始字幕 JSON 和 Markdown/SRT/VTT/纯文本/JSON 导出的新目录。 | [SKILL](skills/assets/kane-bilibili-transcript/SKILL.md) |
| [`kane-youtube-transcript`](skills/assets/kane-youtube-transcript/SKILL.md) | 按视频链接或 ID 获取 YouTube 已有字幕，选择语言与人工/自动类型。 | 包含元数据、原始 JSON3 和 Markdown/SRT/VTT/纯文本/JSON 导出的新目录。 | [SKILL](skills/assets/kane-youtube-transcript/SKILL.md) |
| [`kane-compress-image`](skills/assets/kane-compress-image/SKILL.md) | 将本地静态图片压缩为 WebP、PNG 或 JPEG，支持单张与批量处理。 | 保留原图的新图片、真实体积变化和失败清单。 | [SKILL](skills/assets/kane-compress-image/SKILL.md) |
| [`kane-url-to-markdown`](skills/assets/kane-url-to-markdown/SKILL.md) | 优先保存现成网页读取工具返回的 Markdown，动态或登录页复用浏览器工具获取正文。 | 带来源元数据、正文结构和远程图片链接的新 Markdown 文件。 | [SKILL](skills/assets/kane-url-to-markdown/SKILL.md) |

### publishing · 内容发布（3）

| 技能 | 使用场景 | 输出 | 文档 |
| ---- | -------- | ---- | ---- |
| [`kane-post-to-wx`](skills/publishing/kane-post-to-wx/SKILL.md) | 为微信公众号排版或发表已有文章及贴图。 | 本地排版预览、已核实的公众号草稿或发表记录。 | [SKILL](skills/publishing/kane-post-to-wx/SKILL.md) |
| [`kane-post-to-x`](skills/publishing/kane-post-to-x/SKILL.md) | 为 X 整理已有普通帖、引用帖或 Markdown 长文并交接发表。 | 本地预览、已核实的草稿或发表链接。 | [SKILL](skills/publishing/kane-post-to-x/SKILL.md) |
| [`kane-post-to-weibo`](skills/publishing/kane-post-to-weibo/SKILL.md) | 准备文字、图片或视频微博，或将 Markdown 排成头条文章。 | 本地预览，或已填写、供用户核对发布的编辑页。 | [SKILL](skills/publishing/kane-post-to-weibo/SKILL.md) |

### planning · 需求探索与选型（4）

| 技能 | 使用场景 | 输出 | 文档 |
| ---- | -------- | ---- | ---- |
| [`requirement-explorer`](skills/planning/requirement-explorer/SKILL.md) | 将原始业务需求推进成标准软件需求文档。 | 含 Mermaid 流程图和完整性自检的 Markdown 需求文档。 | [SKILL](skills/planning/requirement-explorer/SKILL.md) |
| [`kane-clarify-questions`](skills/planning/kane-clarify-questions/SKILL.md) | 显式调用，默认通过最多两轮具体、中立的澄清补全通用任务的关键上下文。 | 已确认事实、采用的假设、仍未确定的事项及其对后续执行的影响。 | [SKILL](skills/planning/kane-clarify-questions/SKILL.md) |
| [`github-reuse-scout`](skills/planning/github-reuse-scout/SKILL.md) | 开发前搜索可复用的开源项目，并基于证据判断复用、参考或放弃复用。 | `.reuse/reuse-plan.md` 复用决策与迁移台账。 | [SKILL](skills/planning/github-reuse-scout/SKILL.md) |
| [`kane-task-planner`](skills/planning/kane-task-planner/SKILL.md) | 仅由用户点名调用，在执行前规划任务，优先复用当前可用技能，按需建议脚本、子代理或新技能。 | 简短粗粒度执行计划，列出执行方式、推荐理由、预期产出及必要先后关系；只提建议。 | [SKILL](skills/planning/kane-task-planner/SKILL.md) |

### engineering · 开发维护与交付（5）

| 技能 | 使用场景 | 输出 | 文档 |
| ---- | -------- | ---- | ---- |
| [`it-system-skill-distiller`](skills/engineering/it-system-skill-distiller/SKILL.md) | 将 IT 业务系统提炼为智能体可读的能力包。 | 经过校验的 `distilled/` 包结构。 | [SKILL](skills/engineering/it-system-skill-distiller/SKILL.md) |
| [`simplify-codebase`](skills/engineering/simplify-codebase/SKILL.md) | 以可达性、契约和验证证据审计或简化代码库，移除意外复杂度。 | 排序后的证明记录，或带操作回执的已验证简化结果。 | [SKILL](skills/engineering/simplify-codebase/SKILL.md) |
| [`git-commit-push`](skills/engineering/git-commit-push/SKILL.md) | 只暂存当前任务改动，在 Conventional Commit 中记录改动、原因、已有验证方式与结果、回滚方法，仅按授权推送。 | 提交及按需推送状态、验证记录和回滚步骤；不执行改动验证。 | [SKILL](skills/engineering/git-commit-push/SKILL.md) |
| [`kane-task-retro`](skills/engineering/kane-task-retro/SKILL.md) | 基于交付证据复盘一次任务或一次 Agent 协作。 | 一张简短复盘卡，最多一项建议动作及其验证方式。 | [SKILL](skills/engineering/kane-task-retro/SKILL.md) |
| [`kane-task-cleanup`](skills/engineering/kane-task-cleanup/SKILL.md) | 显式调用后默认清理本次任务已核实的一次性临时文件，可指定范围、只保留成果或先看清单。 | 经核验的删除结果、保留成果、跳过项及获准停止的后台任务。 | [SKILL](skills/engineering/kane-task-cleanup/SKILL.md) |

## 许可

MIT。详见 [LICENSE](LICENSE)。
