# 当前架构

本仓库仅实现 AI 工程控制层，不包含业务运行时。面向 Agent 与开发者的入口相同。

| 层次 | 组成 | 约束 |
| --- | --- | --- |
| 规则入口 | AGENTS.md、rules/ | 导航、工作流、验证、安全与 Git 边界 |
| 任务事实 | tasks/、docs/adr/ | 当前进度与长期取舍分开维护 |
| 环境声明 | project.yml、docs/agent-environment/ | 命令、能力、归属和副作用；声明不等于授权 |
| 确定性工具 | scripts/ | Node 内置模块；诊断、文档门禁、技能管理 |
| 技能 | 内置 agents-maintenance、可选固定来源清单 | 外部来源初始为空，按任务登记并按需恢复 |
| 验证 | Node test、Git fixture、GitHub Actions | CI 与本地共用 pnpm check；不操作生产系统 |

Agent 先恢复任务，再定位子系统、建立验收清单，按权限执行并记录证据。任务结束后归档必要取舍，清理自建临时资源。规则没有自动编排器；状态锁与版本协议须由实际写入方遵守。

没有业务前后端、数据契约、数据库迁移、应用 E2E、视觉基线或发布目标。接入具体项目时，补齐对应架构、子系统、命令、测试与权限说明。

实现入口与失败行为见 [控制工具](../docs/subsystems/agent-tooling.md)，执行要求见 [工作流程](../rules/workflow.md)。
