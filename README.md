# Kane Skills

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Skills](https://img.shields.io/badge/Skills-12-green.svg)](skills/)
[![Validation](https://img.shields.io/badge/Validation-passing-brightgreen.svg)](scripts/validate-public-skills)

> Languages: [English README](README.md) | [中文 README](README-CN.md)

Reusable Agent Skills created by Kane.

This repository is a public, self-contained skill library. Each package is installable, inspectable, copyable, and adaptable without depending on local manager state, runtime links, registry files, adapted mirrors, or private project configuration.

---

## What this repo is

- A collection of **Agent Skills** packaged as independent, self-contained units.
- Every skill ships with a `SKILL.md` (the full protocol) and a `README.md` (a quick public reference).
- Optional extras include `scripts/`, `assets/`, `evals/`, `references/`, and `agents/` when the skill needs them.

## Skills

| Skill | Use When | Output | Docs |
| ----- | -------- | ------ | ---- |
| [`article-analyzer`](skills/article-analyzer/) | Analyze articles, papers, reports, or long-form arguments. | A folder of Markdown analysis files plus `99-summary.md`. | [SKILL](skills/article-analyzer/SKILL.md) |
| [`blog-checker`](skills/blog-checker/) | Review Chinese technical blog posts. | Structured diagnostic review. | [SKILL](skills/blog-checker/SKILL.md) |
| [`concept-fable`](skills/concept-fable/) | Explain advanced concepts through a Chinese three-stage fable. | Story, reveal, theory mapping, boundaries, and reading directions. | [SKILL](skills/concept-fable/SKILL.md) |
| [`douban-dice-review`](skills/douban-dice-review/) | Write a compact Douban-style film review with six theory dice. | Dice summary plus six-sentence review. | [SKILL](skills/douban-dice-review/SKILL.md) |
| [`it-system-skill-distiller`](skills/it-system-skill-distiller/) | Distill an IT business system into an AI-readable capability package. | Validated `distilled/` package structure. | [SKILL](skills/it-system-skill-distiller/SKILL.md) |
| [`merge-drafts`](skills/merge-drafts/) | Merge several drafts into one polished article. | Final merged article plus merge report. | [SKILL](skills/merge-drafts/SKILL.md) |
| [`prompt-optimizer`](skills/prompt-optimizer/) | Turn vague requirements into copy-ready prompts. | A `.md` or `.xml` prompt file. | [SKILL](skills/prompt-optimizer/SKILL.md) |
| [`request-refactor-plan`](skills/request-refactor-plan/) | Turn a refactor idea into a small-commit implementation plan. | Refactor RFC / GitHub issue body. | [SKILL](skills/request-refactor-plan/SKILL.md) |
| [`session-achieve`](skills/session-achieve/) | Review a multi-turn conversation and extract reusable prompts. | Session review and prompt lessons. | [SKILL](skills/session-achieve/SKILL.md) |
| [`skill-evaluator`](skills/skill-evaluator/) | Build repeatable evals for Agent Skills. | Eval plan, scoring templates, and report structure. | [SKILL](skills/skill-evaluator/SKILL.md) |
| [`skill-optimizer`](skills/skill-optimizer/) | Audit and improve Agent Skills. | Audit reports, eval plans, mutation proposals, and gates. | [SKILL](skills/skill-optimizer/SKILL.md) |
| [`subtext-article`](skills/subtext-article/) | Convert subtitles, ASR outputs, or transcripts into a faithful Chinese article. | A package folder with normalized transcript, draft, self-check, and final article. | [SKILL](skills/subtext-article/SKILL.md) |

## License

MIT. See [LICENSE](LICENSE).