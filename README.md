# Kane Skills

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Skills](https://img.shields.io/badge/Skills-17-green.svg)](skills/)

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

The 17 skills are organized into 6 categories under `skills/<category>/<skill-name>/`. Each skill belongs to exactly one category based on the user's immediate primary task, not the input source. To use a skill separately, copy or install its package directory containing `SKILL.md`.

### reading — Reading and explanation (2)

| Skill | Use When | Output | Docs |
| ----- | -------- | ------ | ---- |
| [`article-analyzer`](skills/reading/article-analyzer/SKILL.md) | Analyze articles, papers, reports, or long-form arguments. | A folder of Markdown analysis files plus `99-summary.md`. | [SKILL](skills/reading/article-analyzer/SKILL.md) |
| [`kane-explainer`](skills/reading/kane-explainer/SKILL.md) | Explain technical specifications, RFCs, design proposals, or workspace changes in plain language. | A self-contained Chinese technical explanation with behavior and schema changes. | [SKILL](skills/reading/kane-explainer/SKILL.md) |

### creation — Creation and composition (3)

| Skill | Use When | Output | Docs |
| ----- | -------- | ------ | ---- |
| [`concept-fable`](skills/creation/concept-fable/SKILL.md) | Explain advanced concepts through a Chinese three-stage fable. | Story, reveal, theory mapping, boundaries, and reading directions. | [SKILL](skills/creation/concept-fable/SKILL.md) |
| [`douban-dice-review`](skills/creation/douban-dice-review/SKILL.md) | Write a compact Douban-style film review with six theory dice. | Dice summary plus six-sentence review. | [SKILL](skills/creation/douban-dice-review/SKILL.md) |
| [`subtext-article`](skills/creation/subtext-article/SKILL.md) | Convert subtitles, ASR outputs, or transcripts into a faithful Chinese article. | A folder with the source copy, readable transcript, and same-named Markdown article. | [SKILL](skills/creation/subtext-article/SKILL.md) |

### editing — Manuscript editing and review (4)

| Skill | Use When | Output | Docs |
| ----- | -------- | ------ | ---- |
| [`document-clarifier`](skills/editing/document-clarifier/SKILL.md) | Revise completed prose for clarity while preserving facts and established domain terms. | Clearer text or a file copy that preserves the original. | [SKILL](skills/editing/document-clarifier/SKILL.md) |
| [`kane-translate`](skills/editing/kane-translate/SKILL.md) | Translate articles and documents with analysis first and optional review and polishing. | A translation tailored to the target language, audience, style, and optional glossary. | [SKILL](skills/editing/kane-translate/SKILL.md) |
| [`merge-drafts`](skills/editing/merge-drafts/SKILL.md) | Merge several drafts into one polished article. | Final merged article plus merge report. | [SKILL](skills/editing/merge-drafts/SKILL.md) |
| [`blog-checker`](skills/editing/blog-checker/SKILL.md) | Review Chinese technical blog posts. | Structured diagnostic review. | [SKILL](skills/editing/blog-checker/SKILL.md) |

### assets — Asset acquisition and processing (3)

| Skill | Use When | Output | Docs |
| ----- | -------- | ------ | ---- |
| [`kane-bilibili-transcript`](skills/assets/kane-bilibili-transcript/SKILL.md) | Fetch existing Bilibili captions by video URL or ID, with part and track selection. | A new folder with metadata, raw subtitle JSON, and Markdown/SRT/VTT/text/JSON export. | [SKILL](skills/assets/kane-bilibili-transcript/SKILL.md) |
| [`kane-youtube-transcript`](skills/assets/kane-youtube-transcript/SKILL.md) | Fetch existing YouTube captions by video URL or ID, with language and caption-type selection. | A new folder with metadata, raw JSON3, and Markdown/SRT/VTT/text/JSON export. | [SKILL](skills/assets/kane-youtube-transcript/SKILL.md) |
| [`kane-compress-image`](skills/assets/kane-compress-image/SKILL.md) | Compress local static images into WebP, PNG, or JPEG, individually or in batches. | New images with originals preserved, plus size-reduction and failure reports. | [SKILL](skills/assets/kane-compress-image/SKILL.md) |

### planning — Requirements exploration and solution selection (2)

| Skill | Use When | Output | Docs |
| ----- | -------- | ------ | ---- |
| [`requirement-explorer`](skills/planning/requirement-explorer/SKILL.md) | Turn raw business needs into a standard software requirements document. | Markdown requirements document with Mermaid flows and a completeness check. | [SKILL](skills/planning/requirement-explorer/SKILL.md) |
| [`github-reuse-scout`](skills/planning/github-reuse-scout/SKILL.md) | Search GitHub for reusable open-source projects before building and decide whether to fork, reference, or build without reuse. | `.reuse/reuse-plan.md` reuse decision and migration ledger. | [SKILL](skills/planning/github-reuse-scout/SKILL.md) |

### engineering — Development, maintenance, and delivery (3)

| Skill | Use When | Output | Docs |
| ----- | -------- | ------ | ---- |
| [`it-system-skill-distiller`](skills/engineering/it-system-skill-distiller/SKILL.md) | Distill an IT business system into an AI-readable capability package. | Validated `distilled/` package structure. | [SKILL](skills/engineering/it-system-skill-distiller/SKILL.md) |
| [`simplify-codebase`](skills/engineering/simplify-codebase/SKILL.md) | Audit or simplify codebases by removing accidental complexity with reachability and contract evidence. | Ranked proof records, or a validated simplification with an operation receipt. | [SKILL](skills/engineering/simplify-codebase/SKILL.md) |
| [`git-commit-push`](skills/engineering/git-commit-push/SKILL.md) | Stage only the current task's changes, create a Conventional Commit, and push only when requested. | Verified commit and optional push result with unrelated changes preserved. | [SKILL](skills/engineering/git-commit-push/SKILL.md) |

## License

MIT. See [LICENSE](LICENSE).
