# Module: deep_analysis

## Module Contract

`purpose`: Build the main understanding layer for articles, essays, technical articles, business commentary, reports, and papers after `paper_scan`. Extract thesis, concepts, structure, evidence, context, hidden assumptions, counterarguments, boundaries, and reusable value.

`trigger`: Run by default for article analysis tasks. Run after `paper_scan` for paper deep analysis. Run before `thought_refine` or `cognitive_upgrade` only as an internal foundation when the source has not yet been analyzed.

`inputs`: Source text, file content, URL content, excerpt, previous `paper_scan` output, optional target reader roles, and optional analysis focus.

`outputs`: `analysis_report` written to the assigned module file. Compact internal notes are allowed only for explicitly narrowed direct refinement tasks.

`evidence_policy`: Use `原文明确`, `合理推断`, `创造性延展`, `外部待验证`, and `信息不足`. Separate source claims from your inference. Mark author background, writing context, publication context, data source, intended audience, and external controversy as `信息不足` when absent from the source. Mark factual claims that come from memory or outside the source as `外部待验证`, not `原文明确`.

`skip_conditions`: Skip for pure paper quick read, pure text polishing, pure translation, social-media packaging, title generation, or external fact-checking unless the user explicitly asks for analysis.

`reference_prompt`: `references/deep_analysis.md`

## Execution Rules

Read the source as an argument system, not as a paragraph sequence. Identify the claim, the mechanism that supports it, the evidence used, the assumptions it depends on, and the conditions under which it breaks.

Do not turn missing context into biography or background knowledge. If a claim requires outside verification, mark it `信息不足` and name the missing evidence.

Run an evidence audit before writing:

- Any number, date, entity name, comparison, causal claim, market share, policy claim, resource dependency, or technical benchmark labeled `原文明确` must appear in the source.
- If it does not appear in the source, downgrade it to `合理推断`, `外部待验证`, or `信息不足`.
- Preserve modality: "will", "may", "plans to", "is expected to", "if", "scenario", and "forecast" must not become established fact.
- Do not invent missing intermediate premises when criticizing the source. If a critique depends on outside facts, label those facts `外部待验证`.

In the default package, always write a standalone `analysis_report` file. If the user explicitly asks for direct refinement only, this module may be a hidden pre-step: extract only core thesis, source anchors, assumptions, and boundaries, and do not write a standalone `analysis_report` file.

When this module is selected for output, write a standalone `analysis_report` document in the output folder and end it with `本模块小结`. In `combined` mode, this file is one step in the chain; the overall final synthesis goes into `99-summary.md` after all selected module files.

## Output Template: analysis_report

### 1. 核心论点

- 用一句话写出文章主张，并标注证据层级。
- 区分作者明确主张与读者可能误读出的主张。

### 2. 关键概念

- 列出文章真正依赖的概念。
- 说明每个概念在原文里的定义或使用方式。
- 没有定义但被反复使用的概念，标为 `合理推断` 或 `信息不足`。

### 3. 论证结构

- 写出论证链：问题 -> 原因 -> 机制 -> 结论 -> 行动或判断。
- 标出论证跳跃、循环论证、偷换概念或未证明连接。

### 4. 证据链

- 列出关键案例、数据、经验、类比、引用或反例。
- 判断证据承担的功能：证明、说明、渲染、反驳、转移注意力。
- 对证据强度做直接判断，并标注证据层级。
- 对每条 `原文明确` 证据保留可追溯的原文锚点：用简短原文片段、章节名、段落位置或文件行号。不要只写泛化后的结论。

### 5. 背景语境

- 只在原文提供证据时说明作者身份、写作背景、回应对象、发布语境。
- 来源缺失时写 `信息不足`，不要补外部故事。

### 6. 隐含假设

- 提取作者没有明说但论证成立所依赖的前提。
- 区分强假设、弱假设、价值判断和经验判断。

### 7. 反方观点与薄弱处

- 给出最强反方观点，而不是随手找反例。
- 指出原文最可能被攻击的位置：证据不足、边界太宽、因果过强、样本偏差、概念含混。

### 8. 适用边界

- 写清这个观点在哪些场景成立、在哪些场景失效。
- 标出需要额外验证的数据、案例或背景。

### 9. 可复用价值

- 提炼可迁移的方法、框架、判断标准或问题意识。
- 如果用户提供了目标读者角色，分别说明价值；没有提供时只在必要时用 `合理推断` 给出常见读者价值。

### 10. 信息不足

- 汇总所有无法从源材料回答的问题。
- 说明需要什么材料才能回答。
- 单列 `外部待验证`：列出分析中提到但原文没有提供、且当前任务没有验证的外部事实或背景。

### 本模块小结

用 3-5 句话压缩本模块最重要的判断、证据强弱和适用边界。
