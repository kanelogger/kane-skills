---
name: chinese-doc-formatter
description: >-
  Format Chinese Markdown or plain-text documents for readable structure and consistent typography while preserving
  the author's content. Use when asked to format, beautify, lay out, or normalize a Chinese document. It can preserve
  existing Markdown, improve its layout, or report issues only. Do not use for substantive rewriting or fact checking.
---

# Chinese Document Formatter

Make Chinese documents easier to scan and typographically consistent. Preserve the author's words, claims, data, tone, and intent. Only change presentation, plus an unmistakable typo when it cannot be confused with a technical term; report every such correction.

## Choose a mode

- **Layout and typography (default for plain text):** structure plain text as Markdown only where its existing content clearly supports headings, lists, code, or tables, then apply the typography defaults.
- **Improve Markdown layout:** retain every sentence and its order while clarifying existing structure with headings, emphasis, lists, tables, code formatting, and blockquotes. Add no new claims or summaries.
- **Typography only:** preserve the existing Markdown structure and adjust spacing, punctuation, numeric typography, and obvious Markdown spacing issues.
- **Audit only:** when requested, report issues and suggested corrections without changing the source.

Infer the mode from the request. If the user asks only to format an existing Markdown file and it is unclear whether structural edits are welcome, ask whether to preserve its structure or improve the layout. Skip the question when the request makes the mode clear.

For files, read the complete source, then save a sibling copy named `<stem>-formatted.<ext>`. When the input is plain text and layout mode adds Markdown syntax, use `<stem>-formatted.md`. If the destination exists, select an unused numeric suffix; never overwrite or move an existing file unless the user explicitly asks. Edit in place only on explicit request. For pasted text, return the formatted content in chat unless a file is requested.

## Analyze, format, compare

1. Identify whether the input is plain text or already Markdown; note frontmatter, headings, lists, tables, quotes, links, code, and technical notation.
2. Map the document's existing argument and section boundaries. Find only structure already present: topic shifts, clearly parallel items, ordered steps, comparisons, key conclusions, and literal commands or identifiers.
3. Apply the selected mode. Use headings for real topic changes, lists for clearly parallel or sequential material, and tables only when the relationships and values are explicit. Use bold sparingly for existing key points. Mark commands, paths, identifiers, and short code as code only when their literal boundaries are certain.
4. Apply [the typography rules](references/style-rules.md), respecting official spellings, exact quotations, and explicit house style.
5. Compare the result with the source. Confirm that no sentence, claim, figure, condition, quotation, or citation was added, deleted, paraphrased, or moved. Check protected Markdown syntax and report actual changes by category.

## Preserve source and syntax

- Preserve fenced and inline code, commands, logs, URLs, link destinations, HTML, math, identifiers, and machine-readable text exactly. Format prose around them; do not run blind replacements over them.
- Preserve direct quotations, including their spelling and punctuation. Do not silently normalize the wording or typography inside a quotation.
- Preserve YAML frontmatter fields, values, comments, and user ordering. Do not add a title, slug, summary, description, or cover metadata unless requested.
- Do not invent missing attribution, acronym expansions, headings that imply new claims, or data needed to complete a table. Flag issues that cannot be safely repaired.
- Do not add/delete prose, shorten it, rewrite sentences, or change the author's voice during a formatting task. Sentence-level clarity and wording changes are optional suggestions unless the user asks for copyediting.
- Avoid over-formatting: do not bold every paragraph, make a heading for every point, or turn nuanced prose into a table when that loses qualifications.

## Output

For a file, report the formatted copy path and a concise change summary: typography, headings, lists, tables, emphasis, code formatting, and any explicit typo fixes. Omit categories with no changes. For audit-only mode, give locations, issue, and suggested correction. State any unresolved choice without implying it was fixed.
