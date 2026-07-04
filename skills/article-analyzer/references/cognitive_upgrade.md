# Module: cognitive_upgrade

## Module Contract

`purpose`: Move beyond direct analysis to construct a higher-level model. Identify thesis, antithesis, common goal, missing variable, synthesis, blind spot, test scenario, and action algorithm.

`trigger`: Run only when the user explicitly asks for "提维", "升维", "认知升级", "底层模型", "新框架", "重构模型", "更高维度怎么看", or equivalent model reconstruction. Do not run as part of the default article or paper package.

`inputs`: Preferred input is `deep_analysis` output. Also accept a user-provided claim, view, argument, article, or conversation excerpt if it can support thesis/antithesis reconstruction.

`outputs`: `upgrade_model` written to the assigned module file, after a source-faithful analysis file when the route requires one.

`evidence_policy`: Treat the synthesis model as `创造性延展` by default. Preserve traceability back to source claims. Separate the author's view from the analyst's upgraded model. Mark unsupported background as `信息不足`. Any factual claim not present in the source or prior verified analysis must be labeled `外部待验证` and must not appear under `原文明确`.

`skip_conditions`: Skip when the user does not explicitly ask for cognitive upgrade/model reconstruction, asks for a narrow evidence-only output, or the source is too thin to support a meaningful thesis/antithesis pair. When the user explicitly asks for upgrade but the source is thin, create the `cognitive_upgrade` file and mark the upgrade as blocked by `信息不足`.

`reference_prompt`: `references/cognitive_upgrade.md`

## Execution Rules

This module is not faithful summary. It is controlled model construction based on source anchors.

If no prior `deep_analysis` exists, first do a compact internal extraction:

- author's explicit claim;
- strongest evidence or examples;
- hidden assumption;
- boundary of what the source can support.

Do not merge source-faithful analysis and creative synthesis into one undifferentiated report. When the source is an article, paper, or long argument, write a prior `deep_analysis` file unless the user supplied an already analyzed claim. The upgrade file must clearly separate source claims from creative synthesis.

Run a strict upgrade firewall:

- The `作者原始观点` section may contain only `原文明确`, `合理推断`, and `信息不足`. Do not put external facts there.
- New models, analogies, investment-style labels, decision algorithms, scenarios, and blind-spot diagnoses are `创造性延展`.
- External facts used to motivate the new model must be listed as `外部待验证`; they cannot be used as proof that the source is correct.
- Do not import domain knowledge into the final integrated conclusion unless the user requested external research and it was verified in the current task.

When this module is selected for output, write a standalone `upgrade_model` document in the output folder and end it with `本模块小结`. Place it after source-faithful analysis files and before `99-summary.md`.

## Upgrade Algorithm

1. `Thesis`: Extract the source's core logic. Label it `原文明确` or `合理推断`.
2. `Antithesis`: Build the strongest opposite logic that can also be valid under some condition. Label it `合理推断` unless explicitly present.
3. `Common_Goal`: Find the deeper goal both sides are trying to serve.
4. `Missing_Variable`: Identify the variable ignored by both sides. It should change the frame, not merely average the two positions.
5. `Synthesis`: Rebuild the model around the missing variable. Label as `创造性延展` unless the source explicitly states it.
6. `Ego_Trap`: Name the cognitive blind spot that made the old framing sticky.
7. `Scenario`: Define where the new model should be tested.
8. `Algorithm`: Give a practical action rule or decision procedure.

## Output Template: upgrade_model

### 1. 作者原始观点

- `原文明确`: 写出作者真正说了什么。
- `合理推断`: 写出作者没有明说但论证依赖的前提。
- `信息不足`: 写出无法确认的背景或动机。

### 2. 正题

写出原观点的核心逻辑链：因为 A，所以 B，因此应该 C。

### 3. 反题

写出一个相反但在特定条件下成立的逻辑链。不要写稻草人反对意见。

### 4. 共同目标

说明正题和反题共同试图解决的更底层问题。

### 5. 被忽略变量

指出旧框架忽略的关键变量，并解释它为什么能改变问题结构。
标注这个变量来自 `原文明确`、`合理推断` 还是 `创造性延展`。默认是 `创造性延展`。

### 6. 综合模型

`创造性延展`: 用新变量重构模型，说明正题和反题分别在什么条件下成立。

### 7. 认知盲区

指出原框架为什么会卡住：身份防御、单变量思维、局部最优、线性因果、经验外推、道德化判断等。

### 8. 测试场景

给出一个可以验证新模型是否有效的场景、观察指标或反例条件。
测试场景可以是假设，但必须标明是假设；不得写成已经发生的事实。

### 9. 行动算法

用 3-5 步写出可执行判断流程。每一步都必须来自上面的综合模型。

### 本模块小结

用 3-5 句话说明被升级的旧框架、新变量、综合模型、验证场景和行动方向。明确标出这部分属于 `创造性延展`。
