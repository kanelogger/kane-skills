---
name: merge-drafts
description: Merges multiple draft documents into a single high-quality article. Reads all drafts, selects the best one as the base, integrates highlights and missing content from other drafts, and produces a polished final output. Trigger when user asks to "merge drafts", "合并稿子", "合稿", "把这几篇合成一篇", "综合这几份稿子", "combine drafts", "merge articles", "merge documents", or when multiple draft files are provided with merge intent. Also triggers for "consolidate drafts", "整合稿件", "统稿", or when user wants to synthesize multiple versions into one cohesive piece.
---

# Merge Drafts

Merge multiple draft documents into a single high-quality, cohesive article.

## Input

- **Draft files**: 2 or more draft files (`.md`, `.txt`, or other text formats). Paths provided by user or discovered in specified directory.
- **Analysis file** (optional): `analysis.md` in the same directory as drafts. Contains reference material, research notes, or editorial guidance.

## Output

All output files are saved to `{drafts-directory}/merged/`:

| File | Description |
|------|-------------|
| `merged_article.md` | Final merged and polished article |
| `merge_report.md` | Detailed merge report explaining decisions |

## Workflow

### Step 1: Read and Assess All Drafts

Read every draft file and the optional `analysis.md`. For each draft, evaluate:

| Criterion | Assessment |
|-----------|------------|
| **Structure** | Clear outline? Logical flow? Proper headings? |
| **Coverage** | Completeness of information? Missing sections? |
| **Expression** | Writing quality? Clarity? Engagement? |
| **Highlights** | Unique insights? Compelling examples? Strong data? |

Take notes on strengths and weaknesses of each draft.

If drafts contain competing claims, conflicting data, or incompatible conclusions, record the conflict locally before choosing what to merge: claim A, claim B, source file, supporting evidence, preferred resolution, and unresolved user decision if evidence is insufficient.

### Step 2: Select Base Draft

Choose the **best draft as the foundation**. Selection criteria (in priority order):

1. **Clearest structure** — well-organized, logical flow
2. **Most complete** — covers the topic most thoroughly
3. **Best expression** — highest writing quality
4. **Minimal changes needed** — requires least modification to become final

**Document the choice**: Record why this draft was selected over others.

### Step 3: Extract from Other Drafts

For each non-base draft, systematically extract:

- **Missing content** — information not present in base draft
- **Better expressions** — clearer or more engaging ways to phrase the same content
- **Unique angles** — perspectives or arguments only found in this draft
- **Data and examples** — specific facts, figures, case studies, or anecdotes

Take detailed notes organized by section/topic.

### Step 4: Merge onto Base Draft

Integrate extracted content into the base draft. Follow these principles:

- **Fuse, don't paste** — weave content together so it reads as one coherent piece, not a collage
- **Supplement missing content** — add information from other drafts where the base is incomplete
- **Upgrade expressions** — replace weaker phrasing with stronger alternatives from other drafts
- **Blend perspectives** — integrate unique angles smoothly into the narrative flow
- **Unify style** — ensure consistent voice, tone, and terminology throughout
- **Maintain flow** — transitions between sections should feel natural

### Step 5: Polish

Review the merged draft for these specific issues:

| Check | Action |
|-------|--------|
| **Seamlessness** | Eliminate any visible "stitching" between different drafts |
| **Style consistency** | Ensure uniform voice, tone, and terminology |
| **Redundancy** | Remove repeated points or overlapping content |
| **Logic** | Verify coherent argument flow and transitions |
| **Detail richness** | Preserve specific examples, data, and operational details |
| **Readability** | Ensure smooth, engaging prose throughout |

### Step 6: Generate Merge Report

Create a detailed report documenting the merge process:

```markdown
# Merge Report

## Base Draft Selection
- **Selected**: [filename]
- **Reason**: [why this draft was chosen]

## Draft Contributions

### [Draft 1 filename]
- **Strengths**: [what this draft did well]
- **Contributions**: [specific content integrated]

### [Draft 2 filename]
- **Strengths**: [what this draft did well]
- **Contributions**: [specific content integrated]

## Key Modifications
1. [major change 1]
2. [major change 2]
...

## Statistics
- Total drafts: [N]
- Base draft: [filename]
- Final word count: [N]
- Sections added: [N]
- Sections revised: [N]
```

## Quality Standards

The final merged article should:

- **Read as one voice** — indistinguishable from a single author's work
- **Be better than any individual draft** — leverage the best of all inputs
- **Preserve all unique value** — no good content from any draft is lost
- **Maintain accuracy** — all facts, data, and examples remain correct
- **Be publication-ready** — polished prose suitable for immediate use

## Edge Cases

| Situation | Handling |
|-----------|----------|
| **Conflicting information** | Flag for user decision; default to most credible source or note both views |
| **Contradictory structures** | Prefer base draft structure; integrate alternative organization as subsections if valuable |
| **Highly divergent styles** | Standardize to base draft style; if base is poor, elevate to best available style |
| **Missing analysis.md** | Proceed without it; no dependency |
| **Single draft provided** | Inform user that merging requires 2+ drafts; offer to polish the single draft instead |
| **Very long drafts** (>5000 words each) | Consider chunking by sections; merge section by section |
| **Research-heavy drafts** | Keep this skill focused on merging. Flag research conflicts in `merge_report.md`; do not run a separate research workflow unless the user explicitly asks for one. |

## Example

**User input**:
```
请帮我合并这几篇稿子：draft-v1.md, draft-v2.md, draft-v3.md
```

**Process**:
1. Read all three drafts + analysis.md if present
2. Assess: draft-v2 has best structure and coverage
3. Extract: v1 has better intro hook, v3 has unique case study and more recent data
4. Merge: use v2 as base, integrate v1's hook and v3's case study and data
5. Polish: ensure transitions smooth, remove redundant background section from v3
6. Output: merged_article.md + merge_report.md

**Final output**: A cohesive article that opens with v1's compelling hook, follows v2's clear structure, and includes v3's rich case study and updated statistics.
