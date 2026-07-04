---
name: article-analyzer
description: Analyze articles, papers, essays, technical blogs, business commentary, reports, raw notes, or long-form arguments into structured understanding, delivered as an output folder containing one Markdown file per selected analysis module plus a synthesis document. Use when the user asks for article analysis, 深度分析, 分析这篇文章, 拆解观点, 论文速读, paper scan, 分析这篇论文, thought refinement, 思想精炼, 提炼主线, 高密度表达, cognitive upgrade, 提维, 升维, 认知升级, 底层模型, model reconstruction, fact/opinion audit, 事实核查, 事实观点分离, 观点是否有证据, or 核查证据. Do not use for translation, publishable article rewriting, social-media packaging, title generation, or cover creation.
---

# Article Analyzer

Turn articles, papers, essays, and long-form arguments into structured understanding. Expose the argument model, evidence chain, hidden assumptions, transferable insight, and higher-level cognitive model.

Default to Chinese unless the user requests another language.

## Core Contract

Route before analyzing, then create a complete analysis package. This skill is a folder-output workflow, not an in-chat single report. The default package includes a source-faithful analysis layer plus a clearly separated cognitive upgrade: articles run `deep_analysis -> thought_refine -> cognitive_upgrade`; papers run `paper_scan -> deep_analysis -> thought_refine -> cognitive_upgrade`. The user can explicitly remove `cognitive_upgrade` by asking for faithful analysis only, no upgrade, no model reconstruction, or evidence-only analysis.

External fact-checking is an explicit operator, not a default analysis behavior. Run it only when the user asks for fact-checking, claim verification, fact/view separation, evidence support, reference-link checking, authoritative news/source checking, or excluding self-media.

Preserve evidence boundaries:

- `原文明确`: directly stated by the source.
- `合理推断`: inferred from the source's argument, examples, structure, or omissions.
- `创造性延展`: a new framing, analogy, model, or synthesis created by the analyst.
- `外部待验证`: a factual claim not present in the source and not verified in the current task. Avoid using it unless it is necessary to name a verification direction.
- `外部已核验`: an external factual claim verified in this task with a named reliable source.
- `信息不足`: cannot be answered from the provided source.

Do not invent author background, publication context, SOTA status, market data, policy background, resource dependency, data source, external controversy, or intended audience. If an external fact is needed and the user did not ask for external research, mark it `外部待验证` or `信息不足` and state what evidence would be needed.

Evidence firewall:

- Every `原文明确` claim must be directly traceable to the source text. If a number, entity, date, comparison, or causal claim does not appear in the source, it cannot be `原文明确`.
- Do not turn memory, industry common sense, or plausible background into source evidence.
- Do not strengthen source language. A forecast, possibility, plan, intention, or scenario in the source must remain a forecast, possibility, plan, intention, or scenario in the analysis.
- Keep creative models out of evidence summaries. `创造性延展` may be useful, but it is not evidence for what the source says.

Do not modify files in `references/`. Load only the reference prompt required by the selected module.

## Routing Protocol

Before output, do a short internal routing pass:

1. Classify source type.
2. Infer user goal.
3. Build the default package route with `cognitive_upgrade` unless the user explicitly asks to add or remove modules.
4. Load only the matching reference prompt files.
5. If the task is complex research, multi-source synthesis, due diligence, literature review, opportunity discovery, explicit rigorous critique, or explicit fact/opinion audit, also load `references/research_operators.md` and select the smallest useful operator set.
6. Create an output folder and write the selected module documents plus a synthesis document.

If the source type is ambiguous, default to `article` and run the article package: `deep_analysis -> thought_refine -> cognitive_upgrade`.

### Source Types

| Source family | Signals | Default module |
| --- | --- | --- |
| `paper` | paper, 论文, arXiv, DOI, abstract, method, experiments, SOTA, contribution, benchmark | `paper_scan -> deep_analysis -> thought_refine -> cognitive_upgrade` |
| `article` | article, essay, blog, report, commentary, long-form argument | `deep_analysis -> thought_refine -> cognitive_upgrade` |
| `technical_article` | technical blog, engineering article, architecture explanation, method comparison | `deep_analysis -> thought_refine -> cognitive_upgrade` |
| `business_commentary` | market, company, strategy, industry, product, operation, investment commentary | `deep_analysis -> thought_refine -> cognitive_upgrade` |
| `raw_thought` | rough notes, verbose draft, conversation excerpt, loose argument | `deep_analysis -> thought_refine -> cognitive_upgrade` |

