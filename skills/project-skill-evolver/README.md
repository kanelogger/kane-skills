# project-skill-evolver

`project-skill-evolver` 是一套项目级 Agent Skill 进化编排技能。它把真实会话中的纠偏信息转化为持久知识、回归评测和可回滚的技能修改。

它连接三个已有元技能：

```text
session-achieve
  ↓ 提取真实纠偏
Raw Signal → Project Wiki
  ↓ 生成评测输入
skill-evaluator
  ↓ 写入 evals/evals.json
skill-optimizer
  ↓ 基线、原子修改、AND 门禁、回滚
keep / discard / needs-human-review
```

## 适用场景

- 从多次用户纠正中发现某个 Skill 的重复失败模式；
- 把线上 Bad Case 沉淀为回归用例；
- 在修改 Skill 前建立基线，并防止触发边界或既有能力退化；
- 为多个 Skill 维护项目级、跨会话的经验 Wiki；
- 记录每次改进的证据、门禁结果和回滚路径。

不适用于一次性会话总结、普通 Prompt 润色、没有证据支持的 `SKILL.md` 改写，或无人审查的全自动自我修改。

## 核心原则

> Wiki 提供假设，评测提供证据，门禁决定是否保留。

- 没有 Signal，不启动进化周期；
- 没有 `evals/evals.json` 和基线，不修改目标 Skill；
- 一个 Signal 只对应一个明确的目标 Skill；
- 单条未经确认的 Signal 不能自动晋级为 `active` Pattern；
- 修改只发生在周期工作区的 `source/working`；
- `needs-human-review` 不能作为成功交付。

## 目录结构

技能包：

```text
project-skill-evolver/
├── SKILL.md
├── README.md
├── agents/openai.yaml
├── references/contracts.md
├── scripts/
│   ├── evolution-state.ts
│   └── self-test.ts
└── evals/
    ├── eval.yaml
    └── cases/
```

运行时状态默认存放在项目根目录的 `.skill-evolution/`：

```text
.skill-evolution/
├── signals/
├── wiki/
│   ├── patterns/
│   ├── history/
│   └── index.md
├── cycles/
└── logs/events.jsonl
```

## 快速开始

以下命令均从项目根目录执行，需要本机安装 Bun。

### 1. 初始化项目状态

```bash
bun skills/project-skill-evolver/scripts/evolution-state.ts init \
  --project-root=/path/to/project
```

### 2. 写入纠偏 Signal

先由 `session-achieve` 在项目进化模式下生成符合 [交接契约](references/contracts.md) 的 Signal JSON，然后执行：

```bash
bun skills/project-skill-evolver/scripts/evolution-state.ts ingest \
  --project-root=/path/to/project \
  --input=/path/to/signal.json
```

### 3. 维护 Wiki Pattern

```bash
bun skills/project-skill-evolver/scripts/evolution-state.ts curate \
  --project-root=/path/to/project \
  --input=/path/to/pattern.json
```

`active` Pattern 至少需要两条不同的 Signal，或一次明确的人工批准。更新已有 Pattern 时增加 `--replace`；旧版本会保存在 `wiki/history/`。

### 4. 创建目标 Skill 的进化周期

```bash
bun skills/project-skill-evolver/scripts/evolution-state.ts prepare \
  --project-root=/path/to/project \
  --target-skill=example-skill
```

该命令会生成：

- `manifest.json`：周期状态和目标路径；
- `evaluation-brief.md`：交给 `skill-evaluator` 的真实失败证据；
- `optimizer-brief.md`：交给 `skill-optimizer` 的生效 Pattern 和门禁要求。

### 5. 建立受保护基线

用 `skill-evaluator` 创建或更新目标 Skill 的 `evals/evals.json` 后执行：

```bash
bun skills/project-skill-evolver/scripts/evolution-state.ts baseline \
  --project-root=/path/to/project \
  --cycle-id=cycle-example
```

脚本会调用现有 `skill-optimizer`，在周期目录创建隔离工作区、基线 Trace、检查点和审计日志。

### 6. 验证并记录结果

在周期工作区中使用 `skill-optimizer` 完成原子修改、评测和 AND 门禁后，回写结果：

```bash
bun skills/project-skill-evolver/scripts/evolution-state.ts record \
  --project-root=/path/to/project \
  --cycle-id=cycle-example \
  --gate=/path/to/project/.skill-evolution/cycles/cycle-example/workspace/logs/last-gate.json
```

`keep-with-warning` 默认进入人工复核。只有人工接受成本警告后，才能附加 `--approve-warning`。

### 7. 查看项目状态

```bash
bun skills/project-skill-evolver/scripts/evolution-state.ts status \
  --project-root=/path/to/project
```

## 状态流转

```text
Signal 已入库
  → Pattern candidate / active / rejected
  → Cycle needs-eval / eval-ready
  → baseline-ready
  → kept / discarded / needs-human-review
```

门禁同时检查主目标指标、触发边界、回归、成本和安全。任一关键维度失败，都不能用总分抵消。

## 自引用保护

修改 `session-achieve`、`skill-evaluator`、`skill-optimizer` 或本技能自身时，必须新建独立周期，并由人工确认目标、评测和最终补丁。产生证据的周期不能同时修改负责产生或判断该证据的元技能。

## 开发验证

运行确定性端到端自测：

```bash
bun skills/project-skill-evolver/scripts/self-test.ts
```

校验 Skill 包结构：

```bash
python3 /Users/kanehua/.codex/skills/.system/skill-creator/scripts/quick_validate.py \
  skills/project-skill-evolver
```

校验行为评测配置：

```bash
skill-up validate skills/project-skill-evolver/evals/eval.yaml
```

行为评测包含三个关键场景：完整闭环、缺少评测时禁止修改、单条 Signal 禁止自动晋级。

## 进一步阅读

- [技能执行规范](SKILL.md)
- [Signal、Pattern、Eval 与 Cycle 契约](references/contracts.md)
