# 创建新技能

**必读**：[技能编写最佳实践](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices)

## 关键要求

| 要求              | 具体内容                                                                 |
| ----------------- | ------------------------------------------------------------------------ |
| **前缀**          | 所有技能都必须带 `kane-` 前缀                                           |
| **name 字段**     | 最多 64 字符，只能用小写字母、数字、连字符|
| **description**   | 最多 1024 字符，用第三人称，写清做什么 + 什么时候用                      |
| **SKILL.md 正文** | 控制在 500 行以内；更多内容放进 `references/`                            |
| **引用**          | 从 SKILL.md 出发只引一层；避免引用里再套引用                             |

## SKILL.md frontmatter 模板

（模板原文如下，按英文原样复制进新技能的 SKILL.md）

```yaml
---
name: kane-<name>
description: <Third-person description. What it does + when to use it.>
version: <semver matching marketplace.json>
metadata:
  openclaw:
    homepage: https://github.com/kanelogger/kane-skills#kane-<name>
    requires:          # include only if skill has scripts
      anyBins:
        - bun
        - npx
---
```

## 步骤

1. 创建 `skills/kane-<name>/SKILL.md`，写好 YAML front matter
2. 如有需要，在 `skills/kane-<name>/scripts/` 中放入 TypeScript 代码
3. 如有需要，在 `skills/kane-<name>/prompts/` 中放入 prompt 模板
4. 在 `.claude-plugin/marketplace.json` 的 `kane-skills` 插件条目下注册该技能
5. 技能带脚本的，在 SKILL.md 中补上“脚本目录”一节
6. 在 frontmatter 中加入 openclaw 元数据

## 如何写 description

**必须用第三人称**：

```yaml
# 正确
description: Generates Xiaohongshu infographic series from content. Use when user asks for "小红书图片", "XHS images".

# 错误
description: I can help you create Xiaohongshu images
```

## Script Directory 模板

每个带脚本的 SKILL.md 都必须包含这一节：

（下面是中文模板，按需调整脚本名与用途说明）

```markdown
##  Script Directory

**重要**：本技能的所有脚本都位于该技能目录下的 `scripts/` 子目录中。

**Agent 执行说明**：
1. 确定本 SKILL.md 文件所在目录的路径，记为 `{baseDir}`
2. 脚本路径 = `{baseDir}/scripts/<script-name>.ts`
3. 确定 `${BUN_X}` 运行时：如果已安装 `bun` → 使用 `bun`；如果可用 `npx` → 使用 `npx -y bun`；否则建议用户安装 bun
4. 将本文档中所有 `{baseDir}` 和 `${BUN_X}` 替换为实际值

**脚本清单**：
| 脚本              | 用途             |
| ----------------- | ---------------- |
| `scripts/main.ts` | 主入口           |
```

## 渐进式披露

内容较多的技能，按这种结构组织文件：

```
skills/kane-example/
├── SKILL.md              # 主指令（< 500 行）
├── references/
│   ├── styles.md         # 按需加载
│   └── examples.md       # 按需加载
└── scripts/
    └── main.ts
```

从 SKILL.md 链接过去（只能一层）：

```markdown
**Available styles**: See [references/styles.md](references/styles.md)
```

## User Input Tools 小节（必需）

凡是会向用户提问、请用户选择的 SKILL.md，都必须在开头附近（简介之后、主流程之前）包含 `## User Input Tools` 小节，并且**有且只有一个小节**。这条规则必须**内联**写进技能文件 —— 不要链接到 `docs/user-input-tools.md`（保持技能自包含）。已有该小节的技能（如 `skills/kane-cover-image/SKILL.md`）可以直接复制整节正文。

标准片段（原样复制，再把 `{…}` 替换成本技能对应的内容）：

```markdown
## User Input Tools

When this skill prompts the user, follow this tool-selection rule (priority order):

1. **Prefer built-in user-input tools** exposed by the current agent runtime — e.g., `AskUserQuestion`, `request_user_input`, `clarify`, `ask_user`, or any equivalent.
2. **Fallback**: if no such tool exists, emit a numbered plain-text message and ask the user to reply with the chosen number/answer for each question.
3. **Batching**: if the tool supports multiple questions per call, combine all applicable questions into a single call; if only single-question, ask them one at a time in priority order.

Concrete `AskUserQuestion` references below are examples — substitute the local equivalent in other runtimes.
```
