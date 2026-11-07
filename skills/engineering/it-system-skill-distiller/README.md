# it-system-skill-distiller

把已有的 IT 业务系统、SaaS 产品、内部工具或遗留应用蒸馏成 AI 可读的技能包。

## 适用场景

- 用户提供了需求、数据库结构、领域对象、源码、API 路由或遗留系统笔记。
- 目标是抽取领域语义、业务规则、用例级 API、Schema、枚举、错误码、验证场景和冲突清单。
- 产物应当成为另一个智能体可复用的 `distilled/` 知识包。

## 输出

一个结构化的 `distilled/` 包，由内置脚本校验：

```text
distilled/
  README.md
  domain/
  api/
  reference/
  validation/
```

可用脚本：

```text
scripts/init_distilled_package.py
scripts/validate_distilled_package.py
scripts/smoke_agent_run.py
```

## 公开说明

这个公开包只包含模板、校验器和冒烟测试脚手架。不要把专有系统导出物或客户数据提交进技能包。
