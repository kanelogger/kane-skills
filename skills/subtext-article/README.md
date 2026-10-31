# subtext-article

把字幕、ASR 转写结果、逐字稿导出和复制来的字幕文本，整理成忠实原文的长篇中文文章。

## 适用场景

- 来源是视频字幕、B 站 AIsubtitle JSON、YouTube 转写文本、SRT/VTT/ASS/SSA/LRC、Whisper 风格 JSON、播客转写或口语稿。
- 用户想要一篇可发布的中文文章，同时保留原主张、顺序、数据、例子和关键引文。

## 输出

对文件输入，技能会创建一个包目录：

```text
<source-stem>_article/
  00-source.<ext>
  01-normalized.txt
  02-evidence-map.md
  03-draft.md
  04-self-check.md
  article.md
  manifest.json
```

## 公开说明

内置脚本可归一化常见的字幕与转写格式。公开示例可在确认内容可分享后补充到 `examples/`。

中文文风规范直接写在本技能内，因此整个包被复制或分发后仍可独立使用。原文保真要求优先，例外情况需记录。
