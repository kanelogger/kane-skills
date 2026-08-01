---
name: kane-q-infographic
description: Use Kane Q IP as the fixed narrator, explainer, and visual anchor for comic-style infographics. Trigger when the user wants an infographic, 信息图, 漫画信息图, 高密度信息大图, visual summary, concept diagram, framework map, or article-to-infographic output using the confirmed Kane Q character assets. This skill wraps baoyu-infographic and must preserve Kane Q identity through bundled three-view and expression references.
---

# Kane Q Infographic

Generate comic-style infographics that combine the upstream `baoyu-infographic` workflow with the confirmed Kane Q IP assets.

## First Hard Rule

- Final images must be generated through raster image generation or image editing.
- Do not replace the image backend with HTML, SVG, canvas, slides, screenshots, or code-rendered artwork.
- Save the full final prompt before generation, as required by upstream `baoyu-infographic`.

## Required Inputs

- Source content, topic, article, notes, markdown file, or pasted text for the infographic.
- The bundled Kane Q assets:
  - `assets/kane-q/front-full-body.png`
  - `assets/kane-q/three-view.png`
  - `assets/kane-q/expressions/01-v-sign.png` through `08-starting.png`

If no content is provided, ask for the content or topic before analyzing layout/style.

## Required Reading

Read these before generation:

1. `references/kane-ip-usage.md`
2. `references/IP_DNA.md` when a request needs strict character recovery, new poses, or style debugging
3. `/Users/kanehua/project/hk-skills/warehouse/adapted/baoyu-infographic/SKILL.md`

Treat upstream `baoyu-infographic` as the workflow contract for analysis, structured content, layout/style recommendation, confirmation, prompt persistence, backend choice, generation, and final reporting.

## Workflow

1. Analyze the user content using upstream Step 1 and save the same analysis artifacts.
2. Structure the content using upstream Step 2. Preserve facts, quotes, numbers, and source meaning.
3. Recommend 3-5 layout x style combinations using upstream layout/style galleries.
4. Bias recommendations toward Kane-compatible comic information design:
   - `comic-strip` for narrative, sequential reasoning, before/after scenes, or step stories.
   - `dense-modules` for high-density guides where Kane appears as small section markers.
   - `bento-grid` for overview explainers.
   - `bridge`, `linear-progression`, `hub-spoke`, or `comparison-matrix` when the content structure clearly calls for them.
   - Prefer `hand-drawn-edu`, `morandi-journal`, `craft-handmade`, `retro-popup-pop`, or `bold-graphic` when Kane appears.
5. Confirm options using upstream confirmation policy. Do not generate until the user confirms, unless the current request explicitly says `直接生成`, `不用确认`, `跳过确认`, `按默认出图`, `--no-confirm`, or equivalent.
6. Generate the prompt file under the upstream output structure. Add the Kane Q IP lock only when Kane appears in the image.
7. Use `assets/kane-q/three-view.png` as the primary direct character reference when the chosen backend supports references. Use one expression image only when it matches the target emotion or pose.
8. Generate the raster image through the resolved backend.
9. Run the Kane Q and infographic quality gates before finalizing.

## Default Visual Strategy

- Default layout: `bento-grid` for general explainers; `dense-modules` for 高密度信息大图; `comic-strip` for story-like explanations.
- Default style: `hand-drawn-edu` or `morandi-journal` when Kane is visible; upstream default if the user asks for a non-character infographic.
- Default aspect: match upstream recommendation; use portrait for dense social-media explainers unless the user specifies otherwise.
- Default language: match the source/user language.
- Kane Q role: narrator, pointer, emotional reaction, action demonstrator, or guide.

Do not force Kane into every panel. If a section is a clean chart, matrix, or dense module, Kane may appear as a small guide figure or be omitted to protect readability.

## Confirmation Line

When asking for confirmation, include this line:

```text
IP: Kane Q fixed character, using bundled three-view and expression pack as references when Kane appears.
```

## Prompt Construction

For each saved prompt:

- Follow upstream `baoyu-infographic` prompt-file requirements.
- Include the confirmed layout definition, style definition, structured content, aspect ratio, language, and visual hierarchy.
- If Kane appears, append the `Kane Q IP Lock` from `references/kane-ip-usage.md`.
- Keep all character clothing text limited to the small left-chest `Kane.` mark.
- Put infographic labels, headings, numbers, and callouts in panels, cards, arrows, charts, or captions, never on Kane's T-shirt.
- Ask for readable, sparse on-image text. For text-heavy source material, structure the image with short labels and visual hierarchy instead of trying to paste paragraphs into the bitmap.

## Quality Gate

Before finalizing, check:

- Kane still matches the bundled three-view: short black hair, black square-rounded glasses, round-square face, white T-shirt, small left-chest `Kane.`, dark pants, light shoes.
- The output uses the confirmed Kane Q character, not a redesigned avatar.
- No extra mascot, pet, unrelated person, hoodie, hat, backpack, camera, trekking pole, gloves, large T-shirt print, or long chest text appears.
- Kane's pose supports comprehension instead of decorating the page.
- The infographic structure matches the selected layout and preserves the source facts.
- Text in the generated image is legible enough to publish. If text is garbled, regenerate from a corrected prompt; do not patch the bitmap programmatically.
- The final image came from raster image generation or image editing, not HTML/SVG/canvas/screenshot rendering.

## Output

Return the upstream final report plus:

```text
IP: kane-q-infographic
Character references used: three-view plus selected expression assets, or none if Kane was intentionally omitted
IP QC: pass/fail with brief reason
```

## Bundled References

- `references/kane-ip-usage.md` - operational character usage, asset manifest, prompt injection block, and QC
- `references/IP_DNA.md` - canonical Kane Q character profile
- `references/handoff.md` - original handoff from the IP profile
