# 项目进化契约

本文件定义 `session-achieve`、`skill-evaluator`、`skill-optimizer` 之间的持久化交接格式。所有 ID 使用 3–64 位小写字母、数字和连字符。

## Signal v1

一个 Signal 只记录一个可观察问题。由 `session-achieve` 或已执行评测提炼，写入前必须保留原始证据定位。

```json
{
  "schema_version": "v1",
  "id": "sig-20260831-missing-negative-case",
  "source": {
    "kind": "session-achieve",
    "artifact": "achieved-20260831-120000.md",
    "observed_at": "2026-08-31T12:00:00+08:00"
  },
  "target_skill": "example-skill",
  "problem": "相邻请求会误触发目标技能。",
  "evidence": [
    {
      "kind": "user-correction",
      "ref": "session:turn-7",
      "summary": "用户指出该请求应由另一技能处理。"
    }
  ],
  "proposed_eval": {
    "prompt": "一个真实的相邻请求",
    "expected_signal": "目标技能不应触发，并说明正确边界。",
    "split": "dev"
  }
}
```

`source.kind` 可取 `session-achieve`、`eval-failure`、`human-review`。`proposed_eval.split` 仅可为 `dev` 或 `regression`。

`target_skill` 必须是一个明确的技能名，不接受 `*` 或 `[待确认]`。同一问题影响多个技能时，为每个目标分别建立 Signal 和周期。

## Pattern v1

Pattern 是 Wiki 中经归并的项目经验，不是事实真理。

```json
{
  "schema_version": "v1",
  "id": "pattern-adjacent-trigger-boundary",
  "title": "相邻技能触发边界",
  "status": "active",
  "applies_to": ["example-skill"],
  "summary": "共享词汇不足以证明应触发，描述中需要明确排除相邻意图。",
  "guidance": {
    "do": ["加入真实负向用例和邻近混淆用例"],
    "avoid": ["仅凭关键词扩大 description"]
  },
  "source_signal_ids": [
    "sig-20260830-trigger-1",
    "sig-20260831-trigger-2"
  ],
  "decision": {
    "authority": "rule",
    "rationale": "两次独立会话出现同类可复现误触发。"
  },
  "validity": {
    "scope": "Agent Skill routing",
    "expires_when": "目标运行时的技能路由机制发生变化"
  }
}
```

`status` 可取 `candidate`、`active`、`rejected`。`active` 至少需要两条已入库 Signal；一条证据时只能由 `decision.authority: human` 显式批准。更新已有 Pattern 时使用 `--replace`，旧版本会进入 `wiki/history/`。

## 目标评测契约

`skill-evaluator` 在项目进化模式下输出 `skill-optimizer` 原生的 `<target-skill>/evals/evals.json`：

```json
{
  "skill_name": "example-skill",
  "version": 1,
  "cases": [
    {
      "id": "regression-adjacent-trigger-1",
      "type": "adjacent-confusion",
      "prompt": "一个真实的相邻请求",
      "expected_signal": "目标技能不应触发。",
      "assertions": [
        {
          "name": "should-not-trigger",
          "method": "external_judgment",
          "expect": "yes",
          "criteria": "路由结果未选择目标技能。"
        }
      ],
      "split": "regression",
      "source": "manual",
      "notes": "source_signal=sig-20260831-missing-negative-case"
    }
  ]
}
```

允许的 `split` 为 `dev`、`holdout`、`regression`、`flaky`。允许的断言方法以 `skill-optimizer/references/eval-schema.md` 为准。Signal 提出的 `split` 只是建议：未确认的用例先放 `dev`；真实 Bad Case 修复并验证后才进入 `regression`。

## Cycle Manifest

`prepare` 自动生成，不手写。关键字段：

- `id`、`target_skill`、`target_skill_path`；
- `signal_ids`、`pattern_ids`；
- `phase`：`needs-eval`、`eval-ready`、`baseline-ready`、`kept`、`discarded`、`needs-human-review`；
- `eval_suite` 与 `workspace`；
- `created_at`、`updated_at`。

`record` 只接受该周期 `workspace/logs/last-gate.json`，据此更新终态并把完整 Gate 快照保存为 `cycles/<id>/result.json`。`keep-with-warning` 只有在显式传入 `--approve-warning` 后才记为 `kept`。
