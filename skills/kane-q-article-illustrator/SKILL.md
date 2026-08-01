---
name: kane-q-article-illustrator
description: Use Kane Q IP as the fixed narrator/visual anchor for article illustrations. Trigger when the user wants to illustrate an article, add images to markdown, generate article visuals, or create comics/infographics based on the confirmed Kane Q character assets.
---

# Kane Q Article Illustrator

Use this skill to generate article illustrations that preserve the confirmed Kane Q character while following the upstream `baoyu-article-illustrator` workflow.

## Required Inputs

- Article content or an article file path.
- The confirmed Kane Q IP assets bundled in this skill:
  - `assets/kane-q/front-full-body.png`
  - `assets/kane-q/three-view.png`
  - `assets/kane-q/expressions/01-v-sign.png` through `08-starting.png`

If no article is provided, ask for the article before generating an outline or images.

## Workflow

1. Read this skill first.
2. Read `references/kane-ip-usage.md` before analyzing the article.
3. Read `references/IP_DNA.md` when a generation request needs stricter character recovery, new poses, or style debugging.
4. Use `/Users/kanehua/project/hk-skills/warehouse/adapted/baoyu-article-illustrator/SKILL.md` as the upstream workflow contract.
5. Follow the upstream pre-check, analysis, confirmation, outline, prompt-file, batch generation, and finalize rules.
6. Inject Kane Q character rules into every illustration prompt that contains a narrator, guide, emotion marker, or human figure.
7. Save every prompt file before image generation, exactly as required by upstream `baoyu-article-illustrator`.
8. Use raster image generation only. Do not replace the image backend with HTML, SVG, canvas, or screenshots.

## Default Visual Strategy

- Default type: `mixed`, selecting `framework`, `scene`, `comparison`, `flowchart`, or `infographic` per article section.
- Default density: `per-section` for long articles, `balanced` for short articles.
- Default style: simplified flat hand-drawn comic infographic.
- Default palette: warm off-white background, low-saturation flat colors, dark brown/black linework.
- Default language: match the article language.

Kane Q should appear only where he improves comprehension: as narrator, pointer, emotional reaction, or action demonstrator. Do not force the character into purely data-dense charts where it reduces readability.

## Confirmation

Use the upstream confirmation policy. Do not start outline or generation until the user confirms settings, unless the current request explicitly says `直接生成`, `不用确认`, `跳过确认`, or equivalent.

When confirming, include one Kane-specific line:

```text
IP: Kane Q fixed character, using bundled three-view and expression pack as references.
```

## Prompt Construction

For each illustration prompt:

- Include the article-specific visual purpose, labels, terms, numbers, quotes, and section position from the upstream workflow.
- Include the Kane Q prompt capsule from `references/kane-ip-usage.md` when Kane appears.
- Attach `assets/kane-q/three-view.png` as the primary direct character reference when the backend supports references.
- Attach one expression image only when it matches the target pose or emotion.
- Keep all on-character text limited to the small left-chest `Kane.` mark.

## Quality Gate

Before finalizing, check:

- Kane still has short black hair, black square-rounded glasses, white T-shirt, small left-chest `Kane.`, dark pants, light shoes.
- The result uses the confirmed Q-version character, not a redesigned avatar.
- The article visual remains understandable without relying on decorative character placement.
- No extra mascot, pet, unrelated person, hoodie, hat, backpack, camera, trekking pole, gloves, large T-shirt print, or long chest text appears.
- Any generated text inside the image is legible. If not, regenerate from a corrected prompt; do not patch text programmatically.

## Output

Return the upstream final report plus:

```text
IP: kane-q-article-illustrator
Character references used: three-view plus selected expression assets
IP QC: pass/fail with brief reason
```
