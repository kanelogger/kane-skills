# Module: thought_refine

## Module Contract

`purpose`: Convert analysis or verbose source material into sharp, high-density thinking output. Produce a conclusion-first thesis, not a line-by-line summary.

`trigger`: Run as the second standard step after `deep_analysis` in the default article package, and as the third standard step after `paper_scan -> deep_analysis` in the default paper package. Also run when the user asks for "思想精炼", "提炼主线", "压缩观点", "高密度表达", "结论先行", "把啰嗦内容变清楚", or when communication clarity is the explicit output goal.

`inputs`: Preferred input is `deep_analysis` output. Also accept raw notes, conversation excerpts, rough drafts, verbose claims, or article text when the user directly asks for refinement.

`outputs`: `refined_thesis` written to the assigned module file, normally `01-thought_refine.md` for direct refinement or later-numbered in combined mode.

`evidence_policy`: Preserve the author's actual claim. Mark sharpened interpretations as `合理推断` when they go beyond explicit wording. Do not add new examples, claims, statistics, context, or outside knowledge. If a tempting factual enhancement is not in the source, omit it or mark it `外部待验证` in the evidence boundary.

`skip_conditions`: Skip only when the user explicitly asks for full deep analysis only, asks to preserve original order, or says not to refine. Default package runs this module.

`reference_prompt`: `references/thought_refine.md`

## Execution Rules

This module is for structure and density, not for new thinking. The output must make the original idea clearer without changing what the author means.

Before writing, do a containment check: every concrete number, example, named entity, timeline, and causal claim in the refined output must come from the source or prior `deep_analysis`. If it does not, remove it. Do not make the author's forecasts sound more certain than the original wording.

If no prior `deep_analysis` exists, do only a lightweight internal extraction before writing:

- core claim;
- source anchors that must not be changed;
- meaning boundaries and missing evidence.

Do not write a full `analysis_report` file for the lightweight internal extraction. Do not expand the task into article analysis. The module file should contain `refined_thesis` only unless the router selected a combined chain with earlier module files.

When this module is selected for output, write a standalone `refined_thesis` document in the output folder and end it with `本模块小结`. If a lightweight internal `deep_analysis` was used only to extract the core claim, do not expose it as a separate file.

## Refinement Process

1. Diagnose the source of verbosity: repeated process narration, loose structure, filler words, weak thesis, mixed goals, or unsupported leaps.
2. Extract the one core idea the text is trying to convey.
3. Identify the communication purpose: decision, information, persuasion, reflection, critique, alignment, or action.
4. Rebuild the logic as conclusion first, then up to three primary support points.
5. Cut filler, vague modifiers, redundant transitions, and repeated claims.
6. Keep professional terms when they carry real meaning; define or ground them when needed.
7. Check that every sharpened claim still traces back to the source.

## Output Template: refined_thesis

### 核心结论

写一段高密度结论。优先直接判断，不铺垫。

### 支撑结构

- 支撑点一：只保留一个独立理由。
- 支撑点二：只保留一个独立理由。
- 支撑点三：只保留一个独立理由。

### 精炼表达

给出可直接使用的最终版本。根据原文形态选择短段落、发言稿式表达或结构化段落。

### 证据边界

- `原文明确`: 哪些核心意思来自原文。
- `合理推断`: 哪些锐化表达是基于原文的压缩推断。
- `外部待验证`: 如因用户目标必须提到外部事实，列出但不纳入精炼主张。
- `信息不足`: 哪些内容不能补。

### 本模块小结

用 2-4 句话说明原文被压缩成了哪个核心判断、保留了哪些边界、没有补入哪些新内容。
