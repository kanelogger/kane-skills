---
name: kane-q-cover-image
description: Plan and generate cover images for articles, newsletters, social posts, thumbnails, and hero sections. Use when the user asks for a cover image, 封面图, 文章封面, 公众号封面, social thumbnail, hero cover, or a visual concept based on a title, article, or brief.
---

# Kane Q Cover Image

Create a cover that communicates the topic quickly and works at the intended publishing size. Let the title, audience, platform, and tone determine the visual direction.

## Inputs

- Require a title, article, topic brief, or cover concept.
- Read the supplied content and relevant project instructions before proposing directions.
- Ask for source content only when no usable title, topic, or concept is available.

## Workflow

1. Extract the topic, promise, tone, audience, keywords, and strongest visual metaphor.
2. Confirm the target platform or aspect ratio when it cannot be inferred safely.
3. Choose a suitable cover type, such as typography-led, conceptual, scene, metaphor, portrait, minimal, or mixed.
4. Define palette, rendering style, text level, mood, focal point, and title-safe area from the content and destination.
5. Search for visual source material when the concept depends on a specific real subject, place, product, person, or current event, or when the user asks to use source imagery. Prefer user-provided material and authoritative or official sources. When a found image is needed as a generation input, obtain the full image from its source page into the output's reference-material folder, confirm it is usable, and record its source URL and usage terms. Do not treat search-result thumbnails as verified source files. Skip research when a visual metaphor can be generated accurately from the brief alone.
6. Present the proposed direction for confirmation. Skip confirmation when the user explicitly requests direct generation.
7. Save the complete approved prompt before generation.
8. Resolve any selected reference asset relative to this skill's root directory (the directory containing this `SKILL.md`), verify that the local file exists, and pass its absolute path as an image input to the generation tool. For image-generation tools that accept `referenced_image_paths`, include every selected local reference there; writing a path or saying “use the reference” in prompt text alone does not attach the image. Pass relevant user-provided or researched visual references the same way when available and permitted.
9. Generate the cover through the available raster image-generation workflow.
10. Inspect the result at full size and thumbnail size; regenerate when the concept, hierarchy, typography, or visual quality is weak.

> Note: When the cover benefits from a person, prefer Kane Q as the hero, narrator, observer, or demonstrator. Use additional or different people whenever the concept calls for them, and omit people when typography, objects, or an abstract metaphor makes a stronger cover.

## Kane Q References

Read `references/kane-cover-usage.md` only when the cover includes Kane Q. Use:

- `assets/kane-q/three-view.png` as the primary identity reference.
- One relevant file from `assets/kane-q/expressions/` as an optional pose or emotion reference.
- `references/IP_DNA.md` only when identity recovery, a new pose, or consistency debugging needs more detail.

Treat character assets as identity references, not cover templates. Adapt pose, crop, scale, clothing, environment, supporting people, and rendering to the cover concept.

When Kane Q appears, attach `assets/kane-q/three-view.png` as the primary image reference on every generation call. Attach one relevant expression image as an additional reference when it helps with pose or emotion. Resolve these paths from this skill's root directory and pass the actual local files to the image tool; do not rely on prompt text alone. If the selected tool cannot accept image inputs, state that the reference could not be attached and use identity cues from the usage guide as a fallback.

## Prompt Content

Specify the title and subtitle exactly, the cover's communication goal, visual metaphor, subject relationships, composition, palette, rendering, mood, typography area, aspect ratio, and target platform. Add Kane Q reference assets and concise identity cues only when Kane Q appears. Describe all other people according to their role in the concept.

## Quality Check

Before finalizing, verify that:

- The topic is understandable at a glance and the cover has one clear focal idea.
- Title and subtitle remain readable, correctly spelled, and separated from busy visual areas.
- The composition works at the target aspect ratio and thumbnail size.
- The image follows the approved concept without introducing misleading details.
- Kane Q is recognizable when used; supporting people and scene details remain free to follow the concept.

Return the generated cover path and saved prompt path.
