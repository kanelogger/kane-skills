# 蒸馏技能包目录结构

在目标系统的输出目录下创建以下结构，默认路径通常是 `<目标系统根目录>/distilled`。

```text
distilled/
├── README.md
├── 00-overview.md
├── 01-glossary.md
├── domain/
│   ├── _index.md
│   └── <business-object>.md
├── api/
│   ├── _index.md
│   └── <business-domain>/
│       └── <use-case-action>.md
├── reference/
│   ├── schema/
│   │   └── <table-or-resource>.md
│   ├── enums.md
│   ├── error-codes.md
│   └── model-code-conflicts.md
├── requirements/
│   └── _index.md
└── validation/
    ├── scenarios.md
    └── results.md
```

## 分层职责

`README.md`
: 入口文件。写阅读顺序、加载策略、目录导航、资料盘点和写权限提醒。

`00-overview.md`
: 系统全景。用短文档给 AI 建立业务世界观：系统定位、业务边界、核心链路、对象清单、能力清单和 AI 操作约定。

`01-glossary.md`
: 术语表。对齐业务术语、用户口语、代码名、别名和容易混淆的概念。

`domain/`
: 语义层。一个核心业务对象一个文件。只写领域语义、关系、生命周期和规则，不堆字段明细。

`api/`
: 能力层。写业务用例级 API。一个文件对应一个完整业务动作，让 AI 能从自然语言意图选择能力。

`reference/`
: 明细层。按需检索字段、数据库表、枚举、错误码、冲突和实现细节，不常驻上下文。

`requirements/`
: 来源追溯。保留原始需求摘录，并映射到蒸馏后的对象和能力。

`validation/`
: 验证层。保存静态检查、动态场景、实跑日志、结论、缺口和修复记录。

## 命名规则

- 文件名使用小写 kebab-case。
- 领域对象文件名使用稳定英文别名，例如 `contract.md`。
- API 文件名使用动作型命名，例如 `create-contract.md`、`receive-payment.md`、`query-open-invoices.md`。
- API 字段名沿用代码实际返回，通常是 camelCase 或 snake_case，不为了美观改名。
- 交叉引用使用 `[[slug]]`，`slug` 是目标文件名去掉 `.md`。

## 加载策略

常驻加载：

- `README.md`
- `00-overview.md`
- `01-glossary.md`
- `domain/_index.md`
- 关键 `domain/*.md`
- `api/_index.md`

按需检索：

- 具体 `api/<domain>/<use-case>.md`
- `reference/schema/*.md`
- `reference/enums.md`
- `reference/error-codes.md`
- `reference/model-code-conflicts.md`
- `requirements/_index.md`

