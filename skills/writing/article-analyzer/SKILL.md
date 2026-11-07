---
name: article-analyzer
description: >-
  为一个具体、有实质内容的文章、论文、报告、随笔、原始论证或长篇来源，建立一套多文件
  分析包。拆解其论点、证据链、隐含假设、反方观点、边界与可复用模型；可选做论文解构、
  以原文为据的思想精炼、认知模型重建，或事实与观点的证据核验。仅在用户提供或明确指出
  来源，并明确要求深度结构化的分析包、论文解构、以原文为据的认知升级/模型重建，或原文
  级证据核验时使用。不适用于普通摘要、简单解释、没有实质来源的随口「分析一下」请求、
  独立的事实查询或网络检索、一般建议或头脑风暴、技术博客质量评审、翻译、改写、编辑、
  社媒包装、标题生成，或封面创作。
---

# 文章分析器（Article Analyzer）

把文章、论文、随笔与长文论证转成结构化理解。把论证模型、证据链、隐含假设、可迁移洞见与更高层次的认知模型摆出来。

默认用中文输出，用户要求其他语言时除外。

## 核心契约

先定路由，再动手分析，最后交出一整套分析包。本技能是文件夹产物流程，不是聊天窗口里的一篇单一报告。默认分析包包含一层忠实于原文的分析，外加一层明确区分开的认知升级：文章走 `deep_analysis -> thought_refine -> cognitive_upgrade`；论文走 `paper_scan -> deep_analysis -> thought_refine -> cognitive_upgrade`。用户明确要求只做忠实分析、不要提维、不要重构模型或只做证据分析时，可以去掉 `cognitive_upgrade`。

外部事实核查是一个显式算子，不是默认的分析动作。只有当用户要求事实核查、主张核验、事实与观点分离、证据支撑、参考链接核查、权威新闻/来源核查，或要求排除自媒体时，才执行。

守住证据边界：

- `原文明确`：原文直接写明。
- `合理推断`：从原文的论证、例子、结构或省略之处推出。
- `创造性延展`：分析者新造的框架、类比、模型或综合。
- `外部待验证`：原文里没有、本次任务也没有核验过的事实性说法。除非需要点明一个待核验方向，否则不要用它。
- `外部已核验`：本次任务中已核验、且点名了可靠来源的外部事实性说法。
- `信息不足`：凭所给材料无法回答。

不要虚构作者背景、发表语境、SOTA 地位、市场数据、政策背景、资源依赖、数据来源、外部争议或目标读者。需要某个外部事实、而用户没有要求外部调研时，标 `外部待验证` 或 `信息不足`，并写明需要什么证据。

证据防火墙：

- 每一条 `原文明确` 的结论都必须能直接追溯到原文。数字、实体、日期、对比或因果判断，凡原文没有的，都不能标 `原文明确`。
- 不得把记忆、行业常识或看起来合理的背景当成原文证据。
- 不得抬高原文的措辞强度。原文里是预测、可能性、计划、意图或情景假设的，分析里必须仍然是预测、可能性、计划、意图或情景假设。
- 创造性模型不要混进证据摘要。`创造性延展` 可能有用，但它不是「原文说了什么」的证据。

不要修改 `references/` 下的文件。只加载所选模块需要的那一份参考提示词。

## 路由协议

输出之前先做一次简短的路由判断：

1. 判定来源类型。
2. 判断用户目标。
3. 按默认分析包设定路由，默认包含 `cognitive_upgrade`，除非用户明确要求增删模块。
4. 只加载对应的参考提示词文件。
5. 如果任务属于复杂研究、多源综合、尽调、文献综述、机会发现、明确要求的严苛批评，或明确要求的事实/观点核验，再加载 `references/research_operators.md`，并挑选最小的有效算子集。
6. 创建输出文件夹，写入所选模块文档，再加一份综合文档。

来源类型拿不准时，默认按 `article` 处理，走文章包：`deep_analysis -> thought_refine -> cognitive_upgrade`。

### 来源类别

（**说明**：下表触发词保留原文形式，因为它们是路由匹配用的关键词。）

| 来源类别 | 触发词 | 默认模块 |
| --- | --- | --- |
| `paper`（论文） | paper, 论文, arXiv, DOI, abstract, method, experiments, SOTA, contribution, benchmark | `paper_scan -> deep_analysis -> thought_refine -> cognitive_upgrade` |
| `article`（文章） | article, essay, blog, report, commentary, long-form argument | `deep_analysis -> thought_refine -> cognitive_upgrade` |
| `technical_article`（技术文章） | technical blog, engineering article, architecture explanation, method comparison | `deep_analysis -> thought_refine -> cognitive_upgrade` |
| `business_commentary`（商业评论） | market, company, strategy, industry, product, operation, investment commentary | `deep_analysis -> thought_refine -> cognitive_upgrade` |
| `raw_thought`（原始思考） | rough notes, verbose draft, conversation excerpt, loose argument | `deep_analysis -> thought_refine -> cognitive_upgrade` |

