# Kane Skills

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Skills](https://img.shields.io/badge/Skills-28-green.svg)](skills/)
[![Validation](https://img.shields.io/badge/Validation-failing-red.svg)](scripts/validate-public-skills)

> Languages: [English README](README.md) | [中文 README](README-CN.md)

Reusable Agent Skills created by Kane.

This repository is a public, self-contained skill library. Each package is inspectable, copyable, and adaptable without depending on private project configuration.

---

## What this repo is

- A collection of **Agent Skills** packaged as independent, self-contained units.
- Every skill ships with a `SKILL.md`; most also include a `README.md` (a quick public reference).
- Optional extras include `scripts/`, `assets/`, `evals/`, `references/`, and `agents/` when the skill needs them.

## Skills

The 28 skills are grouped by primary use case. The grouping is documentation-only; package directories remain direct children of `skills/` so existing skill paths and loaders stay stable.

### Content analysis and writing (6)

| Skill | Use When | Output | Docs |
| ----- | -------- | ------ | ---- |
| [`article-analyzer`](skills/article-analyzer/) | Analyze articles, papers, reports, or long-form arguments. | A folder of Markdown analysis files plus `99-summary.md`. | [SKILL](skills/article-analyzer/SKILL.md) |
| [`blog-checker`](skills/blog-checker/) | Review Chinese technical blog posts. | Structured diagnostic review. | [SKILL](skills/blog-checker/SKILL.md) |
| [`concept-fable`](skills/concept-fable/) | Explain advanced concepts through a Chinese three-stage fable. | Story, reveal, theory mapping, boundaries, and reading directions. | [SKILL](skills/concept-fable/SKILL.md) |
| [`douban-dice-review`](skills/douban-dice-review/) | Write a compact Douban-style film review with six theory dice. | Dice summary plus six-sentence review. | [SKILL](skills/douban-dice-review/SKILL.md) |
| [`merge-drafts`](skills/merge-drafts/) | Merge several drafts into one polished article. | Final merged article plus merge report. | [SKILL](skills/merge-drafts/SKILL.md) |
| [`subtext-article`](skills/subtext-article/) | Convert subtitles, ASR outputs, or transcripts into a faithful Chinese article. | A package folder with normalized transcript, draft, self-check, and final article. | [SKILL](skills/subtext-article/SKILL.md) |

### Policy and technical verification (2)

| Skill | Use When | Output | Docs |
| ----- | -------- | ------ | ---- |
| [`analyze-china-policy`](skills/analyze-china-policy/) | Verify and interpret Chinese policy documents, compare wording, and assess implementation and impact horizons. | Evidence-based policy identity, three-axis assessment, impact map, and watchpoints. | [SKILL](skills/analyze-china-policy/SKILL.md) |
| [`tech-claim-auditor`](skills/tech-claim-auditor/) | Verify facts, commands, configuration, versions, performance data, and best practices in IT technical articles. | Traceable verification report and minimally revised article. | [SKILL](skills/tech-claim-auditor/SKILL.md) |

### Prompt and session knowledge (3)

| Skill | Use When | Output | Docs |
| ----- | -------- | ------ | ---- |
| [`kane-prompts`](skills/kane-prompts/) | Find, retrieve, lightly adapt, or combine reusable prompts from the `prompts/` library. | A copy-ready prompt grounded in the selected Markdown source, or an explicitly requested executed result. | [SKILL](skills/kane-prompts/SKILL.md) |
| [`prompt-optimizer`](skills/prompt-optimizer/) | Turn vague requirements into copy-ready prompts. | A `.md` or `.xml` prompt file. | [SKILL](skills/prompt-optimizer/SKILL.md) |
| [`session-achieve`](skills/session-achieve/) | Review a multi-turn conversation and extract reusable prompts. | Session review and prompt lessons. | [SKILL](skills/session-achieve/SKILL.md) |

### Product and engineering workflows (6)

| Skill | Use When | Output | Docs |
| ----- | -------- | ------ | ---- |
| [`github-reuse-scout`](skills/github-reuse-scout/) | Search GitHub for reusable open-source projects before building and decide whether to fork, reference, or build without reuse. | `.reuse/reuse-plan.md` reuse decision and migration ledger. | [SKILL](skills/github-reuse-scout/SKILL.md) |
| [`it-system-skill-distiller`](skills/it-system-skill-distiller/) | Distill an IT business system into an AI-readable capability package. | Validated `distilled/` package structure. | [SKILL](skills/it-system-skill-distiller/SKILL.md) |
| [`kane-explainer`](skills/kane-explainer/) | Explain technical specifications, RFCs, design proposals, or workspace changes in plain language. | A self-contained Chinese technical explanation with behavior and schema changes. | [SKILL](skills/kane-explainer/SKILL.md) |
| [`requirement-explorer`](skills/requirement-explorer/) | Turn raw business needs into a standard software requirements document. | Markdown requirements document with Mermaid flows and a completeness check. | [SKILL](skills/requirement-explorer/SKILL.md) |
| [`request-refactor-plan`](skills/request-refactor-plan/) | Turn a refactor idea into a small-commit implementation plan. | Refactor RFC / GitHub issue body. | [SKILL](skills/request-refactor-plan/SKILL.md) |
| [`simplify-codebase`](skills/simplify-codebase/) | Audit or simplify codebases by removing accidental complexity with reachability and contract evidence. | Ranked proof records, or a validated simplification with an operation receipt. | [SKILL](skills/simplify-codebase/SKILL.md) |

### Skill development and evolution (3)

| Skill | Use When | Output | Docs |
| ----- | -------- | ------ | ---- |
| [`project-skill-evolver`](skills/project-skill-evolver/) | Turn recurring session corrections into traceable, gated, and reversible Skill improvements. | Project Wiki, regression evals, evolution-cycle state, and rollback records. | [SKILL](skills/project-skill-evolver/SKILL.md) |
| [`skill-evaluator`](skills/skill-evaluator/) | Build repeatable evals for Agent Skills. | Eval plan, scoring templates, and report structure. | [SKILL](skills/skill-evaluator/SKILL.md) |
| [`skill-optimizer`](skills/skill-optimizer/) | Audit and improve Agent Skills. | Audit reports, eval plans, mutation proposals, and gates. | [SKILL](skills/skill-optimizer/SKILL.md) |

### Visual creation (5)

| Skill | Use When | Output | Docs |
| ----- | -------- | ------ | ---- |
| [`kane-avatar`](skills/kane-avatar/) | Generate avatars, surreal paper-art portraits, pet portraits, and keepsake cards from images or text. | A reusable image prompt and, when available, the generated avatar asset. | [SKILL](skills/kane-avatar/SKILL.md) |
| [`kane-cover`](skills/kane-cover/) | Generate cover images and reusable prompts for articles, notes, and social posts. | A platform-ready cover prompt and, when available, the generated cover asset. | [SKILL](skills/kane-cover/SKILL.md) |
| [`kane-q-article-illustrator`](skills/kane-q-article-illustrator/) | Illustrate articles with Kane Q IP as the fixed narrator and visual anchor. | Illustrated article with Kane Q character consistency. | [SKILL](skills/kane-q-article-illustrator/SKILL.md) |
| [`kane-q-cover-image`](skills/kane-q-cover-image/) | Generate article cover images, social cover art, and thumbnails with Kane Q IP. | Cover image with Kane Q brand identity. | [SKILL](skills/kane-q-cover-image/SKILL.md) |
| [`kane-q-infographic`](skills/kane-q-infographic/) | Create comic-style infographics with Kane Q as narrator and explainer. | Infographic with Kane Q visual consistency. | [SKILL](skills/kane-q-infographic/SKILL.md) |

### Publishing and delivery assurance (3)

| Skill | Use When | Output | Docs |
| ----- | -------- | ------ | ---- |
| [`git-commit-push`](skills/git-commit-push/) | Stage only the current task's changes, create a Conventional Commit from the staged diff, and push safely. | Verified commit and push result with unrelated changes preserved. | [SKILL](skills/git-commit-push/SKILL.md) |
| [`kane-post-to-wx`](skills/kane-post-to-wx/) | Publish articles or image-text posts to a WeChat Official Account. | Preview or submitted WeChat draft with metadata and images. | [SKILL](skills/kane-post-to-wx/SKILL.md) |
| [`verify-before-delivery`](skills/verify-before-delivery/) | Add risk-proportionate verification, evidence, and independent review to important tasks. | Deliverables, per-criterion evidence, unresolved items, and review verdict. | [SKILL](skills/verify-before-delivery/SKILL.md) |

## License

MIT. See [LICENSE](LICENSE).
