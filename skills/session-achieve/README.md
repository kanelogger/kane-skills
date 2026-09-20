# session-achieve

`session-achieve` 用于复盘当前可见的多轮会话：还原目标与结果、定位关键纠偏、区分明确约束与推断偏好，并在值得复用时生成下一次可直接使用的提示词。

## 适用场景

- 复盘这次对话或协作过程；
- 分析为什么经过多轮纠正才得到结果；
- 从真实纠偏中提炼可复用的工作约束；
- 为 `project-skill-evolver` 提供有证据的原始信号。

以下场景不适用：

- 普通文章或会议内容摘要；
- 代码审查、PR 审查；
- 只优化一段已有提示词；
- 当前上下文不可见的历史会话。

## 设计原则

- 只引用当前可见会话、工具结果和产物，不补写不可见历史；
- 结论区分为事实、推断和未知；
- 达成度默认使用“已达成 / 部分达成 / 未达成 / 无法判断”，有可靠评分依据时才给百分比；
- 不强制制造错误、隐性偏好或“完美提示词”；
- 默认不覆盖同名报告文件。

## 产物

默认生成：

```text
achieved-YYYYMMDD-HHMMSS.md
```

报告包含复盘范围、目标与最终结果、达成评价、证据、纠偏、明确约束、推断偏好、未知项、可复用提示词判断和复盘总结。

## 使用方式

在支持 Agent Skills 的环境中调用：

```text
使用 $session-achieve 复盘当前会话，重点分析关键纠偏和仍未验证的事项。
```

Agent 可直接填写 `assets/achieved_template.md`。需要从结构化数据稳定生成报告时：

```bash
node scripts/generate-review.js --data review-data.json
```

输入格式见 `references/review-data-schema.md`。指定输出位置可使用：

```bash
node scripts/generate-review.js --data review-data.json --output reports/review.md
```

目标文件已存在时，脚本会自动生成 `review-2.md`；只有显式传入 `--force` 才会覆盖。

## 本地验证

```bash
node --test skills/session-achieve/tests/generate-review.test.js
python3 /path/to/skill-creator/scripts/quick_validate.py skills/session-achieve
```

## 隐私说明

不要把私人会话原文提交到技能仓库。运行时只在用户授权的工作区生成复盘产物；报告应保留必要证据摘要，避免复制无关敏感内容。