### 目标路由

| 用户意图 | 触发词 | 模块链 |
| --- | --- | --- |
| 文章默认分析包 | 深度分析, 分析这篇文章, 拆解观点, 看看这篇, 思想精炼 | `deep_analysis -> thought_refine -> cognitive_upgrade` |
| 论文默认分析包 | 论文速读, 快速读懂论文, paper scan, arXiv, 分析这篇论文, 论文解构, 方法论文分析 | `paper_scan -> deep_analysis -> thought_refine -> cognitive_upgrade` |
| 明确只要论文速读 | 只做论文速读, 只要 paper scan, 不要后续分析 | `paper_scan` |
| 明确只要深度分析 | 只做深度分析, 不要精炼, 不要提维 | `deep_analysis` |
| 明确只要思想精炼 | 只做思想精炼, 只要高密度表达, 不要提维 | `deep_analysis -> thought_refine` |
| 明确提出认知升级 | 提维, 升维, 认知升级, 底层模型, 新框架, 重构模型, 更高维度怎么看 | 保留默认路由，并突出 `cognitive_upgrade` |
| 研究算子包 | 文献综述, 尽调, 多来源对比, 证据地图, 隐含假设, 矛盾点, 研究空白, 实施蓝图, 严苛评审 | 默认模块链 + 从 `references/research_operators.md` 中选出的算子 |
| 事实/观点核验 | 事实核查, 核查证据, 事实观点分离, 哪些事实有证据, 观点是否有证据, 参考链接, 权威报道, 排除自媒体 | `fact_opinion_audit -> 99-summary`；用户同时要求深度分析时，先执行 `deep_analysis` |

多个目标同时出现时，按下述顺序保留：

`paper_scan -> deep_analysis -> thought_refine -> cognitive_upgrade`

默认走完整分析包，包含 `cognitive_upgrade`。只有当用户明确说出「只做」「不要」「跳过」「只要忠实分析」「不要提维」「不要升维」「不要认知升级」，或直接给出一份已经完成的上游文档时，才去掉 `cognitive_upgrade` 或某个忠实于原文的模块。

研究算子是分析透镜，不是另一套流程。默认不要全部执行。用它们加强已选的模块文件，并在 `99-summary.md` 里汇总所选算子集。

`fact_opinion_auditor` 是例外，可以单独成模块文件，因为用户常常只要一份范围收窄的事实/观点核验输出。用户只要事实/观点核验时，不要加 `thought_refine` 或 `cognitive_upgrade`。

## 模块协议

每个模块都按这个形状写：`purpose`、`trigger`、`inputs`、`outputs`、`evidence_policy`、`skip_conditions`、`reference_prompt`。

### `paper_scan`

- `purpose`：在深入分析之前把论文快速拆解一遍。识别问题、前人瓶颈、核心机制、创新增量与边界条件。
- `trigger`：论文、学术方法、arXiv 类输入、DOI/PDF 论文任务，或用户说出「论文速读」「分析这篇论文」「paper」「SOTA」「method」「benchmark」时执行。
- `inputs`：论文全文、摘要、笔记、提取内容，以及可选的用户侧重，例如方法、贡献、局限、应用或批评。
- `outputs`：核心痛点、解题机制、创新增量、关键边界，以及一句话或餐巾纸级别的模型。
- `evidence_policy`：每一条对比都标 `原文明确`、`合理推断` 或 `信息不足`。论文没有提供证据时，不得断言 SOTA 提升。
- `skip_conditions`：非学术文章跳过，除非用户明确要求按论文规格分析。原文只是一段短引用、方法与贡献细节不足时，也跳过。
- `reference_prompt`：`references/paper_scan.md`

### `deep_analysis`

