---
name: kane-migrate-to-rust
disable-model-invocation: true
description: >-
  仅在用户显式调用时执行。从 GitHub URL 或本地目录克隆、分析、规划并迁移遗留代码库（C++、Fortran、Java、
  Python、C、Shell），构建现代、高性能、确定性的 100% 安全 Rust 架构；
  在每个任务计时分组、测试失败与修复周期以及基于性能剖析的优化（PGO）阶段跟踪实时遥测，
  并生成以 AI 第一人称叙述的报告和交互式 HTML 信息图。适用于将 GitHub 仓库或本地代码库
  迁移至 Rust，将遗留 C++、Fortran、Python 或 Java 工作负载移植至内存安全的 Rust，
  设计数组结构（SoA）或 SIMD Rust 架构，或使用 LLVM PGO 优化 Rust 移植版本。
  不适用于与 Rust 无关的重构或单行语法问题。
---

# 将遗留代码库迁移至安全 Rust

仅在用户主动调用本技能（例如 `$kane-migrate-to-rust`）或明确要求使用本技能时执行，不得根据任务内容自动触发。

担任系统架构师、性能工程师和 Rust 专家。目标是将遗留代码库迁移为经过 PGO 调优的 100% 安全 Rust，同时通过
[`scripts/telemetry.py`](scripts/telemetry.py) 记录实测遥测数据和第一人称工程叙事。

## User Input Tools

1. **优先用内置的用户输入工具**：如果当前 agent 运行时提供了这类工具——比如 `AskUserQuestion`、`request_user_input`、`clarify`、`ask_user`，或任何等价工具。
2. **回退到纯文本**：如果没有这类工具，就输出一条带编号的纯文本消息，请用户针对每个问题回复所选的编号或答案。
3. **批量提问规则**：
   - 如果工具支持**一次调用提多个问题**（例如 `AskUserQuestion`）：**把所有适用问题合并成一次调用。不要拆成多次调用。**
   - 如果工具**一次调用只能问一个问题**（例如单次提问的 `clarify`）：按优先级顺序，**一次问一个问题**。

此规则覆盖技能正文及随附参考文档中的所有用户交互。其他位置的具体工具名仅作示例，执行时替换为当前运行时的等价工具。

## 脚本目录

先确定本 `SKILL.md` 所在目录的绝对路径，记为 `{baseDir}`。下文中的 `scripts/` 路径均相对此目录解析，不相对用户项目目录查找脚本。

脚本使用 **Python 3.10 或更新版本**，仅依赖 Python 标准库，无需安装第三方 Python 包。调用方式为 `python3 "{baseDir}/scripts/telemetry.py" <子命令> <参数>`；将占位符替换为实际值。

| 脚本 | 用途 |
| ---- | ---- |
| `scripts/telemetry.py` | 记录任务计时、代码概况、测试与一致性迭代、基准测试，并渲染 HTML 信息图 |

## 执行约定与可移植性

迁移仓库或本地目录（`{github_url}` 或 `{codebase_path}`）时，在各类智能体执行框架中遵循以下规则：

1.  **阶段 0：外部代码确认关卡**：克隆外部仓库并检查其构建文件后，**向用户展示已确定的遗留项目构建命令、运行命令和目标目录，并在编译或执行克隆的代码前取得确认**。（对于用户已明确要求运行的本地代码，或已取得阶段 0 确认的情况，直接继续。）
2.  **从阶段 1 连续推进至阶段 2**：阶段 0 的基线采集完成后，在宿主环境允许自主执行工具的情况下，直接从编写架构蓝图（阶段 1）进入 Rust 工作区的实现与验证（阶段 2），不在里程碑之间暂停。
3.  **有界自动修复（最多 5 轮）**：当测试、`clippy` 检查或 A/B 一致性检查失败时，通过
    [`scripts/telemetry.py`](scripts/telemetry.py) 记录失败，诊断并修复根因，然后自动重新测试，最多进行 **5 轮自动修复**（或每阶段 15 分钟）。若达到限额后仍有测试或种子产生差异，在 `migration_telemetry.json` 中记录当前部分完成的状态，并在最终报告中说明剩余差距，避免无限循环。
4.  **验证目标与完成定义**：
    -   带有 `#![forbid(unsafe_code)]` 的 Rust crate 能成功编译，目标是 `cargo clippy` 警告数为 `0`（任何无法避免的例外都必须记录）。
    -   单元测试、集成测试、文档测试和基于属性的测试（`proptest`）全部通过，目标分支覆盖率为 `>= 95%`（任何无法避免的例外都必须记录），每次运行均记录到 `migration_telemetry.json`。
    -   在有记录的数值 epsilon 容差（`--max-abs-error`）内，验证 `N` 个确定性种子下的 A/B 差分输出一致性，并查明和记录所有浮点运算、FMA 或 PRNG 差异的根因。
    -   测量并记录全部 4 个基准阶段（`legacy_baseline`、`safe_rust`、`soa_simd`、`pgo_lto`）；若 `llvm-profdata` 等工具不可用，可明确省略相应阶段。
    -   通过 `scripts/telemetry.py render-infographic` 渲染交互式 HTML 信息图（`migration_infographic.html`）。

