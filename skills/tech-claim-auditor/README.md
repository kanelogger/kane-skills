# Tech Claim Auditor：技术断言审计 Skill

这是一个面向 IT 技术文章的证据化审稿工作流。它提取高风险断言，按文章目标版本联网核验，在高风险项上执行双重独立复核，发生冲突时交由 Arbiter 仲裁，最后生成可追溯报告和最小修复稿。

## 适合处理

- 命令、参数、配置键、API 和默认值
- 特性引入、废弃、GA 与版本兼容性
- 性能数据、产品对比和量化结论
- 最佳实践、前置条件、安全风险和关键遗漏

普通润色、新闻事实核查、原创理论同行评审和代码测试不属于本技能范围。

## 使用方式

- `帮我验证这篇 Kubernetes 教程，重点检查命令参数。`
- `只查不改：检查这篇 Docker 文章有没有过时内容。`
- `先审再改，核查这篇 Linux 调优文章。`

全自动模式只应用一手来源直接支持的高置信度修改，且始终输出新文件，不覆盖原文。

## 输出

- 原文来自文件：`<stem>.verified.md`、`<stem>.verification-report.md`
- 原文来自粘贴文本：`article-verified.md`、`verification-report.md`
- 只查不改：仅生成核验报告

报告包含能力降级、版本范围、断言矩阵、置信度、来源、修改清单和待人工确认项。联网或独立 SubAgent 不可用时会明确降级，不会把静态审查包装成已验证结论。

## 目录

```text
tech-claim-auditor/
├── SKILL.md
├── README.md
├── evals/
│   └── evals.json
└── prompts/
    ├── arbiter.md
    ├── critic.md
    ├── repairer.md
    └── verifier.md
```