- `purpose`：为文章和论文搭建主理解层。抽出论点、概念、结构、证据、背景语境、隐含假设、反方观点、边界与可复用价值。
- `trigger`：文章分析任务默认执行。论文深度分析时在 `paper_scan` 之后执行。原文尚未分析时，先于 `thought_refine` 或 `cognitive_upgrade` 执行。
- `inputs`：原文内容、文件内容、URL 内容、节选，可选的目标读者角色，以及可选的分析侧重。
- `outputs`：核心论点、关键概念、论证结构、证据与例子、背景语境、隐含假设、反方观点、薄弱处、适用边界、可复用的框架；已知目标读者时，还要给出对应的读者价值。
- `evidence_policy`：把明确证据和推断分开。作者背景、写作语境、目标读者在原文缺席时，标 `信息不足`。只有在有用时才推断目标读者角色，并标 `合理推断`。
- `operator_policy`：复杂研究、多源综合、尽调、文献综述或明确要求的严苛批评，加载 `references/research_operators.md`，把选出的算子输出并进本模块，而不是另开一套平行流程。
- `skip_conditions`：只在用户要求纯论文速读、纯文本润色、纯翻译或其他非分析任务时跳过。
- `reference_prompt`：`references/deep_analysis.md`

### `thought_refine`

- `purpose`：把分析结果或啰嗦的原文素材转成锐利、高密度的思考产物。产出结论先行的结构，而不是逐句摘要。
- `trigger`：用户要求「思想精炼」「提炼主线」「压缩观点」「高密度表达」「结论先行」「把啰嗦内容变清楚」，或分析之后需要表达清晰时执行。
- `inputs`：`deep_analysis` 的输出；用户直接要求精炼一段啰嗦论证时，也接受原始文本。
- `outputs`：可选的啰嗦或结构诊断、一个核心想法、表达目的、结论先行的结构、不超过三个主要支撑点（原文确实需要更多时除外），以及精炼后的高密度表达。
- `evidence_policy`：守住作者真正的主张。超出明确措辞的锐化解读标 `合理推断`。不新增例子、主张或外部知识。
- `skip_conditions`：用户只要完整深度分析时跳过。保留原始顺序比表达清晰更重要时，也跳过。
- `reference_prompt`：`references/thought_refine.md`

### `cognitive_upgrade`

- `purpose`：在直接分析之上再进一步，建构一个更高层次的模型。识别正题、反题、共同目标、被忽略变量、综合、认知盲区、测试场景与行动算法。
- `trigger`：忠实于原文的分析之后默认执行（文章包与论文包皆然）。用户明确提出「提维」「升维」「认知升级」「底层模型」「新框架」「重构模型」「更高维度怎么看」或同义说法时，重点执行。
- `inputs`：`deep_analysis` 的输出，或用户提供的、足以支撑正题/反题重建的主张、观点或论证。
- `outputs`：正题、反题、共同目标、被忽略变量、综合模型、自我陷阱或认知盲区、测试场景与行动算法。
- `evidence_policy`：综合默认按 `创造性延展` 对待。保留回溯到原文主张的可追溯性。把作者的观点和分析者升级后的模型分开。原文没有的事实材料必须标 `外部待验证`，并排除在 `原文明确` 的摘要之外。
- `skip_conditions`：原文太单薄、撑不起一组有意义的正题/反题时跳过；用户要求忠实摘要、学术评审、不要提维、不要重构模型或只做证据分析时，也跳过。
- `reference_prompt`：`references/cognitive_upgrade.md`

### `fact_opinion_audit`

- `purpose`：把作者声称的事实和作者陈述的观点分开，并核验两者是否各有可靠证据。
- `trigger`：只在用户明确要求事实核查、主张核验、事实与观点分离、证据支撑、参考链接核查、权威新闻/来源核查，或要求排除自媒体时执行。
- `inputs`：原文内容、可选的参考链接、可选的来源限制，以及用户给定的核验范围。
- `outputs`：作者声称的事实及其核验状态；作者陈述的观点及其支撑状态；支撑或反驳的来源；被排除来源的说明；尚未解决的核验缺口。
- `evidence_policy`：先查用户给的参考链接。具备外部查询能力时，用一手来源、官方出版物、学术来源、公司公告或权威新闻报道。排除自媒体、匿名转载、内容农场和无据社媒帖子。事实用 `已证实`、`部分支持`、`未找到可靠证据`、`与可靠来源冲突` 或 `无法核验` 标状态；观点用 `事实证据支撑`、`逻辑推论支撑`、`弱证据`、`无可靠证据` 或 `无法判断` 标状态。不要把 `未找到可靠证据` 等同于假。
- `skip_conditions`：用户只要忠实于原文的分析、思想精炼、认知升级、改写、翻译，或只要内部证据映射而不要外部核验时，跳过。
- `reference_prompt`：`references/research_operators.md` 中的 `fact_opinion_auditor` 算子

## 输出模式

