# subtext-article

Convert subtitles, ASR outputs, transcript dumps, and copied caption text into a faithful long-form Chinese article.

## Use When

- The source is video subtitles, Bilibili AIsubtitle JSON, YouTube transcript text, SRT/VTT/ASS/SSA/LRC, Whisper-style JSON, podcast transcript, or spoken draft.
- The user wants a publishable Chinese article while preserving source claims, order, data, examples, and key quotes.

## Output

For a file input, the skill creates a package folder:

```text
<source-stem>_article/
  00-source.<ext>
  01-normalized.txt
  02-evidence-map.md
  03-draft.md
  04-self-check.md
  article.md
  manifest.json
```

## Install

```bash
./bin/hk-skill install https://github.com/kanelogger/kane-skills --subpath skills/subtext-article
```

## Public Notes

The bundled scripts normalize common subtitle and transcript formats. Public examples can be added later under `examples/` after checking that the source content is shareable.

