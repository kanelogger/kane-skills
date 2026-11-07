# 工作流程机制

源文件落地、输出目录创建与冲突处理的细节。

## 落地源文件

| 输入类型 | 动作 |
|----------|------|
| 文件 | 原样使用（无需复制） |
| 内联文本 | 保存到 `translate/{slug}.md` |
| URL | 抓取内容，保存到 `translate/{slug}.md` |

`{slug}`：由内容主题派生的 2–4 个词的 kebab-case 短名。

## 创建输出目录

在源文件旁边创建子目录：`{source-dir}/{source-basename}-{target-lang}/`（`{target-lang}` 为主语言码：`zh-CN` → `zh`、`en-US` → `en`）

最终译文保留源文件的完整文件名（含扩展名），放入输出目录。示例：
- `posts/article.md` → `posts/article-zh/article.md`
- `translate/ai-future.md` → `translate/ai-future-zh/ai-future.md`

## 冲突处理

若输出目录已存在，先把已有的重命名为 `{name}.backup-YYYYMMDD-HHMMSS/`，再创建新目录。绝不覆盖已有结果。