## 端到端工作流检查清单

复制此清单，跟踪三个阶段的进度（详细命令用法和架构规范见
[references/pgo_and_telemetry_guide.md](references/pgo_and_telemetry_guide.md)）：

```markdown
- [ ] 阶段 0：获取仓库，初始化 `migration_telemetry.json`（`discovery` 任务计时分组），扫描遗留代码库，确认已确定的构建与运行命令，并测量基线性能
- [ ] 阶段 1：审计遗留代码（`blueprint` 任务计时分组），记录优化机会与遗留代码中的潜在缺陷，生成包含 6 节的架构蓝图
- [ ] 阶段 2.1：搭建带有 `#![forbid(unsafe_code)]` 的 Rust 工作区与确定性 PRNG 一致性层（`rewrite` 任务计时分组）
- [ ] 阶段 2.2：实现核心领域类型与 SoA/SIMD 内核（目标为每文件 <= 400 行代码，完整 rustdoc），并测量 `safe_rust` + `soa_simd` 基准性能
- [ ] 阶段 2.3：执行验证试炼（`test_heal` 任务计时分组，最多 5 轮）——记录首次测试失败率及每次自动修复
- [ ] 阶段 2.4：在有记录的 epsilon 容差内，针对 N 个种子运行 A/B 差分一致性测试工具（`parity` 任务计时分组，最多 5 轮）
- [ ] 阶段 2.5：执行 LLVM 基于性能剖析的优化（`pgo_bench` 任务计时分组），扫描最终 Rust 代码库，并渲染 `migration_infographic.html`
```

--------------------------------------------------------------------------------

## 阶段 0：获取仓库、初始化遥测与测量遗留代码基线

从仓库或目录中确定上下文参数：

参数                         | 占位符                                | 确定方式
:-------------------------------- | :----------------------------------------- | :------------------
**源输入**                  | `{codebase_path}` 或 `{github_url}`        | 接受 GitHub URL（`https://github.com/...`）或本地文件系统路径
**原语言／框架** | `{legacy_language}`                        | 根据文件扩展名和构建文件（`CMakeLists.txt`、`Makefile`、`meson.build`、`pyproject.toml`、`pom.xml`、`*.f90`、`*.cpp`）自动检测
**基线运行命令**          | `{baseline_run_command}`                   | 从 `README.md`、CI 工作流（`.github/workflows/*.yml`）、`Makefile` 或测试脚本中确定
**遥测台账**              | `{workspace_dir}/migration_telemetry.json` | 在阶段 0 开始时通过 `scripts/telemetry.py init` 初始化

### 阶段 0 执行步骤

1.  **克隆仓库（输入为 GitHub URL 时）**：选择一个干净的本地目录（默认为 `~/rust_migrations/{repo_name}`；如果用户要求，也可位于当前工作区内），运行 `git clone {github_url} ~/rust_migrations/{repo_name}`。
2.  **初始化遥测并扫描遗留代码库**：运行 `scripts/telemetry.py init --telemetry "{workspace_dir}/migration_telemetry.json" --project-name "{project_name}" --legacy-lang "{legacy_language}"`。启动 `discovery` 任务计时分组，并对遗留源代码目录运行 `scripts/telemetry.py scan-codebase --phase before`，记录基线文件数、代码行数、注释密度百分比、单文件最大代码行数、嵌套深度、平均函数长度，以及裸指针／内存风险。
3.  **确认并测量遗留代码基线**：在执行从外部克隆的仓库中的构建或运行命令前，向用户展示已确定的构建命令、`{baseline_run_command}` 和工作目录以供确认。确认后，以发布模式（`-O3` / `Release`）编译遗留项目，采集各个确定性种子下的标准参考输出，测量基线实际运行耗时（ms）和峰值常驻内存（MB），并通过 `scripts/telemetry.py log-benchmark --stage legacy_baseline` 记录基准阶段 1。

--------------------------------------------------------------------------------

## 阶段 1：深入审计、发现优化机会与编写架构蓝图

启动 `blueprint` 任务计时分组（`scripts/telemetry.py start-bucket --bucket blueprint`），检查仓库，记录每个发现的优化机会和**遗留代码中的潜在缺陷**（`scripts/telemetry.py log-opportunity`），并生成
[references/pgo_and_telemetry_guide.md](references/pgo_and_telemetry_guide.md) 第 2 节定义的包含 6 节的 Markdown 蓝图。

**阶段 1 -> 阶段 2 的衔接**：保存蓝图并直接进入阶段 2（除非用户明确要求只提供蓝图规划）。

--------------------------------------------------------------------------------

## 阶段 2：分步实现安全 Rust、自动修复、PGO 与信息图

