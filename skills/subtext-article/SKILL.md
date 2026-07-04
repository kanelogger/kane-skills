---
name: subtext-article
description: Convert Chinese video subtitles, ASR outputs, transcript dumps, Bilibili AIsubtitle JSON, YouTube transcripts, SRT/VTT/ASS/SSA/LRC files, Whisper-style JSON, podcast transcripts, spoken drafts, or copied caption text into a faithful long-form Chinese article. Use when the user asks to turn subtitles, subtext, transcript, video captions, B站字幕, YouTube字幕, ASR转写, 口语稿, 播客转写, or 视频文稿 into a publishable article with Title, Overview, and Markdown sections while preserving the original claims, order, data, examples, and key quotes.
---

# Subtext Article

Convert video subtitles into a complete Chinese article with high fidelity, strong readability, traceable intermediate artifacts, and no invented content.

## Core Contract

Preserve the source first. Keep the video's core claims, information, data, order, logic, examples, named entities, and key quotations. Do not add facts, outside context, interpretations, or "reasonable" completions that are not present in the transcript.

Rewrite for written Chinese. Remove filler words, repeated fragments, broken oral phrasing, speaker hesitation, live-stream housekeeping, and redundant transitions unless they carry meaning.

Rebuild article structure. Turn the transcript into a coherent article with an opening, detailed body sections, and a closing. Use thematic grouping and transitions, but keep the original argument chain traceable.

Leave a trail at every successful step. For file inputs, every successful output must be written into one package folder named from the input file stem plus `_article`, for example `中国稀土.md` -> `中国稀土_article/`. Do not scatter intermediate files in the working directory.

## Workflow

1. Identify the source family, not just the exact platform:
   - structured JSON: Bilibili AIsubtitle, Whisper/Faster-Whisper/WhisperX, ASR vendor exports, caption arrays, `segments`, `utterances`, `captions`, `subtitles`, `events`, `items`, `words`, or nested objects containing text fields;
   - subtitle files: SRT, WebVTT/VTT, ASS/SSA, LRC, YouTube timedtext XML/TTML, or copied transcript dumps with timestamps;
   - plain transcript text: raw ASR paragraphs, copied captions, podcast transcripts, interview notes, or spoken drafts.
2. For file inputs, initialize the article package first. Prefer `scripts/prepare_article_package.py <input-file>` to create `{input-stem}_article/`, copy the original source, generate `01-normalized.txt`, and write `manifest.json`.
3. Normalize the transcript before writing. Use `01-normalized.txt` as the default working text. If `scripts/normalize_subtitle.py` misses a new schema, inspect the file shape, extract the spoken text manually, and still save the successful normalized result as `01-normalized.txt` inside the package.
4. Read the full normalized transcript before drafting. For long transcripts, process in chunks and write `02-evidence-map.md` in the package with:
   - main thesis and conclusion;
   - topic sequence;
   - key numbers, dates, names, quoted phrases, causal links, and examples;
   - sections that are promotions, chat acknowledgements, or live-stream housekeeping.
5. Draft the article from the evidence map, not from memory. Preserve all important details while compressing oral repetition. Save the first complete draft as `03-draft.md`.
6. Self-check against the transcript before final output and save the check as `04-self-check.md`:
   - no fabricated facts;
   - no important claim, data point, example, or turn in logic removed;
   - no remaining timestamp noise or obvious oral filler;
   - article length is about 70%-90% of the useful transcript length unless the user asks otherwise.
7. Save the final article as `article.md` in the package. Final chat response should report the package path and key artifacts, not paste the full article unless the user asks for inline output.

## Package Output

Default package layout for `/path/to/source.md`:

```text
/path/to/source_article/
├── 00-source.md
├── 01-normalized.txt
├── 02-evidence-map.md
├── 03-draft.md
├── 04-self-check.md
├── article.md
└── manifest.json
```

All successfully produced files belong in this folder. If a later step fails, keep the earlier successful files and update `manifest.json` or state the failed step in the final response.

The final article is Markdown:

```markdown
Title: [accurate, attractive title]

Overview: [150-250 Chinese characters summarizing the core topic and main conclusion]

## [Section Title]

[Detailed prose paragraphs]
```

Use `##` for body sections. Keep the article continuous. Do not use bullets, numbered lists, tables, commentary, or process notes in the final article unless the user explicitly asks for them.

## Handling Details

Keep the original tone category, then raise it into polished written Chinese: professional, explanatory, conversational, analytical, or popular-science as appropriate.

When the video contains a method, framework, workflow, or mental model, rewrite it as clear prose or reusable step-style explanation inside paragraphs. Avoid list formatting unless the user requests a list.

When the transcript contains multiple speakers, merge their exchange into a single coherent article voice. Preserve disagreement, correction, or attribution when it affects the meaning.

When the source mixes Simplified and Traditional Chinese, output Simplified Chinese by default unless the user asks otherwise. Preserve official names, quotes, and region-specific terms when conversion would distort meaning.

When the transcript includes sponsorship, subscriptions, super chats, greetings, likes, or end-screen calls to action, remove them unless they contain substantive content requested by the user.

If the transcript is incomplete, corrupted, or too ambiguous to preserve meaning, state the limitation briefly before writing or ask for the missing source if the gap blocks faithful conversion.

## Bundled Resources

- `scripts/normalize_subtitle.py`: extract spoken text from common JSON, XML, SRT, VTT, ASS/SSA, LRC, YouTube transcript dumps, ASR outputs, or plain subtitle files.
- `scripts/prepare_article_package.py`: create the `{input-stem}_article/` package, copy the source, generate `01-normalized.txt`, and write `manifest.json`.

Public examples can be added under `examples/` after checking that the source content is shareable. Examples are calibration material, not coverage limits.
