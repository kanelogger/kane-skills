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

14 个技能按主要用途放在 `skills/<分类>/<技能名>/` 下。单独使用某个技能时，复制或安装包含 `SKILL.md` 的技能目录即可。

### 内容分析与写作（8）

| 技能 | 使用场景 | 输出 | 文档 |
| ---- | -------- | ---- | ---- |
| [`article-analyzer`](skills/writing/article-analyzer/SKILL.md) | 分析文章、论文、报告或长篇论述。 | 一组 Markdown 分析文件及 `99-summary.md`。 | [SKILL](skills/writing/article-analyzer/SKILL.md) |
| [`blog-checker`](skills/writing/blog-checker/SKILL.md) | 审阅中文技术博客文章。 | 结构化诊断审阅。 | [SKILL](skills/writing/blog-checker/SKILL.md) |
| [`concept-fable`](skills/writing/concept-fable/SKILL.md) | 通过三段式中文寓言解释高阶概念。 | 故事、概念揭示、理论映射、边界与阅读方向。 | [SKILL](skills/writing/concept-fable/SKILL.md) |
| [`document-clarifier`](skills/writing/document-clarifier/SKILL.md) | 对已有成稿去黑话、补必要背景并统一既定领域术语。 | 清晰改写稿或保留原件的文件副本。 | [SKILL](skills/writing/document-clarifier/SKILL.md) |
| [`douban-dice-review`](skills/writing/douban-dice-review/SKILL.md) | 用六枚理论骰子撰写简洁的豆瓣式影评。 | 骰子总结与六句影评。 | [SKILL](skills/writing/douban-dice-review/SKILL.md) |
| [`kane-translate`](skills/writing/kane-translate/SKILL.md) | 先分析再翻译文章与文档，可追加审校与润色。 | 符合目标语言、受众、风格及可选术语表的译文。 | [SKILL](skills/writing/kane-translate/SKILL.md) |
| [`merge-drafts`](skills/writing/merge-drafts/SKILL.md) | 将多份草稿合并为一篇润色后的文章。 | 最终合并文章及合并报告。 | [SKILL](skills/writing/merge-drafts/SKILL.md) |
| [`subtext-article`](skills/writing/subtext-article/SKILL.md) | 将字幕、自动语音识别输出或转录文本转换为忠实的中文文章。 | 包含源文副本、可读转写和同名 Markdown 终稿的文件夹。 | [SKILL](skills/writing/subtext-article/SKILL.md) |

### 产品与工程工作流（4）

| 技能 | 使用场景 | 输出 | 文档 |
| ---- | -------- | ---- | ---- |
| [`github-reuse-scout`](skills/engineering/github-reuse-scout/SKILL.md) | 开发前搜索可复用的开源项目，并基于证据判断复用、参考或放弃复用。 | `.reuse/reuse-plan.md` 复用决策与迁移台账。 | [SKILL](skills/engineering/github-reuse-scout/SKILL.md) |
| [`it-system-skill-distiller`](skills/engineering/it-system-skill-distiller/SKILL.md) | 将 IT 业务系统提炼为智能体可读的能力包。 | 经过校验的 `distilled/` 包结构。 | [SKILL](skills/engineering/it-system-skill-distiller/SKILL.md) |
| [`requirement-explorer`](skills/engineering/requirement-explorer/SKILL.md) | 将原始业务需求推进成标准软件需求文档。 | 含 Mermaid 流程图和完整性自检的 Markdown 需求文档。 | [SKILL](skills/engineering/requirement-explorer/SKILL.md) |
| [`simplify-codebase`](skills/engineering/simplify-codebase/SKILL.md) | 以可达性、契约和验证证据审计或简化代码库，移除意外复杂度。 | 排序后的证明记录，或带操作回执的已验证简化结果。 | [SKILL](skills/engineering/simplify-codebase/SKILL.md) |

### 技术解读（1）

| 技能 | 使用场景 | 输出 | 文档 |
| ---- | -------- | ---- | ---- |
| [`kane-explainer`](skills/explanation/kane-explainer/SKILL.md) | 用通俗语言解释技术规格、RFC、设计提案或工作区变更。 | 独立可读、包含行为和 schema 变化的中文技术说明。 | [SKILL](skills/explanation/kane-explainer/SKILL.md) |

### 发布与交付保障（1）

| 技能 | 使用场景 | 输出 | 文档 |
| ---- | -------- | ---- | ---- |
| [`git-commit-push`](skills/delivery/git-commit-push/SKILL.md) | 只暂存当前任务改动，依据暂存区 diff 生成 Conventional Commit，仅在请求包含推送时推送。 | 已验证的提交及按需推送结果，同时保留无关改动。 | [SKILL](skills/delivery/git-commit-push/SKILL.md) |

## 许可

MIT。详见 [LICENSE](LICENSE)。
