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

The 14 skills are organized by primary use under `skills/<category>/<skill-name>/`. To use a skill separately, copy or install its package directory containing `SKILL.md`.

### Content analysis and writing (8)

| Skill | Use When | Output | Docs |
| ----- | -------- | ------ | ---- |
| [`article-analyzer`](skills/writing/article-analyzer/SKILL.md) | Analyze articles, papers, reports, or long-form arguments. | A folder of Markdown analysis files plus `99-summary.md`. | [SKILL](skills/writing/article-analyzer/SKILL.md) |
| [`blog-checker`](skills/writing/blog-checker/SKILL.md) | Review Chinese technical blog posts. | Structured diagnostic review. | [SKILL](skills/writing/blog-checker/SKILL.md) |
| [`concept-fable`](skills/writing/concept-fable/SKILL.md) | Explain advanced concepts through a Chinese three-stage fable. | Story, reveal, theory mapping, boundaries, and reading directions. | [SKILL](skills/writing/concept-fable/SKILL.md) |
| [`document-clarifier`](skills/writing/document-clarifier/SKILL.md) | Revise completed prose for clarity while preserving facts and established domain terms. | Clearer text or a file copy that preserves the original. | [SKILL](skills/writing/document-clarifier/SKILL.md) |
| [`douban-dice-review`](skills/writing/douban-dice-review/SKILL.md) | Write a compact Douban-style film review with six theory dice. | Dice summary plus six-sentence review. | [SKILL](skills/writing/douban-dice-review/SKILL.md) |
| [`kane-translate`](skills/writing/kane-translate/SKILL.md) | Translate articles and documents in quick, normal, or refined mode. | A translation tailored to the target language, audience, style, and optional glossary. | [SKILL](skills/writing/kane-translate/SKILL.md) |
| [`merge-drafts`](skills/writing/merge-drafts/SKILL.md) | Merge several drafts into one polished article. | Final merged article plus merge report. | [SKILL](skills/writing/merge-drafts/SKILL.md) |
| [`subtext-article`](skills/writing/subtext-article/SKILL.md) | Convert subtitles, ASR outputs, or transcripts into a faithful Chinese article. | A package folder with normalized transcript, draft, self-check, and final article. | [SKILL](skills/writing/subtext-article/SKILL.md) |

### Product and engineering workflows (4)

| Skill | Use When | Output | Docs |
| ----- | -------- | ------ | ---- |
| [`github-reuse-scout`](skills/engineering/github-reuse-scout/SKILL.md) | Search GitHub for reusable open-source projects before building and decide whether to fork, reference, or build without reuse. | `.reuse/reuse-plan.md` reuse decision and migration ledger. | [SKILL](skills/engineering/github-reuse-scout/SKILL.md) |
| [`it-system-skill-distiller`](skills/engineering/it-system-skill-distiller/SKILL.md) | Distill an IT business system into an AI-readable capability package. | Validated `distilled/` package structure. | [SKILL](skills/engineering/it-system-skill-distiller/SKILL.md) |
| [`requirement-explorer`](skills/engineering/requirement-explorer/SKILL.md) | Turn raw business needs into a standard software requirements document. | Markdown requirements document with Mermaid flows and a completeness check. | [SKILL](skills/engineering/requirement-explorer/SKILL.md) |
| [`simplify-codebase`](skills/engineering/simplify-codebase/SKILL.md) | Audit or simplify codebases by removing accidental complexity with reachability and contract evidence. | Ranked proof records, or a validated simplification with an operation receipt. | [SKILL](skills/engineering/simplify-codebase/SKILL.md) |

### Technical explanation (1)

| Skill | Use When | Output | Docs |
| ----- | -------- | ------ | ---- |
| [`kane-explainer`](skills/explanation/kane-explainer/SKILL.md) | Explain technical specifications, RFCs, design proposals, or workspace changes in plain language. | A self-contained Chinese technical explanation with behavior and schema changes. | [SKILL](skills/explanation/kane-explainer/SKILL.md) |

### Publishing and delivery assurance (1)

| Skill | Use When | Output | Docs |
| ----- | -------- | ------ | ---- |
| [`git-commit-push`](skills/delivery/git-commit-push/SKILL.md) | Stage only the current task's changes, create a Conventional Commit, and push only when requested. | Verified commit and optional push result with unrelated changes preserved. | [SKILL](skills/delivery/git-commit-push/SKILL.md) |

## License

MIT. See [LICENSE](LICENSE).
