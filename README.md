# Kane Skills

Reusable Agent Skills created by Kane.

This repository is a public skill library. It contains self-contained skill packages that other users can install, inspect, copy, and adapt. It does not contain local manager state, runtime links, registry files, adapted mirrors, or private project configuration.

## Skills

| Skill                       | Use When                                                                        | Output                                                                             |
| --------------------------- | ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `prompt-optimizer`          | Turn vague requirements into copy-ready prompts.                                | A `.md` or `.xml` prompt file.                                                     |
| `request-refactor-plan`     | Turn a refactor idea into a small-commit implementation plan.                   | Refactor RFC / GitHub issue body.                                                  |
| `article-analyzer`          | Analyze articles, papers, reports, or long-form arguments.                      | A folder of Markdown analysis files plus `99-summary.md`.                          |
| `blog-checker`              | Review Chinese technical blog posts.                                            | Structured diagnostic review.                                                      |
| `skill-evaluator`           | Build repeatable evals for Agent Skills.                                        | Eval plan, scoring templates, and report structure.                                |
| `skill-optimizer`           | Audit and improve Agent Skills.                                                 | Audit reports, eval plans, mutation proposals, and gates.                          |
| `subtext-article`           | Convert subtitles, ASR outputs, or transcripts into a faithful Chinese article. | A package folder with normalized transcript, draft, self-check, and final article. |
| `merge-drafts`              | Merge several drafts into one polished article.                                 | Final merged article plus merge report.                                            |
| `concept-fable`             | Explain advanced concepts through a Chinese three-stage fable.                  | Story, reveal, theory mapping, boundaries, and reading directions.                 |
| `douban-dice-review`        | Write a compact Douban-style film review with six theory dice.                  | Dice summary plus six-sentence review.                                             |
| `session-achieve`           | Review a multi-turn conversation and extract reusable prompts.                  | Session review and prompt lessons.                                                 |
| `it-system-skill-distiller` | Distill an IT business system into an AI-readable capability package.           | Validated `distilled/` package structure.                                          |

## License

MIT. See [LICENSE](LICENSE).