### Goal Routing

| User intent | Signals | Module chain |
| --- | --- | --- |
| default article package | 深度分析, 分析这篇文章, 拆解观点, 看看这篇, 思想精炼 | `deep_analysis -> thought_refine -> cognitive_upgrade` |
| default paper package | 论文速读, 快速读懂论文, paper scan, arXiv, 分析这篇论文, 论文解构, 方法论文分析 | `paper_scan -> deep_analysis -> thought_refine -> cognitive_upgrade` |
| explicit narrow paper quick read | 只做论文速读, 只要 paper scan, 不要后续分析 | `paper_scan` |
| explicit narrow deep analysis | 只做深度分析, 不要精炼, 不要提维 | `deep_analysis` |
| explicit narrow thought refinement | 只做思想精炼, 只要高密度表达, 不要提维 | `deep_analysis -> thought_refine` |
| explicit cognitive upgrade | 提维, 升维, 认知升级, 底层模型, 新框架, 重构模型, 更高维度怎么看 | preserve the default route and emphasize `cognitive_upgrade` |
| research operator package | 文献综述, 尽调, 多来源对比, 证据地图, 隐含假设, 矛盾点, 研究空白, 实施蓝图, 严苛评审 | default module chain + selected operators from `references/research_operators.md` |
| fact/opinion audit | 事实核查, 核查证据, 事实观点分离, 哪些事实有证据, 观点是否有证据, 参考链接, 权威报道, 排除自媒体 | `fact_opinion_audit -> 99-summary`; when the user also asks for deep analysis, run `deep_analysis` first |

When multiple goals are present, preserve this order:

`paper_scan -> deep_analysis -> thought_refine -> cognitive_upgrade`

Default to the full package route, including `cognitive_upgrade`. Only remove `cognitive_upgrade` or a source-faithful module when the user explicitly says "只做", "不要", "跳过", "只要忠实分析", "不要提维", "不要升维", "不要认知升级", or gives an already completed upstream document.

Research operators are analysis lenses, not a separate workflow. Do not run all operators by default. Use them to strengthen the selected module files and summarize the selected operator set in `99-summary.md`.

`fact_opinion_auditor` is the exception that may produce its own module file because users often ask for a narrow fact/opinion verification output. When the user only asks for fact/opinion audit, do not add `thought_refine` or `cognitive_upgrade`.

## Module Protocol

Every module follows this shape: `purpose`, `trigger`, `inputs`, `outputs`, `evidence_policy`, `skip_conditions`, `reference_prompt`.

### `paper_scan`

- `purpose`: Quickly deconstruct a paper before deeper analysis. Identify the problem, prior bottleneck, core mechanism, innovation delta, and boundary conditions.
- `trigger`: Run for papers, academic methods, arXiv-style inputs, DOI/PDF paper tasks, or when the user says "论文速读", "分析这篇论文", "paper", "SOTA", "method", or "benchmark".
- `inputs`: Paper text, abstract, notes, extracted content, and optional user focus such as method, contribution, limitation, application, or critique.
- `outputs`: Core pain point, solution mechanism, innovation delta, critical boundary, and one-sentence or napkin-level model.
- `evidence_policy`: Label all comparisons with `原文明确`, `合理推断`, or `信息不足`. Do not assert SOTA improvement unless the paper provides evidence.
- `skip_conditions`: Skip for non-academic articles unless the user explicitly asks for paper-style analysis. Skip if the source is only a short quote without enough method or contribution detail.
- `reference_prompt`: `references/paper_scan.md`

### `deep_analysis`

