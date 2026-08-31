---
name: project-skill-evolver
description: 将 session-achieve、skill-evaluator 与 skill-optimizer 串成项目级、可追溯、可回滚的 Agent Skill 进化闭环。用于把多次会话纠偏沉淀为持久 Wiki、回归用例和受门禁保护的技能改进；不用于一次性复盘、单独测评、无证据的 SKILL.md 润色或绕过人工授权的自动改写。
---

# Project Skill Evolver

把项目中的真实纠偏转化为可验证的技能改进。三个元技能保持原职责，本技能只负责阶段编排、持久状态和交接契约：

```text
session-achieve -> Raw Signal -> Project Wiki -> skill-evaluator
      -> evals/evals.json -> skill-optimizer workspace -> AND gate -> keep/discard
```

核心约束：

> Wiki 提供假设，评测提供证据，门禁决定是否保留。没有 Trace 和基线，不得修改目标技能。

## 状态目录

默认把跨会话状态写入项目根目录下的 `.skill-evolution/`：

```text
.skill-evolution/
  signals/           # session-achieve 产生的原始纠偏信号
  wiki/patterns/     # 经审查的候选/生效模式
  wiki/index.md      # 可读索引
  cycles/            # 每个目标技能的一次进化周期
  logs/events.jsonl  # 追加式审计日志
```

首次使用时运行：

```bash
bun skills/project-skill-evolver/scripts/evolution-state.ts init --project-root=<project-root>
```

需要写入或读取上述数据时，先读 [references/contracts.md](references/contracts.md)。

## 工作流

### 1. 捕获真实纠偏

只从以下证据产生 Signal：用户明确纠正、可复现失败及其 Trace、人工确认的复盘结论、已执行评测的失败记录。

调用 `session-achieve` 复盘当前会话。在项目进化模式下，它除复盘 Markdown 外，还必须按契约产出一个 `signal-*.json`。LLM 负责从会话中提炼判断，脚本负责校验和持久化：

```bash
bun skills/project-skill-evolver/scripts/evolution-state.ts ingest \
  --project-root=<project-root> \
  --input=<signal.json>
```

一个信号只描述一个可观察问题和一个候选评测。不要把偏好猜测、礼貌反馈或无来源结论写入 Signal。

### 2. 维护项目 Wiki

相似信号可以整理成 Pattern。LLM 提议归并与指导语，脚本执行晋级约束：

- `candidate`：单条证据或尚未确认；
- `active`：至少两条独立 Signal，或有明确 `human` 决策与理由；
- `rejected`：被证伪、仅属一次性需求或会造成回归。

```bash
bun skills/project-skill-evolver/scripts/evolution-state.ts curate \
  --project-root=<project-root> \
  --input=<pattern.json>
```

外部事实、版本、价格、政策等时效性知识不得作为永久行为规则。若必须记录，在 Pattern 中写明适用版本或失效条件。

### 3. 准备目标技能周期

```bash
bun skills/project-skill-evolver/scripts/evolution-state.ts prepare \
  --project-root=<project-root> \
  --target-skill=<skill-name-or-project-relative-path>
```

命令生成周期 `manifest.json`、`evaluation-brief.md` 和 `optimizer-brief.md`。只加载与目标技能匹配的 Signal 和 `active` Pattern。

读取 `evaluation-brief.md`，调用 `skill-evaluator` 把每个真实失败转成目标技能的 `evals/evals.json` 用例：

- 新问题先进入 `dev`；
- 已修复的真实 Bad Case 进入 `regression`，只增不减；
- 至少包含一个负向/邻近混淆用例；
- `notes` 保留 Signal ID，预期写成可观察行为；
- 能确定性判断时，不使用模型评委。

Raw Signal 不是 Ground Truth。评测预期必须经 Trace、代码行为或人工确认。

### 4. 建立基线

目标技能存在有效的 `evals/evals.json` 后运行：

```bash
bun skills/project-skill-evolver/scripts/evolution-state.ts baseline \
  --project-root=<project-root> \
  --cycle-id=<cycle-id>
```

该命令直接调用 `skill-optimizer/scripts/workspace-init.ts`，在周期目录创建受保护的 `workspace/source/original`、`source/working`、基线 Trace、检查点和日志。若评测缺失，停止在 `needs-eval`，不得先改技能。

### 5. 提议并验证一次原子修改

调用 `skill-optimizer`，只编辑周期工作区中的 `source/working`：

1. 读取周期 Manifest、相关 Pattern、基线失败和历史实验；
2. 生成一项有 Signal/Trace 支撑的原子修改提案；
3. 由显式授权的编辑或确定性脚本应用修改；
4. 运行 `iterate.ts` 完成 checkpoint、dev eval、AND gate 和失败回滚；
5. 严格验收时再跑 holdout 与完整 regression。

必须同时通过 intent metric、boundary、regression、cost 和 safety。加权总分不能覆盖关键维度失败。

### 6. 回写周期结果

```bash
bun skills/project-skill-evolver/scripts/evolution-state.ts record \
  --project-root=<project-root> \
  --cycle-id=<cycle-id> \
  --gate=<cycle-workspace>/logs/last-gate.json
```

`keep` 才能把工作区补丁作为候选交付；`discard` 必须保留失败假设和回滚证据；`needs-human-review` 不得伪装为成功。周期结果可以成为后续 Pattern 晋级证据，但脚本不会自动修改 Wiki 规则。

`keep-with-warning` 默认记录为 `needs-human-review`；人工审查并接受成本警告后，才可在 `record` 命令末尾加入 `--approve-warning`。

## 自引用安全

- 不在产生证据的同一周期修改 `session-achieve`、`skill-evaluator`、`skill-optimizer` 或本技能自身。
- 改进元技能时新建独立周期，并要求人工确认目标、评测与最终补丁。
- 不允许从一条 Signal 直接改写多个目标技能。
- 不允许自动把 `candidate` Pattern 提升为 `active`。

## 交付契约

每次运行报告：

1. 目标技能与周期 ID；
2. 纳入的 Signal/Pattern；
3. 基线与当前评测结果；
4. 修改层、文件与证据；
5. 门禁结论：`keep`、`discard` 或 `needs-human-review`；
6. Wiki 是否有待人工审查的候选更新。

不得只报告“已优化”。必须给出可定位的 Manifest、Trace、Gate 和回滚路径。
