---
name: "Visual Beginner Tech Explainer"
description: "Explain a technical topic to a complete beginner as a self-contained HTML artifact dominated by large visuals and minimal text."
---

# Visual Beginner Tech Explainer

Create a self-contained HTML artifact that explains **{{TOPIC}}** to someone with no prior knowledge.

## Communication goal

After viewing it, the learner should be able to:

1. Say what the topic is in one plain sentence.
2. Recognize its main parts or steps.
3. Explain one concrete example without using unexplained jargon.

## Content and visual constraints

- Use **{{LANGUAGE}}**. If unspecified, use the user's language.
- Build one clear mental model around a familiar analogy, then show where the analogy stops being accurate.
- Organize the explanation into 3–5 short visual sections with a logical progression.
- Let visuals carry most of the explanation: large inline SVG or CSS illustrations, arrows, spatial relationships, before/after states, or simple interactive controls when they materially help.
- Keep words sparse: one short heading and at most 40 words of body copy per section.
- Define every unavoidable technical term immediately in plain language.
- Use one concrete example and finish with exactly three short takeaways.
- Use **{{VISUAL_STYLE}}**. If unspecified, use clean editorial diagrams with strong hierarchy and ample whitespace.
- Avoid decorative dashboards, dense cards, stock-photo placeholders, unexplained formulas, and walls of text.

## Technical constraints

- Return one complete HTML document with embedded CSS and JavaScript.
- Do not require a build step, external libraries, external fonts, or remote images.
- Make the artifact responsive, keyboard accessible, and readable on both mobile and desktop.
- Respect reduced-motion preferences. Use motion only when it explains change or sequence.
- Ensure labels remain legible and no element overflows its container.

## Output contract

Output only the complete HTML document in a single `html` code block. Do not add commentary before or after it.
