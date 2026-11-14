# kane-migrate-to-rust · 遗留代码迁移至安全 Rust

将 GitHub 仓库或本地遗留代码库迁移为安全 Rust，配套生成架构蓝图、输出一致性验证记录、性能基准和交互式迁移报告。支持 C、C++、Fortran、Java、Python、Shell 等遗留实现。

仅在用户主动调用 `$kane-migrate-to-rust` 或明确要求使用本技能时执行。

## 用法

将包含 [SKILL.md](SKILL.md) 的整个技能目录复制或安装到支持 Agent Skills 的运行时。

```text
使用 $kane-migrate-to-rust，将 /path/to/legacy-project 迁移至 Rust，保持现有输出一致。
```

```text
使用 $kane-migrate-to-rust，分析 https://github.com/owner/repo，先只生成架构蓝图。
```

输入为 GitHub HTTPS 地址或本地目录，可附目标范围、已有构建与运行命令、代表性工作负载、确定性种子和数值容差。若未要求只做蓝图，流程会从审计与规划继续推进到实现和验证。编译或执行从外部仓库克隆的代码前，会先展示命令与工作目录并取得确认。

## 产物

- 架构蓝图与 Rust 工作区，crate 入口使用 `#![forbid(unsafe_code)]`。
- `migration_telemetry.json`，记录真实计时、代码概况、测试修复、一致性检查和基准测试。
- `migration_infographic.html`，展示迁移前后指标、第一人称工程叙事和代码对比。

## 依赖与限制

遥测脚本需要 **Python 3.10+**，只使用标准库。实际迁移还需要 Git、Rust/Cargo、Clippy，以及原项目所需的构建工具；LLVM PGO 需要匹配工具链的 `llvm-profdata`。命令与详细工程约定见 [参考指南](references/pgo_and_telemetry_guide.md)。

验证目标包括零 `unsafe` 块、零 Clippy 警告、至少 95% 分支覆盖率，以及约定数值容差内的输出一致性。自动修复最多 5 轮或每阶段 15 分钟；达到限额后记录未完成项。工具缺失或指标未测量时会如实披露，不将这些目标视为已完成结果。
