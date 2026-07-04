# Module: paper_scan

## Module Contract

`purpose`: Quickly deconstruct a paper before deeper analysis. Identify the problem, prior bottleneck, core mechanism, innovation delta, evidence, and boundary conditions.

`trigger`: Run for papers, academic methods, arXiv-style inputs, DOI/PDF paper tasks, abstracts, methods, experiments, benchmarks, SOTA claims, or when the user asks for "论文速读", "快速读懂论文", "paper scan", "分析这篇论文", "方法论文分析".

`inputs`: Paper text, abstract, notes, extracted content, method section, experiment summary, benchmark table, or user focus such as method, contribution, limitation, application, or critique.

`outputs`: `paper_brief` written to the assigned module file, normally `01-paper_scan.md`.

`evidence_policy`: Use `原文明确`, `合理推断`, `外部待验证`, and `信息不足` on every comparison or performance claim. Do not assert SOTA improvement unless the paper itself provides comparison evidence or the user provides context. If a benchmark, baseline, dataset reputation, or SOTA status comes from outside memory, mark it `外部待验证`.

`skip_conditions`: Skip for non-academic articles unless the user explicitly asks for paper-style analysis. Skip if the source is only a short quote without enough method or contribution detail.

`reference_prompt`: `references/paper_scan.md`

## Execution Rules

Act like a reviewer doing first-pass deconstruction. Ignore academic filler, motivation boilerplate, and broad field background unless they are needed to understand the specific delta.

Do not turn paper scanning into a full article analysis. The output should be compact, high-density, and oriented around mechanism and novelty.

If the paper does not provide enough evidence for novelty, benchmark comparison, dataset quality, baseline strength, or generality, say `信息不足`.

Before writing, audit every claimed comparison. If the paper says "better than X", you may report that as `原文明确`; if you add "X is the current SOTA" from memory, label it `外部待验证` or omit it.

When this module is selected for output, write a standalone `paper_brief` document in the output folder and end it with `本模块小结`. In `combined` mode, this file comes before deeper analysis, refinement, or upgrade files. Do not produce downstream files unless the router selected those modules.

## Output Template: paper_brief

### 1. 核心痛点

- 这篇论文试图解决的具体困难问题是什么？
- 这个问题为什么重要？只使用论文提供的证据或合理推断。

### 2. 前人瓶颈

- 论文声称此前方法卡在哪里？
- 瓶颈属于思路、数据、算力、标注、架构、评估、部署还是理论解释？
- 没有提供对比证据时标 `信息不足`。

### 3. 解题机制

- 用最直白的一句话解释核心直觉：作者把什么看成了什么？
- 列出决定成败的 1-3 个关键机制，不复述所有步骤。

### 4. 创新增量

- 相比作者给出的 baseline、SOTA 或常规方法，本文的新东西是什么？
- 区分工程组合、效率改进、精度提升、数据构造、评估方式、范式变化。
- 每个比较必须标注证据层级。

### 5. 关键证据

- 提取最能支撑论文主张的实验、消融、案例、理论结果或 benchmark。
- 判断证据在证明什么，以及还没有证明什么。

### 6. 批判性边界

- 隐形假设：方法成立依赖哪些条件？
- 未解问题：论文没有解决什么，或引入了什么新问题？
- 外推限制：哪些场景不能直接推广？

### 7. 餐巾纸模型

- 一句话模型：用一句话压缩论文核心思想。
- 图式描述：不用画图时，用 `A -> B -> C` 的结构写出最小机制图。

### 本模块小结

用 3-5 句话说明论文的核心机制、真实增量、证据强度和最关键边界。
