# Kane Q IP Usage

Use this reference whenever `kane-q-article-illustrator` creates article visuals.

## Asset Manifest

- Front full body: `assets/kane-q/front-full-body.png`
- Three-view: `assets/kane-q/three-view.png`
- Expressions:
  - `assets/kane-q/expressions/01-v-sign.png`
  - `assets/kane-q/expressions/02-reading.png`
  - `assets/kane-q/expressions/03-thinking.png`
  - `assets/kane-q/expressions/04-thumbs-up.png`
  - `assets/kane-q/expressions/05-coffee.png`
  - `assets/kane-q/expressions/06-work-ready.png`
  - `assets/kane-q/expressions/07-shrug.png`
  - `assets/kane-q/expressions/08-starting.png`

Use `three-view.png` as the primary character reference for all new images. Use expression images only as pose or emotion references.

## Character Capsule

Generate the same Kane Q comic IP: chibi adult male, about 3-heads tall, big head and small body, short black buzz-cut hair with a rounded top silhouette, black square-rounded glasses, round-square face, warm relaxed smile, smart and lightly playful expression. Fixed outfit: white short-sleeve T-shirt with only a small `Kane.` mark on the left chest, dark gray or navy straight casual pants, white or light gray simple sneakers. Style: simplified flat hand-drawn comic illustration, warm off-white clean background, thick dark brown or black hand-drawn outlines, low-saturation flat colors. Keep the same proportions, face rules, glasses, outfit, color anchors, and line style; change only expression, pose, and small props required by the article.

## Role In Article Illustrations

Use Kane Q as:

- Narrator beside a framework or model.
- Pointer highlighting a key term, number, or causal relation.
- Emotional marker for confusion, realization, agreement, pause, or action.
- Action demonstrator for reading, thinking, working, deciding, testing, or starting.

Avoid Kane Q when a clean chart, process diagram, or dense comparison would be clearer without a character.

## Expression Mapping

- Curiosity or opening hook: `01-v-sign.png`
- Reading or learning: `02-reading.png`
- Analysis or insight: `03-thinking.png`
- Approval or recommendation: `04-thumbs-up.png`
- Recovery or pause: `05-coffee.png`
- Execution or writing: `06-work-ready.png`
- Ambiguity or tradeoff: `07-shrug.png`
- Start, launch, or next action: `08-starting.png`

## Hard Rules

- Preserve black square-rounded glasses, short black hair, white T-shirt, small left-chest `Kane.`, dark pants, light shoes.
- Do not add hats, hoodies, backpacks, cameras, trekking poles, gloves, extra characters, mascots, pets, or unrelated brand marks.
- Do not put large prints, slogans, poems, English quotes, diagrams, or article text on the T-shirt.
- Do not make the character photorealistic, 3D, glossy, cinematic, or sticker-like with a heavy white border.
- Do not crop the character awkwardly when the prompt asks for full body.
- Do not use the source photo as the main downstream reference; use confirmed generated assets.

## Prompt Injection Template

Append this block to any saved prompt file that contains Kane Q:

```markdown
### Kane Q IP Lock
Use the bundled Kane Q three-view as the primary direct character reference. Keep the same chibi adult male identity: short black hair, black square-rounded glasses, round-square face, white short-sleeve T-shirt with only the small left-chest `Kane.` mark, dark gray/navy pants, light sneakers, warm off-white background, thick dark hand-drawn linework, low-saturation flat colors. The character may point, think, read, approve, work, pause, or react according to the illustration purpose, but must remain recognizably the same IP.

Negative constraints: no hoodie, hat, backpack, camera, trekking pole, gloves, extra mascot, extra person, large T-shirt graphic, long chest text, photorealism, 3D render, complex background, collage, contact sheet, or sticker pack.
```

## QC Checklist

- Character identity matches the bundled three-view.
- Left chest contains only `Kane.`.
- Pose supports the article section instead of decorating it.
- Labels and diagrams belong to the article content, not the character clothing.
- Generated text is legible enough to publish, or the prompt is regenerated.
