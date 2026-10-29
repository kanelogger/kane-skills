# Kane Skills

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Skills](https://img.shields.io/badge/Skills-14-green.svg)](skills/)

> 语言版本: [English README](README.md) | [中文 README](README-CN.md)

Kane 创建的可复用智能体技能库。

本仓库是一个公开、独立封装的技能库。每个技能包都可以被检视、复制与适配，且不依赖私有项目配置。

---

## 本仓库是什么

- 一组以独立、自包含单元形式封装的**智能体技能（Agent Skills）**。
- 每个技能都包含 `SKILL.md`；大多数技能另附 `README.md` 公开速查。
- 根据需要可附带 `scripts/`、`assets/`、`evals/`、`references/`、`agents/` 等目录。
- 技能应能单独复制和使用；因此中文排版约定直接写在相关技能中，有意保持少量重复，避免依赖仓库级共享文件。


## 技能列表

14 个技能按主要使用目的分组。分类仅用于文档导航；技能目录仍保持在 `skills/` 的直接子目录中，避免改变现有路径和加载约定。

### 内容分析与写作（7）

| 技能 | 使用场景 | 输出 | 文档 |
| ---- | -------- | ---- | ---- |
| [`article-analyzer`](skills/article-analyzer/) | 分析文章、论文、报告或长篇论述。 | 一组 Markdown 分析文件及 `99-summary.md`。 | [SKILL](skills/article-analyzer/SKILL.md) |
| [`blog-checker`](skills/blog-checker/) | 审阅中文技术博客文章。 | 结构化诊断审阅。 | [SKILL](skills/blog-checker/SKILL.md) |
| [`concept-fable`](skills/concept-fable/) | 通过三段式中文寓言解释高阶概念。 | 故事、概念揭示、理论映射、边界与阅读方向。 | [SKILL](skills/concept-fable/SKILL.md) |
| [`document-clarifier`](skills/document-clarifier/) | 对已有成稿去黑话、补必要背景并统一既定领域术语。 | 清晰改写稿或保留原件的文件副本。 | [SKILL](skills/document-clarifier/SKILL.md) |
| [`douban-dice-review`](skills/douban-dice-review/) | 用六枚理论骰子撰写简洁的豆瓣式影评。 | 骰子总结与六句影评。 | [SKILL](skills/douban-dice-review/SKILL.md) |
| [`merge-drafts`](skills/merge-drafts/) | 将多份草稿合并为一篇润色后的文章。 | 最终合并文章及合并报告。 | [SKILL](skills/merge-drafts/SKILL.md) |
| [`subtext-article`](skills/subtext-article/) | 将字幕、自动语音识别输出或转录文本转换为忠实的中文文章。 | 包含规范化转录、草稿、自检与终稿的完整文件夹。 | [SKILL](skills/subtext-article/SKILL.md) |

### 提示词库（1）

| 技能 | 使用场景 | 输出 | 文档 |
| ---- | -------- | ---- | ---- |
| [`kane-prompts`](skills/kane-prompts/) | 从 `prompts/` 中查找、调用、轻量改写或组合常用提示词。 | 基于所选 Markdown 原文的可复制提示词，或按明确要求执行后的产物。 | [SKILL](skills/kane-prompts/SKILL.md) |

### 产品与工程工作流（5）

| 技能 | 使用场景 | 输出 | 文档 |
| ---- | -------- | ---- | ---- |
| [`github-reuse-scout`](skills/github-reuse-scout/) | 开发前搜索可复用的开源项目，并基于证据判断复用、参考或放弃复用。 | `.reuse/reuse-plan.md` 复用决策与迁移台账。 | [SKILL](skills/github-reuse-scout/SKILL.md) |
| [`it-system-skill-distiller`](skills/it-system-skill-distiller/) | 将 IT 业务系统提炼为智能体可读的能力包。 | 经过校验的 `distilled/` 包结构。 | [SKILL](skills/it-system-skill-distiller/SKILL.md) |
| [`kane-explainer`](skills/kane-explainer/) | 用通俗语言解释技术规格、RFC、设计提案或工作区变更。 | 独立可读、包含行为和 schema 变化的中文技术说明。 | [SKILL](skills/kane-explainer/SKILL.md) |
| [`requirement-explorer`](skills/requirement-explorer/) | 将原始业务需求推进成标准软件需求文档。 | 含 Mermaid 流程图和完整性自检的 Markdown 需求文档。 | [SKILL](skills/requirement-explorer/SKILL.md) |
| [`simplify-codebase`](skills/simplify-codebase/) | 以可达性、契约和验证证据审计或简化代码库，移除意外复杂度。 | 排序后的证明记录，或带操作回执的已验证简化结果。 | [SKILL](skills/simplify-codebase/SKILL.md) |

### 发布与交付保障（1）

| 技能 | 使用场景 | 输出 | 文档 |
| ---- | -------- | ---- | ---- |
| [`git-commit-push`](skills/git-commit-push/) | 只暂存当前任务改动，依据暂存区 diff 生成 Conventional Commit，并安全推送。 | 已验证的提交与推送结果，同时保留无关改动。 | [SKILL](skills/git-commit-push/SKILL.md) |

## 许可

MIT。详见 [LICENSE](LICENSE)。
