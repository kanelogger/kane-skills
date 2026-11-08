# article-analyzer

把文章、论文、报告、随笔与长文论证转成结构化理解，产出一个 Markdown 文件夹。

在 Codex 中输入 `$article-analyzer` 显式调用。

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

## 输入与完成边界

需提供可读取的正文、文件或明确来源；普通摘要和随口“分析一下”不触发多文件流程。默认文章包与论文包都包含认知升级，参考文档遵循同一路由；仅在用户明确要求或材料不足时跳过，并在综合文档记录原因，不生成空占位文件。外部事实核验只在明确要求时执行。

仅做事实/观点核验时输出核验文件和综合文档；同时要求深度分析时依次生成 `01-deep_analysis.md`、`02-fact_opinion_audit.md`、`99-summary.md`。所有已选模块及索引写完、证据边界检查通过才算完成。

## 公开说明

本技能仅加载当前路由（route，即模块的执行顺序）所需的参考提示词文件，不依赖同级技能，也不依赖私有工作区文件。
