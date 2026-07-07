# Kane Skills

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Skills](https://img.shields.io/badge/Skills-13-green.svg)](skills/)
[![Validation](https://img.shields.io/badge/Validation-passing-brightgreen.svg)](scripts/validate-public-skills)

> 语言版本: [English README](README.md) | [中文 README](README-CN.md)

Kane 创建的可复用智能体技能库。

本仓库是一个公开、独立封装的技能库。每个技能包都可以被检视、复制与适配，且不依赖私有项目配置。

---

## 本仓库是什么

- 一组以独立、自包含单元形式封装的**智能体技能（Agent Skills）**。
- 每个技能都包含 `SKILL.md`（完整协议）和 `README.md`（公开速查）。
- 根据需要可附带 `scripts/`、`assets/`、`evals/`、`references/`、`agents/` 等目录。


## 技能列表

| 技能 | 使用场景 | 输出 | 文档 |
| ---- | -------- | ---- | ---- |
| [`article-analyzer`](skills/article-analyzer/) | 分析文章、论文、报告或长篇论述。 | 一组 Markdown 分析文件及 `99-summary.md`。 | [SKILL](skills/article-analyzer/SKILL.md) |
| [`blog-checker`](skills/blog-checker/) | 审阅中文技术博客文章。 | 结构化诊断审阅。 | [SKILL](skills/blog-checker/SKILL.md) |
| [`concept-fable`](skills/concept-fable/) | 通过三段式中文寓言解释高阶概念。 | 故事、揭示、理论映射、边界与阅读方向。 | [SKILL](skills/concept-fable/SKILL.md) |
| [`douban-dice-review`](skills/douban-dice-review/) | 用六枚理论骰子撰写简洁的豆瓣式影评。 | 骰子总结与六句影评。 | [SKILL](skills/douban-dice-review/SKILL.md) |
| [`it-system-skill-distiller`](skills/it-system-skill-distiller/) | 将 IT 业务系统提炼为智能体可读的能力包。 | 经过校验的 `distilled/` 包结构。 | [SKILL](skills/it-system-skill-distiller/SKILL.md) |
| [`merge-drafts`](skills/merge-drafts/) | 将多份草稿合并为一篇润色后的文章。 | 最终合并文章及合并报告。 | [SKILL](skills/merge-drafts/SKILL.md) |
| [`prompt-optimizer`](skills/prompt-optimizer/) | 将模糊需求转化为可直接复制使用的提示词。 | 一个 `.md` 或 `.xml` 提示词文件。 | [SKILL](skills/prompt-optimizer/SKILL.md) |
| [`requirement-explorer`](skills/requirement-explorer/) | 将原始业务需求推进成标准软件需求文档。 | 含 Mermaid 流程图和完整性自检的 Markdown 需求文档。 | [SKILL](skills/requirement-explorer/SKILL.md) |
| [`request-refactor-plan`](skills/request-refactor-plan/) | 将重构想法转化为小步提交的实施计划。 | 重构 RFC / GitHub issue 正文。 | [SKILL](skills/request-refactor-plan/SKILL.md) |
| [`session-achieve`](skills/session-achieve/) | 复盘多轮对话并提取可复用的提示词。 | 会话复盘与提示词经验。 | [SKILL](skills/session-achieve/SKILL.md) |
| [`skill-evaluator`](skills/skill-evaluator/) | 为智能体技能构建可复用的评估方案。 | 评估计划、评分模板与报告结构。 | [SKILL](skills/skill-evaluator/SKILL.md) |
| [`skill-optimizer`](skills/skill-optimizer/) | 审计并改进智能体技能。 | 审计报告、评估计划、改进提案与验收标准。 | [SKILL](skills/skill-optimizer/SKILL.md) |
| [`subtext-article`](skills/subtext-article/) | 将字幕、自动语音识别输出或转录文本转换为忠实的中文文章。 | 包含规范化转录、草稿、自检与终稿的完整文件夹。 | [SKILL](skills/subtext-article/SKILL.md) |

## 许可

MIT。详见 [LICENSE](LICENSE)。
