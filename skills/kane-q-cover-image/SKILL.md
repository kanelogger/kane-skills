---
name: kane-q-cover-image
description: Use Kane Q IP as the fixed visual anchor for article cover images, social cover art, thumbnails, and branded comic-style hero images. Trigger when the user wants a cover image, 封面图, 文章封面, 公众号封面, social thumbnail, hero cover, or make cover using the confirmed Kane Q character assets. This skill wraps baoyu-cover-image and must preserve Kane Q identity through bundled three-view and expression references.
---

# Kane Q Cover Image

Generate article cover images that combine the upstream `baoyu-cover-image` workflow with the confirmed Kane Q IP assets.

## First Hard Rule

- Final cover images must be generated through raster image generation or image editing.
- Do not replace the image backend with HTML, SVG, canvas, slides, screenshots, or code-rendered artwork.
- Save the full final prompt before generation, as required by upstream `baoyu-cover-image`.

## Required Inputs

- Article title, article content, markdown file, topic brief, or cover concept.
- The bundled Kane Q assets:
  - `assets/kane-q/front-full-body.png`
  - `assets/kane-q/three-view.png`
  - `assets/kane-q/expressions/01-v-sign.png` through `08-starting.png`

If no title, article, topic, or concept is provided, ask for it before analyzing cover dimensions.

## Required Reading

Read these before generation:

1. `references/kane-cover-usage.md`
2. `references/IP_DNA.md` when a request needs strict character recovery, new poses, or style debugging
3. `/Users/kanehua/project/hk-skills/warehouse/adapted/baoyu-cover-image/SKILL.md`

Treat upstream `baoyu-cover-image` as the workflow contract for preferences, reference handling, 5-dimensional cover configuration, confirmation, prompt persistence, backend choice, generation, and final reporting.

## Workflow

1. Follow upstream Step 0 first: load `EXTEND.md` preferences for `baoyu-cover-image`. If not found, run the upstream first-time setup before other steps.
2. Analyze the article/topic using upstream Step 1: topic, tone, keywords, title language, visual metaphors, output directory, and reference images.
3. Recommend or auto-select the upstream cover dimensions:
   - type: `hero`, `conceptual`, `scene`, `metaphor`, `minimal`, or `typography`
   - palette, rendering, text level, mood, font, aspect
4. Bias recommendations toward Kane-compatible cover design:
   - Type: `hero`, `scene`, `conceptual`, or `metaphor` when Kane appears.
   - Palette: `warm`, `macaron`, `pastel`, `retro`, or `elegant` for friendly comic covers.
   - Rendering: `hand-drawn`, `flat-vector`, or `screen-print` for stable Kane Q identity.
   - Text: `title-only` or `title-subtitle`; use `none` when the user wants a pure visual cover.
   - Mood: `balanced` by default; `bold` for launch/opinion pieces; `subtle` for reflective essays.
5. Confirm options using upstream confirmation policy. Do not generate until the user confirms, unless the current request explicitly says `直接生成`, `不用确认`, `跳过确认`, `按默认出图`, `--quick`, or equivalent.
6. Save the full cover prompt under the upstream output structure before generation.
7. If Kane appears, append the Kane Q cover lock from `references/kane-cover-usage.md`.
8. Use `assets/kane-q/three-view.png` as the primary direct character reference when the chosen backend supports references. Use one expression image only when it matches the cover emotion or pose.
9. Generate the raster cover through the resolved backend.
10. Run the Kane Q and cover quality gates before finalizing.

## Default Cover Strategy

- Default type: `hero` for people-centered covers; `conceptual` for abstract essays; `metaphor` for opinion or analysis pieces.
- Default rendering: `hand-drawn` or `flat-vector`.
- Default palette: warm off-white base with low-saturation accents, unless the article tone calls for stronger contrast.
- Default text: `title-only`.
- Default aspect: upstream default or user-specified platform size.
- Kane Q role: main visual anchor, small author/narrator figure, reaction figure, or action demonstrator.

Do not force Kane into typography-only or minimal covers when the title composition is stronger without a character. If Kane is omitted intentionally, still use the upstream cover workflow and report that no character reference was used.

## Confirmation Line

When asking for confirmation, include this line:

```text
IP: Kane Q fixed character, using bundled three-view and expression pack as references when Kane appears.
```

## Prompt Construction

For each saved prompt:

- Follow upstream `baoyu-cover-image` prompt-file requirements.
- Include the selected type, palette, rendering, text level, mood, font, aspect ratio, title, subtitle, and visual metaphor.
- If Kane appears, append the `Kane Q Cover Lock` from `references/kane-cover-usage.md`.
- Keep all character clothing text limited to the small left-chest `Kane.` mark.
- Put title/subtitle in the cover typography area, not on Kane's T-shirt.
- Preserve cover readability: strong focal point, 40-60% breathing room, title-safe area, and clear hierarchy.
- If the generated title/subtitle is garbled or weak, regenerate from a corrected prompt or switch to lower-text/no-title. Do not patch text programmatically.

## Quality Gate

Before finalizing, check:

- Kane still matches the bundled three-view: short black hair, black square-rounded glasses, round-square face, white T-shirt, small left-chest `Kane.`, dark pants, light shoes.
- The cover uses the confirmed Kane Q character, not a redesigned avatar.
- No extra mascot, pet, unrelated person, hoodie, hat, backpack, camera, trekking pole, gloves, large T-shirt print, or long chest text appears.
- Kane's pose supports the cover concept and does not compete with the title.
- The cover follows the selected upstream dimensions: type, palette, rendering, text level, mood, font, and aspect.
- Title/subtitle text is legible enough to publish, or the image is regenerated.
- The final image came from raster image generation or image editing, not HTML/SVG/canvas/screenshot rendering.

## Output

Return the upstream final report plus:

```text
IP: kane-q-cover-image
Character references used: three-view plus selected expression assets, or none if Kane was intentionally omitted
IP QC: pass/fail with brief reason
```

## Bundled References

- `references/kane-cover-usage.md` - operational character usage, asset manifest, prompt injection block, and QC
- `references/IP_DNA.md` - canonical Kane Q character profile
- `references/handoff.md` - original handoff from the IP profile
