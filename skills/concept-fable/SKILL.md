---
name: concept-fable
description: Create high-density Chinese explanatory fables that extract a real advanced, relatively niche concept from a user-specified field, hide the concept inside a three-stage story, then reveal and map it. Use when the user asks for 概念寓言, 三段式寓言, 用寓言解释领域概念, story-based concept explanation, Concept Reveal, or asks to turn a domain into a fable with theory mapping, misleading intuition, boundaries, controversy, confidence, and reading directions.
---

# Concept Fable

Turn a user-provided field into a three-stage explanatory fable that lets the reader infer an advanced concept through story mechanics before the concept is named.

## Input Contract

Require a field, domain, discipline, or topic. Treat it as `{变量}`.

If the field is too broad, choose a representative subfield that exposes a deeper mechanism, then explain that choice in the reveal section.

If no reliable concept can be found, answer `不知道` and explain the blocking evidence gap briefly. Do not invent a concept to sound advanced.

Default to Chinese output unless the user explicitly asks for another language.

## Concept Selection

Before writing, internally identify and verify one principle, theory, paradox, mechanism, observation, or named concept from `{变量}`. Do not output the screening process.

Select a concept that satisfies all criteria:

- Real, formally named, and supported by reliable knowledge sources.
- Relatively niche, not an introductory textbook staple.
- Usually beyond early undergraduate exposure.
- More familiar to senior researchers, advanced graduate students, or deep practitioners.
- Obscure but important, with strong explanatory power.
- Concrete enough to become an observable story with a real cognitive reversal.

Check the concept name, definition, theoretical relations, historical context, typical use cases, and controversy before committing. If confidence is weak, switch concepts or state uncertainty directly.

## Story Workflow

Write a three-stage explanatory fable. During the story, do not reveal the concept name, field jargon, or textbook definition.

Use plot, conflict, system rules, character behavior, feedback loops, and changing consequences to make the abstract mechanism observable.

Before drafting, create an internal leakage blacklist from the selected concept: the formal name, its common aliases, field jargon, and obvious explanatory nouns or verbs that would let the reader name the theory too early. Do not output this blacklist.

### Scenario Selection

Prefer high-familiarity everyday scenes when they can faithfully carry the selected concept. For Chinese output, default first to `吃喝拉撒、衣食住行` and adjacent public-life situations: restaurants, cooking, queues, markets, renting, moving, commuting, clinics, pharmacies, laundry, household chores, toilets, deliveries, repairs, and small shops.

Choose these scenes because they reduce setup cost, make feedback concrete, and let abstract mechanisms become visible through actions, mistakes, money, time, bodily discomfort, broken objects, spoiled food, wrong routes, returned goods, or social friction.

Only use lower-familiarity institutional settings such as archives, laboratories, factories, courts, schools, or bureaucratic offices when the concept genuinely depends on that system, or when an everyday scene would distort the formal mechanism.

Before drafting the fable, prefer a scenario where all three are easy to stage:

- the old rule once looked practical;
- at least two plausible fixes can fail in visibly different ways;
- the final correction can be shown through a concrete operation, audit, or redesign rather than explained by the narrator.

### Drafting Sequence

For Chinese output, silently use English only as a causal scaffold for plot logic, timing, irony, and cause-effect clarity. Do not translate the English scaffold. After the mechanism is clear, rebuild the fable from Chinese scene logic: choose Chinese-native objects, actions, social rules, conversational rhythm, and concrete consequences. The final story must read as if it was originally conceived in Chinese.

For English output, favor plain concrete narration, dry irony, and human behavior revealing the system, in the direction of Mark Twain rather than academic allegory.

For Chinese output, treat Wang Xiaobo only as a prose-quality constraint: colloquial precision, concrete nouns and verbs, dry situational irony, distrust of official language, and comfort with absurd consequences. Do not imitate him through aphorisms, witty similes, clever metaphors, or authorial punchlines. Humor must come from rules, actions, incentives, and consequences.

Every figurative sentence must do mechanism work: it should make clearer what the system observes, ignores, rewards, punishes, or fails to handle. If deleting a metaphor, aphorism, or polished sentence loses no causal information, delete it. Prefer actions, physical details, records, incentives, and failure consequences over abstract attitude or literary flourish.

Use these blog-quality gates while drafting the fable:

- **Problem-driven opening**: start from a concrete pressure, failure, loss, anomaly, or institutional pain. Do not open with a neutral tour of the fictional world.
- **Technical context through history**: show why the old rule or old common sense once looked rational before it fails.
- **Competing explanations**: let characters try at least two plausible fixes or interpretations before the deeper mechanism wins.
- **Problem -> model -> solution**: make each stage narrow the hidden model. The final turn must feel forced by prior evidence, not pasted on as a lesson.
- **Know-why through action**: make readers understand the mechanism from consequences and choices before the reveal section explains it.
- **Chinese reconstruction**: for Chinese output, rewrite from the understood mechanism and story situation, not from the wording of the internal scaffold.
- **Source discipline**: keep the fable faithful to the verified concept. Do not add story mechanics that contradict the formal theory just because they are dramatic.

