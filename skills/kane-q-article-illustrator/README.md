# kane-q-article-illustrator

`kane-q-article-illustrator` 用来分析文章结构、规划真正有助于理解的配图，并生成和回填插图。视觉形式会随内容选择，可以是场景、框架、对比、流程、图表、时间线或信息图；需要人物时优先使用 Kane Q。

## 适用场景

- 为 Markdown 文章或长文规划整套配图。
- 把抽象概念、流程、对比关系或关键结论转成视觉内容。
- 在保持文章原文不变的前提下插入生成后的图片链接。

## 输出

- 每张插图的已保存提示词。
- 经过清晰度、准确性和一致性检查的图片。
- 用户要求回填时，包含图片链接的文章文件。

## 使用示例

```text
Use $kane-q-article-illustrator to illustrate this article:

这里粘贴文章，或提供 Markdown 文件路径。
```

跳过方案确认并直接生成：

```text
Use $kane-q-article-illustrator to directly generate three useful illustrations for this Markdown article and insert them into the file.
```

完整执行规范见 [SKILL.md](SKILL.md)。