| 模式 | 使用场合 | 产物形态 |
| --- | --- | --- |
| `article_package` | 文章、随笔、博客、报告、原始思考的默认模式 | `01-deep_analysis.md`、`02-thought_refine.md`、`03-cognitive_upgrade.md`、`99-summary.md` |
| `paper_package` | 论文与学术方法的默认模式 | `01-paper_scan.md`、`02-deep_analysis.md`、`03-thought_refine.md`、`04-cognitive_upgrade.md`、`99-summary.md` |
| `upgrade_package` | 用户明确强调认知升级/模型重建 | 先出忠实于原文的文件，再出 `0N-cognitive_upgrade.md`，最后出 `99-summary.md` |
| `fact_opinion_audit` | 用户明确要求核验事实/观点或证据支撑 | `01-fact_opinion_audit.md`、`99-summary.md`；同时要求深度分析时，最前面加一份 `01-deep_analysis.md` |
| `narrow_package` | 用户明确跳过某些模块 | 所选模块文件加 `99-summary.md` |

默认产物应当紧凑但不浅薄。宁可给具体主张、证据和边界，不要给泛泛解释。

## 文件夹产物契约

一律交出一个文件夹，不能只给聊天里的一份 Markdown 报告。

按以下顺序选输出文件夹：

1. 用户指定了输出路径，就用该路径。
2. 本地来源文件：在同级目录创建 `<source-basename>-article-analyzer`。
3. 其余情况：在当前项目目录创建 `article-analyzer-<short-slug>`。

所有产物留在当前项目内或用户指定路径内。不要把分析产物写到 `/private/tmp` 或其他系统临时目录。

文件夹内，每个选中模块写一份 Markdown，再加一份综合文件。全部模块选中时如下：

```text
article-analyzer-<short-slug>/
  01-paper_scan.md
  02-deep_analysis.md
  03-thought_refine.md
  04-cognitive_upgrade.md
  99-summary.md
```

普通文章输入至少创建四个文件：

```text
article-analyzer-<short-slug>/
  01-deep_analysis.md
  02-thought_refine.md
  03-cognitive_upgrade.md
  99-summary.md
```

普通论文输入至少创建五个文件：

```text
article-analyzer-<short-slug>/
  01-paper_scan.md
  02-deep_analysis.md
  03-thought_refine.md
  04-cognitive_upgrade.md
  99-summary.md
```

只做事实/观点核验的输入至少创建两个文件：

```text
article-analyzer-<short-slug>/
  01-fact_opinion_audit.md
  99-summary.md
```

只有用户明确收窄路由时，才允许创建更少的文件。按路由顺序保留数字前缀。某个模块是用户明确要求跳过的，不要创建空占位文件。

`99-summary.md` 最后写，必须包含：

- 原文标题或来源标识；
- 所选路由；
- 生成文件索引；
- 最终的综合结论；
- 证据边界、`外部待验证` 与尚未解决的 `信息不足`；
- 有用时给出建议的下一篇阅读或下一步分析。

默认分析包里，`deep_analysis` 一律单独成文件。只有用户明确要求一个收窄的直接精炼任务时，才允许做轻量的内部 `deep_analysis`。对于 `cognitive_upgrade`，除非用户提供的是已经分析过的主张并明确要求跳过上游分析，否则先创建忠实于原文的分析文件，再创建升级文件。`99-summary.md` 里不得把 `创造性延展` 或 `外部待验证` 写成原文的结论。

最终聊天回复要短：给出输出文件夹路径并列出生成的文件。用户没有要求时，不要把报告全文贴进聊天。

## 失败防护

- 不得把默认流程压成一篇 Markdown 报告。
- 普通文章输入不得少于四个文件。
- 普通论文输入不得少于五个文件。
- 用户没有明确要求时，不得做外部事实核查。
- 不得把自媒体、转载或无据社媒帖子当成核验证据。
- 未点名核验所用的来源，不得把某条事实标为已核验。
- 不得把 `未找到可靠证据` 当成主张为假的证据。
- 不得把 `cognitive_upgrade` 当成忠实于原文的分析。
- 默认分析包里不得跳过 `cognitive_upgrade`，除非用户明确要求只做忠实分析、只做证据分析或不要提维，或原文太单薄撑不起认知升级。
- 不得把外部事实、模型记忆或行业常识标成 `原文明确`。
- 不得把预测、假设或情景假设提升为既成事实。
- 不得用态度替代证据。
- 原文足够支撑分析时，不要用一长串问题清单作答。
- 不得让 `thought_refine` 改动作者的核心主张。
- 不得把 `references/` 里的示例当成覆盖范围的边界。
