# Chinese Markdown and Typography Defaults

Use these as defaults for Chinese prose. Follow the user's or publisher's style when specified.

## Spacing and characters

- Put one half-width space between Chinese characters and adjacent Latin words or abbreviations: `在 LeanCloud 上使用 API`.
- Put one half-width space between Chinese prose and adjacent Arabic numerals: `花了 5000 元`.
- Put one half-width space between a number and a Latin unit symbol/name: `10 Gbps`、`20 TB`、`16 GB`、`25 °C`. Do not insert a space before `°` or `%`: `90°`、`15%`.
- Use half-width Arabic digits in prose. Use comma group separators for values above four digits when they are ordinary quantities (`12,000`); preserve identifiers, version strings, code, dates, and formats whose punctuation is meaningful.
- A Chinese product or proper name may define its own spacing and casing. Preserve its official form, such as `豆瓣FM`; do not split or recase names just to satisfy a general spacing rule.
- Do not require spaces around Markdown links as a blanket rule; this remains a house-style choice.

## Punctuation and quotation

- Use full-width Chinese punctuation in Chinese sentences and half-width punctuation in complete English sentences. Do not put a space before or after Chinese full-width punctuation.
- Keep punctuation inside an exact quotation unchanged. When Chinese prose quotes an English sentence, preserve the English sentence's half-width punctuation inside the quotation.
- In Simplified Chinese prose, use the document's established quote style. When none is established, prefer `“……”` with `‘……’` inside; `「……」` is also a published convention, so do not mass-convert between them.
- Avoid accidental runs of identical punctuation such as `！！！` or `？？`. Preserve deliberate mixed forms such as `？！` when they convey tone.
- Use a Chinese ellipsis `⋯⋯` in Chinese prose if an ellipsis is needed; do not combine it with `等`. Preserve ellipses in quotations, code, or source notation.
- Use `—` or `——` consistently for explanatory dashes according to the chosen publishing style. Keep hyphens in identifiers and technical terms intact.

## Markdown structure

- Use a coherent heading hierarchy and do not skip levels. Avoid duplicating a parent heading in its only child or adding headings where the topic has not changed.
- Do not put sentence-final punctuation at the end of a heading. Preserve headings mandated by an output template.
- Separate paragraphs with one blank line. Prefer one main point per paragraph; treat fixed line-count targets as guidance because display width varies.
- Turn prose into a list only when its items are already clearly parallel or sequential. Use ordered lists for order or ranking, unordered lists otherwise.
- Use a table for a comparison or structured values only when every row/column relationship is explicit and no qualification will be lost. Otherwise keep prose or lists.
- Use bold to surface a small number of existing conclusions or key terms. Do not add wording to create a takeaway.
- Preserve code fences and info strings; add a language tag only when the language is certain.
- Keep third-party quotations and images attributed when that information is supplied. Do not invent a source.

## Editorial suggestions

Shorter sentences, simpler phrasing, clear pronoun references, restrained modifiers, formal register, and consistent terminology are useful copyediting checks, but they can change voice or meaning. In formatting mode, list these as suggestions rather than rewriting the author's prose.

## High-risk transformations to avoid

- Do not replace ASCII quotes globally: apostrophes, inches, JSON/YAML, shell syntax, code, and English quotations use ASCII quotes legitimately.
- Do not run an automatic spacing or Markdown reserializer over the original file. If a formatter script is used, run it on the output copy, inspect the diff, and verify that frontmatter, tables, links, code, and quotes were preserved.
- Do not create title/summary/slug metadata or enforce the recommended software-manual section plan unless the user asks for that publishing workflow.