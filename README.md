# ![Kane Skills](assets/brand/kane-skills-armory-logo.svg)

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Skills](https://img.shields.io/badge/Skills-31-green.svg)](skills/)

> Languages: [English README](README.md) | [中文 README](README-CN.md)

Reusable Agent Skills created by Kane.

This repository is a public, self-contained skill library. Each package is inspectable, copyable, and adaptable without depending on private project configuration.

[Browse the skill catalog](https://kanelogger.github.io/kane-skills/en/)

---

## What this repo is

- A collection of **Agent Skills** packaged as independent, self-contained units.
- Every skill ships with a `SKILL.md` and a `README.md` (a quick public reference).
- Optional extras include `scripts/`, `assets/`, `evals/`, `references/`, and `agents/` when the skill needs them.
- Skills should remain usable when copied individually, so Chinese typography defaults live inside each relevant skill. The small amount of intentional duplication avoids a dependency on a repository-level shared file.

## Skills

The 31 skills are organized into 7 categories under `skills/<category>/<skill-name>/`. Each skill belongs to exactly one category based on the user's immediate primary task, not the input source. To use a skill separately, copy or install its package directory containing `SKILL.md`.

Skills can be invoked by name. In Codex, type `$skill-name`, for example `$kane-translate`. Automatic selection depends on each skill's invocation policy and the runtime.

### reading — Reading and explanation (2)

| Skill | Use When | Output | Docs |
| ----- | -------- | ------ | ---- |
| [`article-analyzer`](skills/reading/article-analyzer/SKILL.md) | Analyze articles, papers, reports, or long-form arguments. | A folder of Markdown analysis files plus `99-summary.md`. | [README](skills/reading/article-analyzer/README.md) |
| [`kane-explainer`](skills/reading/kane-explainer/SKILL.md) | Invoke explicitly to explain articles, complex topics, or technical changes visually. | An illustration-led HTML explainer, a step-by-step interactive lesson, or a diagram suited to the relationships. | [README](skills/reading/kane-explainer/README.md) |

### creation — Creation and composition (3)

| Skill | Use When | Output | Docs |
| ----- | -------- | ------ | ---- |
| [`concept-fable`](skills/creation/concept-fable/SKILL.md) | Explain advanced concepts through a Chinese three-stage fable. | Story, reveal, theory mapping, boundaries, and reading directions. | [README](skills/creation/concept-fable/README.md) |
| [`douban-dice-review`](skills/creation/douban-dice-review/SKILL.md) | Write a compact Douban-style film review with six theory dice. | Dice summary plus six-sentence review. | [README](skills/creation/douban-dice-review/README.md) |
| [`subtext-article`](skills/creation/subtext-article/SKILL.md) | Convert subtitles, ASR outputs, or transcripts into a faithful Chinese article. | A folder with the source copy, readable transcript, and same-named Markdown article. | [README](skills/creation/subtext-article/README.md) |

### editing — Manuscript editing and review (4)

| Skill | Use When | Output | Docs |
| ----- | -------- | ------ | ---- |
| [`document-clarifier`](skills/editing/document-clarifier/SKILL.md) | Revise completed prose for clarity while preserving facts and established domain terms. | Clearer text or a file copy that preserves the original. | [README](skills/editing/document-clarifier/README.md) |
| [`kane-translate`](skills/editing/kane-translate/SKILL.md) | Translate articles and documents with analysis first and optional review and polishing. | A translation tailored to the target language, audience, style, and optional glossary. | [README](skills/editing/kane-translate/README.md) |
| [`merge-drafts`](skills/editing/merge-drafts/SKILL.md) | Merge several drafts into one polished article. | Final merged article plus merge report. | [README](skills/editing/merge-drafts/README.md) |
| [`blog-checker`](skills/editing/blog-checker/SKILL.md) | Review Chinese technical blog posts. | Structured diagnostic review. | [README](skills/editing/blog-checker/README.md) |

### assets — Asset acquisition and processing (8)

| Skill | Use When | Output | Docs |
| ----- | -------- | ------ | ---- |
| [`kane-article-illustrator`](skills/assets/kane-article-illustrator/SKILL.md) | Clarify missing deliverable, audience, style, dimensions, and count together, then use the answers to shape the illustrations. | An illustration plan, consistent prompts, or reviewed images, with an optional illustrated Markdown copy; the source is preserved by default. | [README](skills/assets/kane-article-illustrator/README.md) |
| [`kane-cover-image`](skills/assets/kane-cover-image/SKILL.md) | Turn an article, summary, title, or topic into a cover centered on its main message, clarifying missing requirements together. | A cover brief, complete standalone prompts, or reviewed images with their full prompts. | [README](skills/assets/kane-cover-image/README.md) |
| [`kane-infographic`](skills/assets/kane-infographic/SKILL.md) | Organize articles, notes, structured data, or topic materials into standalone infographics, clarifying missing requirements together. | An infographic plan with copy and layout, complete standalone prompts, reviewed images, or both prompts and images. | [README](skills/assets/kane-infographic/README.md) |
| [`kane-xhs-images`](skills/assets/kane-xhs-images/SKILL.md) | Turn articles, notes, or topic materials into graphic-led Xiaohongshu sharing images, clarifying missing requirements together. | A single-image or series plan with page copy, visual relationships, and composition; complete standalone prompts, reviewed images, or both. | [README](skills/assets/kane-xhs-images/README.md) |
| [`kane-bilibili-transcript`](skills/assets/kane-bilibili-transcript/SKILL.md) | Fetch existing Bilibili captions by video URL or ID, with part and track selection. | A new folder with metadata, raw subtitle JSON, and Markdown/SRT/VTT/text/JSON export. | [README](skills/assets/kane-bilibili-transcript/README.md) |
| [`kane-youtube-transcript`](skills/assets/kane-youtube-transcript/SKILL.md) | Fetch existing YouTube captions by video URL or ID, with language and caption-type selection. | A new folder with metadata, raw JSON3, and Markdown/SRT/VTT/text/JSON export. | [README](skills/assets/kane-youtube-transcript/README.md) |
| [`kane-compress-image`](skills/assets/kane-compress-image/SKILL.md) | Compress local static images into WebP, PNG, or JPEG, individually or in batches. | New images with originals preserved, plus size-reduction and failure reports. | [README](skills/assets/kane-compress-image/README.md) |
| [`kane-url-to-markdown`](skills/assets/kane-url-to-markdown/SKILL.md) | Save webpage Markdown from existing reader tools or capture rendered content through browser tools. | A new Markdown file with source metadata, article structure and remote image links. | [README](skills/assets/kane-url-to-markdown/README.md) |

### publishing — Content publishing (3)

| Skill | Use When | Output | Docs |
| ----- | -------- | ------ | ---- |
| [`kane-post-to-wx`](skills/publishing/kane-post-to-wx/SKILL.md) | Prepare or publish an existing article or image post for a WeChat Official Account. | Local preview, verified draft, or publication record. | [README](skills/publishing/kane-post-to-wx/README.md) |
| [`kane-post-to-x`](skills/publishing/kane-post-to-x/SKILL.md) | Prepare an existing X post, quote post, or Markdown Article and hand it off for publication. | Local preview, verified draft, or verified publication link. | [README](skills/publishing/kane-post-to-x/README.md) |
| [`kane-post-to-weibo`](skills/publishing/kane-post-to-weibo/SKILL.md) | Prepare a Weibo post with text, images, or video, or a headline article from Markdown. | Local preview or a populated editor for the user to review and publish. | [README](skills/publishing/kane-post-to-weibo/README.md) |

### planning — Requirements exploration and solution selection (4)

| Skill | Use When | Output | Docs |
| ----- | -------- | ------ | ---- |
| [`requirement-explorer`](skills/planning/requirement-explorer/SKILL.md) | Turn raw business needs into a standard software requirements document. | Markdown requirements document with Mermaid flows and a completeness check. | [README](skills/planning/requirement-explorer/README.md) |
| [`kane-clarify-questions`](skills/planning/kane-clarify-questions/SKILL.md) | Invoke explicitly to fill important context gaps in a general task through concrete, neutral questions, with at most two clarification rounds by default. | Confirmed facts, adopted assumptions, and unresolved items with their effects on next steps. | [README](skills/planning/kane-clarify-questions/README.md) |
| [`github-reuse-scout`](skills/planning/github-reuse-scout/SKILL.md) | Search GitHub for reusable open-source projects before building and decide whether to fork, reference, or build without reuse. | `.reuse/reuse-plan.md` reuse decision and migration ledger. | [README](skills/planning/github-reuse-scout/README.md) |
| [`kane-task-planner`](skills/planning/kane-task-planner/SKILL.md) | Invoke only when the user explicitly names the skill to plan a task before execution, prioritizing available skills and recommending scripts, subagents, or new skills where useful. | A brief, high-level execution plan with methods, reasons, expected outputs, and necessary dependencies; recommendations only. | [README](skills/planning/kane-task-planner/README.md) |

### engineering — Development, maintenance, and delivery (7)

| Skill | Use When | Output | Docs |
| ----- | -------- | ------ | ---- |
| [`kane-agent-bootstrap`](skills/engineering/kane-agent-bootstrap/SKILL.md) | Only when explicitly invoked: initialize an existing project for Agent development, or retrieve and incrementally maintain context during later tasks. | Project guidance, environment declarations, an on-demand context index, validation evidence and guarded recovery receipts. | [README](skills/engineering/kane-agent-bootstrap/README.md) |
| [`it-system-skill-distiller`](skills/engineering/it-system-skill-distiller/SKILL.md) | Distill an IT business system into an AI-readable capability package. | Validated `distilled/` package structure. | [README](skills/engineering/it-system-skill-distiller/README.md) |
| [`simplify-codebase`](skills/engineering/simplify-codebase/SKILL.md) | Audit or simplify codebases by removing accidental complexity with reachability and contract evidence. | Ranked proof records, or a validated simplification with an operation receipt. | [README](skills/engineering/simplify-codebase/README.md) |
| [`kane-migrate-to-rust`](skills/engineering/kane-migrate-to-rust/SKILL.md) | Invoke explicitly to migrate a GitHub repository or local legacy codebase to Safe Rust, with output parity checks and optional LLVM PGO. | Rust workspace, architectural blueprint, measured migration telemetry, and an interactive HTML report. | [README](skills/engineering/kane-migrate-to-rust/README.md) |
| [`git-commit-push`](skills/engineering/git-commit-push/SKILL.md) | Choose Quick, Comprehensive, or Deep mode, then commit only or commit and push; Quick uses the diff, Comprehensive reviews changes, and Deep adds code review and relevant checks. | Conventional Commit and Git status; verification and rollback records in Comprehensive and Deep modes, plus push status when selected. | [README](skills/engineering/git-commit-push/README.md) |
| [`kane-task-retro`](skills/engineering/kane-task-retro/SKILL.md) | Retrospect on a single task or Agent collaboration using delivery evidence. | A short retrospective with up to one next action and a way to verify it. | [README](skills/engineering/kane-task-retro/README.md) |
| [`kane-task-cleanup`](skills/engineering/kane-task-cleanup/SKILL.md) | Invoke explicitly at closeout; defaults to verified one-off temporary files from the current task, with broader cleanup or a read-only inventory on request. | Verified deletions, retained deliverables, skipped items, and any authorized background task shutdowns. | [README](skills/engineering/kane-task-cleanup/README.md) |

## License

MIT. See [LICENSE](LICENSE).
