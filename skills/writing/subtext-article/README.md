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

内置脚本依赖 Python 3.9+ 标准库，可归一化常见的字幕与转写格式。提供文件或粘贴文本；粘贴内容先保存为唯一命名的转写源文件，再按文件流程打包，包内源文副本为 `00-source.txt`。现有包非空时脚本拒绝覆盖，改用 `--output-dir` 指定新编号目录。

七类产物齐全、终稿对照证据地图验收并披露缺口后才算完成；脚本归一化成功不等于文章完成。缺口妨碍忠实转换时先请用户补充。

中文文风规范直接写在本技能内，因此整个包被复制或分发后仍可独立使用。原文保真要求优先，例外情况需记录。
