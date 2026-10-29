# Kane Skills

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Skills](https://img.shields.io/badge/Skills-14-green.svg)](skills/)

> Languages: [English README](README.md) | [中文 README](README-CN.md)

Reusable Agent Skills created by Kane.

This repository is a public, self-contained skill library. Each package is inspectable, copyable, and adaptable without depending on private project configuration.

---

## What this repo is

- A collection of **Agent Skills** packaged as independent, self-contained units.
- Every skill ships with a `SKILL.md`; most also include a `README.md` (a quick public reference).
- Optional extras include `scripts/`, `assets/`, `evals/`, `references/`, and `agents/` when the skill needs them.
- Skills should remain usable when copied individually, so Chinese typography defaults live inside each relevant skill. The small amount of intentional duplication avoids a dependency on a repository-level shared file.

## Skills

The 14 skills are grouped by primary use case. The grouping is documentation-only; package directories remain direct children of `skills/` so existing skill paths and loaders stay stable.

### Content analysis and writing (7)

| Skill | Use When | Output | Docs |
| ----- | -------- | ------ | ---- |
| [`article-analyzer`](skills/article-analyzer/) | Analyze articles, papers, reports, or long-form arguments. | A folder of Markdown analysis files plus `99-summary.md`. | [SKILL](skills/article-analyzer/SKILL.md) |
| [`blog-checker`](skills/blog-checker/) | Review Chinese technical blog posts. | Structured diagnostic review. | [SKILL](skills/blog-checker/SKILL.md) |
| [`concept-fable`](skills/concept-fable/) | Explain advanced concepts through a Chinese three-stage fable. | Story, reveal, theory mapping, boundaries, and reading directions. | [SKILL](skills/concept-fable/SKILL.md) |
| [`document-clarifier`](skills/document-clarifier/) | Revise completed prose for clarity while preserving facts and established domain terms. | Clearer text or a file copy that preserves the original. | [SKILL](skills/document-clarifier/SKILL.md) |
| [`douban-dice-review`](skills/douban-dice-review/) | Write a compact Douban-style film review with six theory dice. | Dice summary plus six-sentence review. | [SKILL](skills/douban-dice-review/SKILL.md) |
| [`merge-drafts`](skills/merge-drafts/) | Merge several drafts into one polished article. | Final merged article plus merge report. | [SKILL](skills/merge-drafts/SKILL.md) |
| [`subtext-article`](skills/subtext-article/) | Convert subtitles, ASR outputs, or transcripts into a faithful Chinese article. | A package folder with normalized transcript, draft, self-check, and final article. | [SKILL](skills/subtext-article/SKILL.md) |

### Prompt library (1)

| Skill | Use When | Output | Docs |
| ----- | -------- | ------ | ---- |
| [`kane-prompts`](skills/kane-prompts/) | Find, retrieve, lightly adapt, or combine reusable prompts from the `prompts/` library. | A copy-ready prompt grounded in the selected Markdown source, or an explicitly requested executed result. | [SKILL](skills/kane-prompts/SKILL.md) |

### Product and engineering workflows (5)

| Skill | Use When | Output | Docs |
| ----- | -------- | ------ | ---- |
| [`github-reuse-scout`](skills/github-reuse-scout/) | Search GitHub for reusable open-source projects before building and decide whether to fork, reference, or build without reuse. | `.reuse/reuse-plan.md` reuse decision and migration ledger. | [SKILL](skills/github-reuse-scout/SKILL.md) |
| [`it-system-skill-distiller`](skills/it-system-skill-distiller/) | Distill an IT business system into an AI-readable capability package. | Validated `distilled/` package structure. | [SKILL](skills/it-system-skill-distiller/SKILL.md) |
| [`kane-explainer`](skills/kane-explainer/) | Explain technical specifications, RFCs, design proposals, or workspace changes in plain language. | A self-contained Chinese technical explanation with behavior and schema changes. | [SKILL](skills/kane-explainer/SKILL.md) |
| [`requirement-explorer`](skills/requirement-explorer/) | Turn raw business needs into a standard software requirements document. | Markdown requirements document with Mermaid flows and a completeness check. | [SKILL](skills/requirement-explorer/SKILL.md) |
| [`simplify-codebase`](skills/simplify-codebase/) | Audit or simplify codebases by removing accidental complexity with reachability and contract evidence. | Ranked proof records, or a validated simplification with an operation receipt. | [SKILL](skills/simplify-codebase/SKILL.md) |

### Publishing and delivery assurance (1)

| Skill | Use When | Output | Docs |
| ----- | -------- | ------ | ---- |
| [`git-commit-push`](skills/git-commit-push/) | Stage only the current task's changes, create a Conventional Commit from the staged diff, and push safely. | Verified commit and push result with unrelated changes preserved. | [SKILL](skills/git-commit-push/SKILL.md) |

## License

MIT. See [LICENSE](LICENSE).
