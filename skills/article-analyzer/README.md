# article-analyzer

把文章、论文、报告、随笔与长文论证转成结构化理解，产出一个 Markdown 文件夹。

## 适用场景

- 用户要求做文章分析、论文速读、思想精炼、认知升级（提维）或事实与观点核验。
- 原文篇幅足够长，按模块拆开分析才值得。
- 产物需要保留证据边界，不把原文主张和分析者的解读混在一起。

## 输出

常见的文章分析包：

```text
article-analyzer-<slug>/
  01-deep_analysis.md
  02-thought_refine.md
  03-cognitive_upgrade.md
  99-summary.md
```

常见的论文分析包：

```text
article-analyzer-<slug>/
  01-paper_scan.md
  02-deep_analysis.md
  03-thought_refine.md
  04-cognitive_upgrade.md
  99-summary.md
```

## 公开说明

本技能仅加载当前路由（route，即模块的执行顺序）所需的参考提示词文件，不依赖同级技能，也不依赖私有工作区文件。
