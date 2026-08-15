# Kane Skills

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Skills](https://img.shields.io/badge/Skills-21-green.svg)](skills/)
[![Validation](https://img.shields.io/badge/Validation-passing-brightgreen.svg)](scripts/validate-public-skills)

> Languages: [English README](README.md) | [中文 README](README-CN.md)

Reusable Agent Skills created by Kane.

This repository is a public, self-contained skill library. Each package is inspectable, copyable, and adaptable without depending on private project configuration.

---

## What this repo is

- A collection of **Agent Skills** packaged as independent, self-contained units.
- Every skill ships with a `SKILL.md` (the full protocol) and a `README.md` (a quick public reference).
- Optional extras include `scripts/`, `assets/`, `evals/`, `references/`, and `agents/` when the skill needs them.

## Skills

| Skill | Use When | Output | Docs |
| ----- | -------- | ------ | ---- |
| [`analyze-china-policy`](skills/analyze-china-policy/) | Verify and interpret Chinese policy documents, compare wording, and assess implementation and impact horizons. | Evidence-based policy identity, three-axis assessment, impact map, and watchpoints. | [SKILL](skills/analyze-china-policy/SKILL.md) |
| [`article-analyzer`](skills/article-analyzer/) | Analyze articles, papers, reports, or long-form arguments. | A folder of Markdown analysis files plus `99-summary.md`. | [SKILL](skills/article-analyzer/SKILL.md) |
| [`blog-checker`](skills/blog-checker/) | Review Chinese technical blog posts. | Structured diagnostic review. | [SKILL](skills/blog-checker/SKILL.md) |
| [`concept-fable`](skills/concept-fable/) | Explain advanced concepts through a Chinese three-stage fable. | Story, reveal, theory mapping, boundaries, and reading directions. | [SKILL](skills/concept-fable/SKILL.md) |
| [`douban-dice-review`](skills/douban-dice-review/) | Write a compact Douban-style film review with six theory dice. | Dice summary plus six-sentence review. | [SKILL](skills/douban-dice-review/SKILL.md) |
| [`git-commit-push`](skills/git-commit-push/) | Stage only the current task's changes, create a Conventional Commit from the staged diff, and push safely. | Verified commit and push result with unrelated changes preserved. | [SKILL](skills/git-commit-push/SKILL.md) |
| [`github-reuse-scout`](skills/github-reuse-scout/) | Search GitHub for reusable open-source projects before building; decide fork / reference / none with evidence, then gradually migrate borrowed code to a preferred framework. | `.reuse/reuse-plan.md` reuse decision and migration ledger. | [SKILL](skills/github-reuse-scout/SKILL.md) |
| [`it-system-skill-distiller`](skills/it-system-skill-distiller/) | Distill an IT business system into an AI-readable capability package. | Validated `distilled/` package structure. | [SKILL](skills/it-system-skill-distiller/SKILL.md) |
| [`kane-q-article-illustrator`](skills/kane-q-article-illustrator/) | Illustrate articles with Kane Q IP as the fixed narrator and visual anchor. | Illustrated article with Kane Q character consistency. | [SKILL](skills/kane-q-article-illustrator/SKILL.md) |
| [`kane-q-cover-image`](skills/kane-q-cover-image/) | Generate article cover images, social cover art, and thumbnails with Kane Q IP. | Cover image with Kane Q brand identity. | [SKILL](skills/kane-q-cover-image/SKILL.md) |
| [`kane-q-infographic`](skills/kane-q-infographic/) | Create comic-style infographics with Kane Q as narrator and explainer. | Infographic with Kane Q visual consistency. | [SKILL](skills/kane-q-infographic/SKILL.md) |
| [`merge-drafts`](skills/merge-drafts/) | Merge several drafts into one polished article. | Final merged article plus merge report. | [SKILL](skills/merge-drafts/SKILL.md) |
| [`prompt-optimizer`](skills/prompt-optimizer/) | Turn vague requirements into copy-ready prompts. | A `.md` or `.xml` prompt file. | [SKILL](skills/prompt-optimizer/SKILL.md) |
| [`requirement-explorer`](skills/requirement-explorer/) | Turn raw business needs into a standard software requirements document. | Markdown requirements document with Mermaid flows and a completeness check. | [SKILL](skills/requirement-explorer/SKILL.md) |
| [`request-refactor-plan`](skills/request-refactor-plan/) | Turn a refactor idea into a small-commit implementation plan. | Refactor RFC / GitHub issue body. | [SKILL](skills/request-refactor-plan/SKILL.md) |
| [`session-achieve`](skills/session-achieve/) | Review a multi-turn conversation and extract reusable prompts. | Session review and prompt lessons. | [SKILL](skills/session-achieve/SKILL.md) |
| [`skill-evaluator`](skills/skill-evaluator/) | Build repeatable evals for Agent Skills. | Eval plan, scoring templates, and report structure. | [SKILL](skills/skill-evaluator/SKILL.md) |
| [`skill-optimizer`](skills/skill-optimizer/) | Audit and improve Agent Skills. | Audit reports, eval plans, mutation proposals, and gates. | [SKILL](skills/skill-optimizer/SKILL.md) |
| [`subtext-article`](skills/subtext-article/) | Convert subtitles, ASR outputs, or transcripts into a faithful Chinese article. | A package folder with normalized transcript, draft, self-check, and final article. | [SKILL](skills/subtext-article/SKILL.md) |
| [`tech-claim-auditor`](skills/tech-claim-auditor/) | Verify facts, commands, configuration, versions, performance data, and best practices in IT technical articles. | Traceable verification report and minimally revised article. | [SKILL](skills/tech-claim-auditor/SKILL.md) |
| [`verify-before-delivery`](skills/verify-before-delivery/) | Add risk-proportionate verification, evidence, and independent review to important tasks. | Deliverables, per-criterion evidence, unresolved items, and review verdict. | [SKILL](skills/verify-before-delivery/SKILL.md) |

## License

MIT. See [LICENSE](LICENSE).