- `purpose`: Build the main understanding layer for articles and papers. Extract thesis, concepts, structure, evidence, background context, hidden assumptions, counterarguments, boundaries, and reusable value.
- `trigger`: Run by default for article analysis tasks. Run after `paper_scan` for paper deep analysis. Run before `thought_refine` or `cognitive_upgrade` when the source has not been analyzed.
- `inputs`: Source text, file content, URL content, excerpt, optional target reader roles, and optional analysis focus.
- `outputs`: Core thesis, key concepts, argument structure, evidence and examples, background context, hidden assumptions, counterarguments, weaknesses, validity boundaries, reusable frameworks, and reader-specific value when target readers are known.
- `evidence_policy`: Separate explicit evidence from inference. Mark author background, writing context, and intended audience as `信息不足` when absent. Infer target reader roles only when useful and label them `合理推断`.
- `operator_policy`: For complex research, multi-source synthesis, due diligence, literature review, or explicit rigorous critique, load `references/research_operators.md` and integrate selected operator outputs into this module instead of creating a parallel workflow.
- `skip_conditions`: Skip only when the user asks for pure paper quick read, pure text polishing, pure translation, or another non-analysis task.
- `reference_prompt`: `references/deep_analysis.md`

### `thought_refine`

- `purpose`: Convert analysis or verbose source material into a sharp, high-density thinking output. Produce conclusion-first structure, not a line-by-line summary.
- `trigger`: Run when the user asks for "思想精炼", "提炼主线", "压缩观点", "高密度表达", "结论先行", "把啰嗦内容变清楚", or communication clarity after analysis.
- `inputs`: Output from `deep_analysis`, or raw text when the user directly asks to refine a verbose argument.
- `outputs`: Optional diagnosis of verbosity or structure, one core idea, communication purpose, conclusion-first structure, three or fewer primary support points unless the source demands more, and refined high-density expression.
- `evidence_policy`: Preserve the author's actual claim. Mark sharpened interpretation beyond explicit wording as `合理推断`. Do not add new examples, claims, or external knowledge.
- `skip_conditions`: Skip when the user asks for full deep analysis only. Skip when preserving original order is more important than expression clarity.
- `reference_prompt`: `references/thought_refine.md`

### `cognitive_upgrade`

- `purpose`: Move beyond direct analysis to construct a higher-level model. Identify thesis, antithesis, common goal, missing variable, synthesis, blind spot, test scenario, and action algorithm.
- `trigger`: Run by default after source-faithful analysis for article and paper packages. Emphasize it when the user explicitly asks for "提维", "升维", "认知升级", "底层模型", "新框架", "重构模型", "更高维度怎么看", or equivalent wording.
- `inputs`: Output from `deep_analysis`, or a user-provided claim, view, or argument that can support thesis/antithesis reconstruction.
- `outputs`: Thesis, antithesis, common goal, missing variable, synthesis model, ego trap or cognitive blind spot, test scenario, and action algorithm.
- `evidence_policy`: Treat synthesis as `创造性延展` by default. Preserve traceability back to source claims. Separate the author's view from the analyst's upgraded model. Any factual material not present in the source must be marked `外部待验证` and excluded from `原文明确` summaries.
- `skip_conditions`: Skip when the source is too thin to support a meaningful thesis/antithesis pair, or when the user asks for faithful summary, academic review, no upgrade, no model reconstruction, or evidence-only analysis.
- `reference_prompt`: `references/cognitive_upgrade.md`

### `fact_opinion_audit`

- `purpose`: Separate author-claimed facts from author-stated opinions and verify whether each has reliable evidence.
- `trigger`: Run only when the user explicitly asks for fact-checking, claim verification, fact/view separation, evidence support, reference-link checking, authoritative news/source checking, or excluding self-media.
- `inputs`: Source text, optional reference links, optional source restrictions, and any user-provided verification scope.
- `outputs`: Author-claimed facts with verification status; author-stated opinions with support status; supporting or contradicting sources; excluded source notes; unresolved verification gaps.
- `evidence_policy`: Check user-provided reference links first. When external lookup is available, use primary sources, official publications, academic sources, company filings, or reputable news reports. Exclude self-media, anonymous reposts, content farms, and unsupported social posts. Use statuses `已证实`, `部分支持`, `未找到可靠证据`, `与可靠来源冲突`, or `无法核验` for facts; use `事实证据支撑`, `逻辑推论支撑`, `弱证据`, `无可靠证据`, or `无法判断` for opinions. Do not equate `未找到可靠证据` with false.
- `skip_conditions`: Skip when the user asks only for source-faithful analysis, thought refinement, cognitive upgrade, rewriting, translation, or internal evidence mapping without external verification.
- `reference_prompt`: `references/research_operators.md` operator `fact_opinion_auditor`

## Output Modes

