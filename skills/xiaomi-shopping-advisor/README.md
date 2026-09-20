# xiaomi-shopping-advisor

以可比的小米具体型号作为价格和能力锚点，分析便宜款减配了什么、贵款的提升是否值得，并生成带真实产品图片和响应式对比表的独立 HTML 网购报告。

## 适合处理

- “这个品类买哪款？”
- “比小米便宜的型号减配在哪里？”
- “多花钱买安克、徕芬、石头、极米等品牌是否值得？”
- “帮我做一份带图片、价格、参数和来源的商品横评网页。”

## 核心原则

- 小米是比较锚点，不是默认答案。
- 只比较当前在售的精确 SKU，不混用系列、容量和代际。
- 价格、参数、认证、图片和结论都要能追溯到来源。
- 品牌经验只负责发现候选，不能替代产品证据。
- 安全、兼容和硬性需求先门禁，再讨论综合性价比。
- 主交付物是可直接打开的 `index.html`，每个候选都包含本地产品图。

## 输出

```text
shopping-report-<category>-YYYY-MM-DD/
├── index.html
└── assets/products/
    └── <brand>-<model>.webp
```

HTML 包含首屏结论、产品卡片、锚点式对比表、减配与溢价审计、场景化建议、调研日期和证据来源。

## 使用示例

- `Use $xiaomi-shopping-advisor to 推荐 500 元以内的吹风机，输出带产品图的 HTML 对比报告。`
- `用 $xiaomi-shopping-advisor 比较小米、安克和其他 100W 充电器，重点检查安全与协议兼容。`
- `用 $xiaomi-shopping-advisor 分析扫地机器人，比小米更贵的型号究竟升级了什么？`

## 评测

`evals/` 使用文章中的两个真实产品执行端到端测试：小米巨能写与小米彩虹电池。每个用例都要求核验当前市场、生成带本地产品图的 HTML 横评，并通过结构和商品特定规则校验。

```bash
skill-up validate evals/eval.yaml
skill-up run evals/eval.yaml
```
