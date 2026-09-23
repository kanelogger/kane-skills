---
name: kane-q-article-illustrator
description: Plan, generate, and integrate useful illustrations for articles or Markdown. Use when the user asks to illustrate an article, add images to an article, create article visuals, or turn sections into scenes, frameworks, comparisons, flowcharts, or infographics.
---

# Kane Q Article Illustrator

Turn article content into visuals that improve comprehension, pacing, or recall. Let the article determine the visual type, composition, and style.

## Inputs

- Require article content or an article file path.
- Read the full article and relevant project instructions before proposing visuals.
- Ask for the article only when no usable content or path is available.

## Workflow

1. Identify the article's structure, key claims, difficult concepts, and visual opportunities.
2. Select only locations where an image adds information, orientation, emotion, or rhythm.
3. Choose the best form for each location: scene, framework, comparison, process, diagram, chart, timeline, or other suitable format.
4. Search for source visuals when an illustration depends on a specific real subject, place, product, person, or when the user asks for source imagery. Prefer images supplied with the article or from authoritative and official sources. When a found image is needed as a generation input, obtain the full image from its source page into the output's reference-material folder, confirm it is usable, and record its source URL and usage terms. Do not treat search-result thumbnails as verified source files. For factual charts, verify the underlying data from authoritative sources. Skip image research when the article itself provides enough information to create the illustration accurately.
5. Propose the illustration outline and important settings for confirmation. Skip confirmation when the user explicitly requests direct generation.
6. Write and save one prompt per approved illustration before generating it. Keep prompt filenames aligned with output image filenames.
7. Resolve each selected reference asset relative to this skill's root directory (the directory containing this `SKILL.md`), verify that the local file exists, and pass its absolute path as an image input to the generation tool. For tools that accept `referenced_image_paths`, include each selected local reference there; mentioning a filename in prompt text does not attach the image. Include relevant user-provided or researched visual references when available and permitted.
8. Generate raster images with the available image-generation workflow.
9. Inspect each result for article fidelity, composition, text legibility, and obvious generation defects. Regenerate when needed.
10. Insert image links into the article when requested, without changing unrelated article content.

> Note: When an illustration benefits from a person, prefer Kane Q as the narrator, presenter, observer, or demonstrator. Use additional or different people whenever the article calls for them, and omit people when another visual form communicates better.

## Kane Q References

Read `references/kane-ip-usage.md` only for illustrations that include Kane Q. Use:

- `assets/kane-q/three-view.png` as the primary identity reference.
- One relevant file from `assets/kane-q/expressions/` as an optional pose or emotion reference.
- `references/IP_DNA.md` only when identity recovery, a new pose, or consistency debugging needs more detail.

Treat these assets as character references, not scene templates. Adapt pose, framing, props, environment, supporting people, and visual treatment to the article.

For every illustration that includes Kane Q, attach `assets/kane-q/three-view.png` as the primary image reference on each generation call. Attach one relevant expression image as an additional reference when it helps with pose or emotion. Resolve these paths from this skill's root directory and pass the actual local files to the image tool; do not rely on prompt text alone. If the selected tool cannot accept image inputs, state that the reference could not be attached and use identity cues from the usage guide as a fallback.

## Prompt Content

For each illustration, specify:

- The section's communication goal and the exact idea the reader should understand.
- The visual structure, subject relationships, composition, aspect ratio, and intended placement.
- Required labels, terms, numbers, or quotes exactly as they appear in the article.
- A style that fits the article and remains coherent across the illustration set.
- Kane Q reference assets and concise identity cues only when Kane Q appears.

Do not append character instructions to prompts that do not contain Kane Q. Describe any other people according to their role in the article.

## Quality Check

Before finalizing, verify that:

- Every image serves its article section and does not introduce unsupported claims.
- The selected visual form is clearer than a decorative character scene would be.
- Labels and generated text are accurate and readable.
- The illustration set feels coherent without forcing identical compositions.
- Kane Q is recognizable when used; supporting people and scene details remain free to follow the content.

Return the generated image paths, prompt paths, and article path when it was updated.