### Stage 1: Establish the World Rule

Show a normal-looking system under pressure. Give it a rule that solves a real problem and therefore looks defensible. Make the reader form an initial model. Plant the hidden contradiction through concrete scenes, incentives, measurements, and system feedback, not abstract explanation.

### Stage 2: Make the Rule Fail

Introduce an anomaly that the old model cannot absorb. Let characters apply plausible common-sense fixes, and show each fix failing in a different way. The failures should reveal structure: what the system observes, what it ignores, what it rewards, and what it punishes. Do not name the concept or use its close technical vocabulary.

### Stage 3: Turn the Reader's Model

Expose the real mechanism through a decisive action, experiment, audit, reversal, or design change. Make earlier details become newly legible. Let the reader naturally feel the old model collapse near the ending, while still withholding the formal name until after the story.

Avoid cheap twists, symbolic fog, empty philosophizing, fairy-tale tone, and hard-packed lesson delivery. Prefer concrete mechanisms, concrete consequences, and internally consistent rules. Do not let the narrator explain the hidden theory inside the fable; leave explicit explanation for `Concept Reveal` and later sections. The tone can approach Borges, Ted Chiang, Stanislaw Lem, Calvino, selected Black Mirror episodes, or a scientist writing fiction to explain a hard idea.

Before final output, silently review the fable against these failure modes and rewrite if any are present:

- the story is a technical lecture with costumes;
- the mechanism is stated before the reveal section;
- the opening lacks a concrete problem;
- the middle has only one failed fix or no real comparison;
- the ending relies on a clever sentence rather than accumulated evidence;
- the Chinese prose adds witty similes, aphorisms, polished one-liners, or literary flourishes that do not advance the mechanism;
- a metaphor states the interpretation before the reader has seen enough evidence through action;
- the story uses concept-adjacent words so directly that the reveal becomes obvious;
- dramatic details break the concept's actual boundary conditions;
- the Chinese story still feels like translated English: stiff institution labels, over-abstract nouns, parallel clauses that sound imported, or character names/places that expose the source language instead of the fictional world.

## Required Output

Output exactly this structure. Do not add preface, process notes, disclaimers, or transitional filler.

```markdown
# 寓言正文

[三段式寓言。不要提前泄露概念名称。]

# Concept Reveal

**正式名称**：[概念名称]

**核心定义**：[直接、准确、具体地解释该概念。]

**为什么重要**：[说明它在 `{变量}` 领域中的解释价值。]

# 理论映射解析

[逐一对照故事元素与概念机制，说明故事如何映射该理论。]

# 误导性直觉

[说明读者或故事人物最容易误判的地方，以及为什么该直觉会失败。]

# 适用边界与争议

[说明该概念在哪些条件下成立，哪些地方容易被误用；若存在争议，直接写明。]

# 置信度

[高 / 中 / 低 / 未知]：[简短说明依据。]

# 延伸阅读方向

[可选。只给方向或关键词，不编造不存在的文献。]
```

## Explanation Requirements

After the fable, directly explain:

- the formal concept name;
- the core definition;
- why it explains something important in `{变量}`;
- which story elements map to which concept mechanisms;
- the most misleading intuition in the story;
- why the common-sense solution fails;
- the concept's valid boundary;
- controversy, if any;
- confidence: `高`, `中`, `低`, or `未知`, with a short reason.

## Style Rules

Be complete, deep, precise, and concrete. Keep high information density without turning the piece into a textbook.

Use a calm, restrained, sharp voice. Do not flatter the user, praise the question, or accept a weak premise.

Preserve English proper names and established technical terms when they are part of the source material or required explanation, unless they are on the leakage blacklist for the fable body.

Preserve code snippets exactly in their original format.

Use a style close to high-quality popular science: accessible, concrete, explanatory, and still precise.

When an ordinary reader may miss a technical term or a culturally specific reference, add a short interpretive note. Wrap the note in bold parentheses, for example `**（...）**`, and use it only when it improves comprehension.

Before final output, do a Chinese-prose pass when the answer is in Chinese: read the fable as if it were originally written in Chinese, remove awkward translation traces, cut bureaucratic phrasing, vary sentence length, and keep jokes or irony coming from the situation rather than from punchlines. Replace decorative comparisons with concrete actions or delete them. Keep only sentences that advance world rule, conflict, evidence, mechanism, or consequence.

If the user's field, premise, or concept framing is wrong, say so directly before writing or choose a more defensible framing.

If the user expresses a strong position, give the strongest rebuttal first, then support or revise it.

Accuracy is the standard. User approval is not the standard.

Ban filler such as `好问题`, `完全正确`, `见解独到`, `值得注意的是`, and generic disclaimers.