| Mode | When used | Output shape |
| --- | --- | --- |
| `article_package` | default for articles, essays, blogs, reports, raw thoughts | `01-deep_analysis.md`, `02-thought_refine.md`, `03-cognitive_upgrade.md`, `99-summary.md` |
| `paper_package` | default for papers and academic methods | `01-paper_scan.md`, `02-deep_analysis.md`, `03-thought_refine.md`, `04-cognitive_upgrade.md`, `99-summary.md` |
| `upgrade_package` | when the user explicitly emphasizes cognitive upgrade/model reconstruction | source-faithful files first, then `0N-cognitive_upgrade.md`, then `99-summary.md` |
| `fact_opinion_audit` | when the user explicitly asks to verify facts/opinions or evidence support | `01-fact_opinion_audit.md`, `99-summary.md`; add `01-deep_analysis.md` first only when deep analysis is also requested |
| `narrow_package` | user explicitly skips modules | selected module files plus `99-summary.md` |

Default output should be compact but not shallow. Prefer concrete claims, evidence, and boundaries over generic explanation.

## Folder Output Contract

Always deliver a folder, not only an in-chat Markdown report.

Choose the output folder in this order:

1. Use the user-provided output path when specified.
2. For a local source file, create a sibling folder named `<source-basename>-article-analyzer`.
3. Otherwise create `article-analyzer-<short-slug>` in the current project directory.

Keep all outputs inside the current project or the user-specified path. Do not write analysis outputs to `/private/tmp` or other system temp folders.

Inside the folder, write one Markdown file per selected module, plus one synthesis file. Example with all modules selected:

```text
article-analyzer-<short-slug>/
  01-paper_scan.md
  02-deep_analysis.md
  03-thought_refine.md
  04-cognitive_upgrade.md
  99-summary.md
```

For normal article inputs, create at least four files:

```text
article-analyzer-<short-slug>/
  01-deep_analysis.md
  02-thought_refine.md
  03-cognitive_upgrade.md
  99-summary.md
```

For normal paper inputs, create at least five files:

```text
article-analyzer-<short-slug>/
  01-paper_scan.md
  02-deep_analysis.md
  03-thought_refine.md
  04-cognitive_upgrade.md
  99-summary.md
```

For fact/opinion audit-only inputs, create at least two files:

```text
article-analyzer-<short-slug>/
  01-fact_opinion_audit.md
  99-summary.md
```

Only create fewer files when the user explicitly narrows the route. Preserve route order in numeric prefixes. If a module is skipped by explicit request, do not create an empty placeholder file.

Write `99-summary.md` last. It must include:

- source title or source identifier;
- selected route;
- generated file index;
- final integrated conclusion;
- evidence boundaries, `外部待验证`, and unresolved `信息不足`;
- recommended next read or next analysis step when useful.

For the default package, `deep_analysis` always gets its own file. Lightweight internal `deep_analysis` is allowed only when the user explicitly asks for a narrow direct refinement task. For `cognitive_upgrade`, create a source-faithful analysis file before the upgrade file unless the user provides an already analyzed claim and explicitly asks to skip upstream analysis. In `99-summary.md`, do not present `创造性延展` or `外部待验证` as the source's conclusion.

Final chat response should be short: provide the output folder path and list generated files. Do not paste the full report contents into chat unless the user asks.

## Failure Guards

- Do not collapse the default workflow into a single Markdown report.
- Do not output fewer than four files for normal article inputs.
- Do not output fewer than five files for normal paper inputs.
- Do not run external fact-checking unless the user explicitly asks for it.
- Do not treat self-media, reposts, or unsupported social posts as verification evidence.
- Do not label a fact as verified without naming the source used for verification.
- Do not treat `未找到可靠证据` as proof that a claim is false.
- Do not treat `cognitive_upgrade` as faithful source analysis.
- Do not skip `cognitive_upgrade` in the default package unless the user explicitly asks for faithful-only, evidence-only, or no-upgrade analysis, or the source is too thin to support it.
- Do not label external facts, model memory, or common industry background as `原文明确`.
- Do not promote forecasts, assumptions, or scenarios into established facts.
- Do not replace evidence with attitude.
- Do not answer with a long question list when the source is sufficient for analysis.
- Do not let `thought_refine` change the author's core claim.
- Do not treat examples in `references/` as coverage limits.
