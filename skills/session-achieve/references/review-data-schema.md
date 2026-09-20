# 复盘数据格式

`scripts/generate-review.js` 接受一个 UTF-8 JSON 文件。所有结论应先从当前可见会话、工具输出或产物中取得证据，再写入数据文件。

## 字段

```json
{
  "reportTime": "2026-09-20 14:30:00",
  "scope": "当前可见会话（用户初始请求至最终验证）",
  "status": "已完成",
  "turns": 8,
  "originalGoal": "用户希望……",
  "finalOutcome": "已生成……，并通过……验证。",
  "assessment": {
    "level": "部分达成",
    "rate": 75,
    "rationale": "4 项验收标准中通过 3 项。",
    "verification": [
      "测试 A：通过",
      "检查 B：未执行"
    ]
  },
  "evidence": [
    {
      "ref": "用户第 3 轮",
      "type": "用户纠正",
      "observation": "用户要求 README 使用中文。",
      "response": "将 README 全部改为中文。",
      "resolution": "已完成"
    }
  ],
  "corrections": [
    {
      "ref": "用户第 3 轮",
      "deviation": "初稿使用英文 README。",
      "instruction": "README 用中文表达。",
      "action": "重写 README。",
      "result": "中文检查通过。"
    }
  ],
  "explicitConstraints": [
    {
      "title": "文档语言",
      "description": "README 必须使用中文。"
    }
  ],
  "inferredPreferences": [
    {
      "title": "偏好可验证交付",
      "description": "用户多次要求给出测试证据。",
      "evidenceRefs": ["用户第 2 轮", "用户第 5 轮"],
      "confidence": "高"
    }
  ],
  "unknowns": [
    "尚未在 Windows 环境验证。"
  ],
  "reusablePrompt": "请完成 {{任务}}……",
  "reusablePromptReason": "该流程会重复使用，且约束稳定。",
  "summary": {
    "keyInsight": "最重要的发现",
    "lesson": "下次应避免的问题",
    "reusability": "适用的相似场景"
  }
}
```

## 必填与取值

必填字段：

- `scope`
- `originalGoal`
- `finalOutcome`
- `assessment.level`
- `assessment.rationale`

`assessment.level` 只能是：`已达成`、`部分达成`、`未达成`、`无法判断`。

`assessment.rate` 可省略。只有存在明确评分项或用户要求量化时才填写，取值为 0–100。

`status`、`turns`、各数组、`reusablePrompt` 和 `summary` 均可省略。数组为空时，生成器会写明“未发现”或“无”。不确定的信息放入 `unknowns`，不要用猜测补齐。

结构化条目要求：

- `evidence` 每项至少包含 `ref` 和 `observation`；
- `corrections` 每项至少包含 `ref`、`deviation`、`instruction` 和 `action`；
- `inferredPreferences` 每项必须包含非空的 `evidenceRefs`，同时标注 `confidence`；
- `explicitConstraints` 可使用非空字符串，或包含 `title` 与 `description` 的对象；
- `unknowns` 与 `assessment.verification` 只接受非空字符串。

若不应生成可复用提示词，省略 `reusablePrompt`，并在 `reusablePromptReason` 中说明原因。

## 命令

```bash
node scripts/generate-review.js --data review-data.json
node scripts/generate-review.js --data review-data.json --output reports/review.md
node scripts/generate-review.js --data review-data.json --output reports/review.md --force
```

默认文件名使用本地时间。未传 `--force` 时不会覆盖已有文件。