每一步都遵循
[references/pgo_and_telemetry_guide.md](references/pgo_and_telemetry_guide.md)
中的命令用法和核心工程标准：

### 步骤 1：搭建安全 Rust 工作区并移植模块（`rewrite` 任务计时分组）

1.  启动 `rewrite` 任务计时分组（`scripts/telemetry.py start-bucket --bucket rewrite`）。
2.  初始化 Rust 工作区，在 `src/lib.rs` 和 `src/main.rs` 中加入 `#![forbid(unsafe_code)]`。
3.  按依赖顺序实现确定性 PRNG 包装器、领域类型和模块（目标为每文件 `<= 400` 行代码，提供完整的 `//!` 和 `///` rustdoc，并包含可运行的文档测试）。
4.  通过 `scripts/telemetry.py log-benchmark` 测量并记录基准阶段 2（`safe_rust`）和基准阶段 3（`soa_simd`）。

### 步骤 2：验证试炼——测试、失败、诊断与修复（`test_heal` 任务计时分组）

1.  启动 `test_heal` 任务计时分组（`scripts/telemetry.py start-bucket --bucket test_heal`）。
2.  编写单元测试、可运行的文档测试和 `proptest` 边界测试。
3.  运行 `cargo test --all-targets`、`cargo test --doc` 和 `cargo clippy --all-targets`。
4.  **记录每一轮（最多 5 轮）**：在第 1 次及后续每次运行后，调用 `scripts/telemetry.py log-test-run`，记录测试总数、通过数、失败数、覆盖率百分比、clippy 警告数、诊断摘要和已采取的修复。持续迭代，直至失败数为 `0`、警告数为 `0`（或达到 5 轮限额，并记录任何无法避免的例外）。

### 步骤 3：A/B 差分输出一致性（`parity` 任务计时分组）

1.  启动 `parity` 任务计时分组（`scripts/telemetry.py start-bucket --bucket parity`）。
2.  针对 `N` 个确定性种子运行自动化 A/B 差分测试工具，在有记录的 epsilon 容差内比较 `{baseline_run_command}` 与 Rust 二进制程序的输出。
3.  通过 `scripts/telemetry.py log-parity-run` 记录每轮一致性检查。若任何种子的差异超过 epsilon，通过二分定位首个出现差异的步骤，修复差异并重新运行（最多 5 轮）。

### 步骤 4：基于性能剖析的优化（PGO）与最终基准测试（`pgo_bench` 任务计时分组）

1.  启动 `pgo_bench` 任务计时分组（`scripts/telemetry.py start-bucket --bucket pgo_bench`）。
2.  执行
    [references/pgo_and_telemetry_guide.md](references/pgo_and_telemetry_guide.md)
    中的 LLVM PGO 工作流：使用 `RUSTFLAGS="-Cprofile-generate=./pgo-data"` 构建，运行具有代表性的工作负载，通过 `llvm-profdata` 合并性能剖析数据，再使用 `RUSTFLAGS="-Cprofile-use=./pgo-data/merged.profdata"` 和 `lto = "fat"` 重新构建（如果 `llvm-profdata` 不可用，则使用文档中说明的 `-Ctarget-cpu=native` 回退方案）。
3.  验证 PGO 二进制程序仍能通过测试和 A/B 一致性检查，然后测量实际运行耗时和峰值常驻内存，并通过 `scripts/telemetry.py log-benchmark --stage pgo_lto` 记录基准阶段 4（`pgo_lto`）。

### 步骤 5：最终代码概况统计、AI 第一人称叙事与可视化信息图

1.  对 `src/` 运行 `scripts/telemetry.py scan-codebase --phase after`，采集最终代码行数、`<= 400` 行代码的合规情况、注释／rustdoc 密度、可运行的文档测试、嵌套深度和 `unsafe` 块数。
2.  记录**迁移前后代码亮点对比**（`scripts/telemetry.py log-spotlight`），并填充 **AI 第一人称叙事章节**（`scripts/telemetry.py set-story`）。
3.  结束 `pgo_bench` 任务计时分组并渲染交互式 HTML 信息图（其中 `{skill_dir}` 为此 `SKILL.md` 所在的目录）：

    ```bash
    python3 "{skill_dir}/scripts/telemetry.py" render-infographic \
      --telemetry "{workspace_dir}/migration_telemetry.json" \
      --out "{output_dir}/migration_infographic.html" \
      --scope-summary "{short_summary_of_ported_modules}"
    ```
4.  输出简洁的管理层摘要，引用生成的 `migration_infographic.html` 报告和迁移前后实测的关键指标。

--------------------------------------------------------------------------------

## 随附资源

-   **遥测与信息图 CLI**：
    [`scripts/telemetry.py`](scripts/telemetry.py)
-   **工程标准、蓝图规范、PGO 与遥测命令用法**：
    [references/pgo_and_telemetry_guide.md](references/pgo_and_telemetry_guide.md)
-   **交互式 HTML 信息图模板**：
    [references/infographic_template.html](references/infographic_template.html)
