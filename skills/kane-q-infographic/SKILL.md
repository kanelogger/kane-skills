---
name: kane-q-infographic
description: Turn articles, notes, topics, and structured content into clear visual infographics. Use when the user asks for an infographic, 信息图, 漫画信息图, 高密度信息大图, visual summary, concept diagram, framework map, comparison, timeline, or article-to-infographic output.
---

# Kane Q Infographic

Transform source material into a visual structure that makes relationships, sequences, comparisons, and key facts easier to understand.

## Inputs

- Require source content, a topic, article, notes, Markdown file, or pasted text.
- Read the full source and relevant project instructions before selecting a layout.
- Ask for source content only when no usable material or topic is available.

## Workflow

1. Extract the thesis, sections, facts, quotes, numbers, relationships, and intended audience.
2. Rewrite the source into concise infographic copy without changing its meaning.
3. Choose a layout that matches the information structure, such as bento grid, dense modules, timeline, linear progression, comparison matrix, process, hierarchy, map, dashboard, or comic sequence.
4. Define visual hierarchy, reading order, style, palette, language, aspect ratio, and text density.
5. Search for source visuals only when they clarify a specific real-world subject, place, product, person, or when the user asks for source imagery. For factual charts and claims, verify against authoritative sources instead of inferring facts from pictures. Prefer user-provided and official sources. When a found image is needed as a generation input, obtain the full image from its source page into the output's reference-material folder, confirm it is usable, and record its source URL and usage terms. Skip image research when the infographic is fully supported by supplied text or data.
6. Present the proposed structure and direction for confirmation. Skip confirmation when the user explicitly requests direct generation.
7. Save the complete approved prompt before generation.
8. Resolve every selected reference asset relative to this skill's root directory (the directory containing this `SKILL.md`), verify that the local file exists, and pass its absolute path as an image input to the generation tool. For tools that accept `referenced_image_paths`, include each selected local reference there; mentioning a filename in the prompt does not attach the image. Include relevant user-provided or researched visual references when available and permitted.
9. Generate the infographic through the available raster image-generation workflow.
10. Inspect factual accuracy, reading order, hierarchy, text legibility, and rendering defects; regenerate when needed.

> Note: When the infographic benefits from a person, prefer Kane Q as the narrator, guide, observer, or demonstrator. Use additional or different people whenever the information calls for them, and omit people when charts, diagrams, or structured modules communicate better.

## Kane Q References

Read `references/kane-ip-usage.md` only when the infographic includes Kane Q. Use:

- `assets/kane-q/three-view.png` as the primary identity reference.
- One relevant file from `assets/kane-q/expressions/` as an optional pose or emotion reference.
- `references/IP_DNA.md` only when identity recovery, a new pose, or consistency debugging needs more detail.

Treat character assets as identity references, not layout templates. Adapt pose, scale, placement, clothing, supporting people, and rendering to the information structure.

When Kane Q appears, attach `assets/kane-q/three-view.png` as the primary image reference on every generation call. Attach one relevant expression image as an additional reference when it helps with pose or emotion. Resolve these paths from this skill's root directory and pass the actual local files to the image tool; do not rely on prompt text alone. If the selected tool cannot accept image inputs, state that the reference could not be attached and use identity cues from the usage guide as a fallback.

## Prompt Content

Specify the infographic's communication goal, structured copy, layout, reading order, hierarchy, labels, facts, numbers, relationships, style, palette, aspect ratio, and language. Add Kane Q reference assets and concise identity cues only when Kane Q appears. Describe all other people according to their role in the information.

## Quality Check

Before finalizing, verify that:

- The visual structure matches the source's actual relationships and preserves factual meaning.
- Headings, labels, numbers, and short explanations are accurate and readable.
- The reading order is obvious and the density suits the target size.
- Characters support comprehension instead of displacing useful information.
- Kane Q is recognizable when used; supporting people and scene details remain free to follow the content.

Return the generated infographic path and saved prompt path.
