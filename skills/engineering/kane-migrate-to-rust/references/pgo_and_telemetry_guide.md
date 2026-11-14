# 工程标准、蓝图规范、PGO 流水线与遥测参考

本参考文档提供核心工程标准、由 6 个部分组成的架构蓝图
规范、通过 [`scripts/telemetry.py`](../scripts/telemetry.py) 持续记录
迁移遥测的精确命令示例，以及
LLVM 基于性能剖析的优化（PGO）流水线。

## 目录

-   [1. 核心工程与验证标准](#1-核心工程与验证标准)：
    第 33-102 行
-   [2. 阶段 1 架构蓝图规范（6 个部分）](#2-阶段-1-架构蓝图规范6-个部分)：
    第 104-141 行
-   [3. 持续遥测生命周期（`scripts/telemetry.py`）](#3-持续遥测生命周期scriptstelemetrypy)：
    第 143-281 行
    -   [步骤 A：初始化遥测并扫描遗留代码库（`discovery` 任务计时分组）](#步骤-a初始化遥测并扫描遗留代码库discovery-任务计时分组)：
        第 150-183 行
    -   [步骤 B：记录改进机会与遗留代码中的潜在缺陷（`blueprint` 任务计时分组）](#步骤-b记录改进机会与遗留代码中的潜在缺陷blueprint-任务计时分组)：
        第 184-208 行
    -   [步骤 C：安全 Rust 重写与模块化（`rewrite` 任务计时分组）](#步骤-c安全-rust-重写与模块化rewrite-任务计时分组)：
        第 209-224 行
    -   [步骤 D：记录每次测试运行与自动修复（`test_heal` 任务计时分组）](#步骤-d记录每次测试运行与自动修复test_heal-任务计时分组)：
        第 225-251 行
    -   [步骤 E：记录 A/B 差分一致性迭代（`parity` 任务计时分组）](#步骤-e记录-ab-差分一致性迭代parity-任务计时分组)：
        第 252-281 行
-   [4. 基于性能剖析的优化（PGO）工作流（`pgo_bench` 任务计时分组）](#4-基于性能剖析的优化pgo工作流pgo_bench-任务计时分组)：
    第 283-361 行
-   [5. 最终代码概况统计、第一人称叙事与信息图生成](#5-最终代码概况统计第一人称叙事与信息图生成)：
    第 363-415 行

--------------------------------------------------------------------------------

## 1. 核心工程与验证标准

阶段 1 的每项架构决策以及阶段 2 实现的每个模块
都应遵循以下七项工程目标：

### 1.1 100% 内存安全（`#![forbid(unsafe_code)]`）

-   在 crate 根文件（`src/lib.rs` 和
    `src/main.rs`）中放置 `#![forbid(unsafe_code)]`，使编译器在编译时拒绝 `unsafe` 块、裸指针
    解引用或未经检查的索引访问。将遗留代码中的裸
    指针、手动 `malloc`/`new`/`free` 调用和可变全局变量替换为安全的
    所有权、切片和强类型（`0` 个 `unsafe` 块）。

### 1.2 四阶段性能阶梯与 PGO

-   在四个明确的检查点跟踪性能并进行基准测试，以便
    单独衡量并量化每项优化技术的贡献：
    1.  **遗留实现基线（`legacy_baseline`）**：原始实现
        （`1.0x`）。
    2.  **初始安全 Rust 实现（`safe_rust`）**：符合 Rust 惯用写法的安全移植，
        热点循环中不进行堆内存分配。
    3.  **面向数据的 SoA 与 SIMD（`soa_simd`）**：采用数组结构（Struct-of-Arrays）、
        按缓存对齐的内存布局、预分配的工作区内存池，以及
        自动向量化。
    4.  **基于性能剖析的优化（`pgo_lto`）**：使用代表性工作负载对插桩后的二进制文件
        进行性能剖析（`-Cprofile-generate` ->
        `llvm-profdata merge` -> `-Cprofile-use` + `lto = "fat"` +
        `codegen-units = 1`）。

### 1.3 API、调用点与认知复杂度简化

-   审查遗留代码中错综复杂的调用树、深层嵌套、输出参数和全局
    可变状态。
-   将复杂的命令式循环分解为可组合的迭代器、构建器和
    强类型领域方法，以缩短平均函数长度并降低最大
    嵌套深度。

### 1.4 模块重划分与文件整洁度（`<= 400` LOC）

-   保持各源文件职责集中、易于阅读：将单体式
    遗留文件拆分为内聚且职责单一的子模块，使每个文件以 **<= 400 行
    代码（LOC）**为目标（硬性上限：**600 LOC**）。

### 1.5 完整文档与注释扩充（文档 `+X%`）

-   为每个公开模块（`//!`）、结构体、trait 和函数（`///`）
    编写 `rustdoc`，涵盖用途、不变量、单位／坐标系、`#
    Errors`、公式和可运行的文档测试。

### 1.6 有界验证试炼与自动修复遥测

-   使用单元测试、集成测试、文档测试和
    基于属性的测试（`proptest`），以 **>= 95% 分支覆盖率**为目标。
-   **透明记录每次测试运行（最多 5 次自动修复迭代）**：当
    初始测试运行失败（`X%` 失败）时，在
    重新构建并测试之前，通过 `scripts/telemetry.py log-test-run` 记录失败数量、根本原因
    和自动修复措施。如果 5 次迭代后仍有失败项，
    应如实在遥测中记录剩余失败，而不要无限
    循环。

### 1.7 数值／epsilon 一致性与确定性

-   使用 `N` 个确定性种子分别运行遗留基线和 Rust 二进制文件，
    逐项对照。记录每次一致性检查（`scripts/telemetry.py
    log-parity-run`），通过二分定位并修复算法或伪随机数生成器（PRNG）方面的差异，
    验证结果是否处于文档规定的 epsilon 容差（`--max-abs-error`）以内，
    并在适用时考虑硬件 FMA 或扩展精度带来的
    差异。

--------------------------------------------------------------------------------

## 2. 阶段 1 架构蓝图规范（6 个部分）

将阶段 1 的 Markdown 蓝图组织为以下六个部分：

1.  **代码库审查、遗留代码概况统计与发现的潜在缺陷**：
    -   展示 `migration_telemetry.json` 中的自动化基线统计
        （总 LOC、注释百分比、最大文件 LOC、嵌套深度、内存／状态
        风险）。
    -   突出展示在原始代码中发现的**潜在缺陷与未定义行为**
        （例如未初始化内存、未经检查的除零、
        浮点精度损失、边界读取的偏一错误），并提供准确的文件和
        行号引用。
2.  **目标安全 Rust 架构与模块图**：
    -   建议的 Rust crate／模块布局（`#![forbid(unsafe_code)]`，每个文件
        以 `<= 400` LOC 为目标）。
    -   **映射表**：说明遗留文件、类和函数
        迁往何处：

        遗留文件与符号（`{legacy_language}`） | 目标 Rust 模块与类型／函数        | 转换方式与 LOC 目标
        :----------------------------------------- | :---------------------------------- | :--------------------------
        `path/to/legacy.cpp::SimEngine`            | `src/engine/stepper.rs::SimStepper` | AoS 转 SoA；`#![forbid(unsafe_code)]`；`<= 400` LOC
3.  **API 易用性与调用点现代化**：
    -   提供来自仓库实际调用点的具体**改造前（`{legacy_language}`）／改造后（Rust）**代码示例，
        展示如何将遗留调用转化为简洁、
        类型安全的 Rust API。
4.  **测试框架、属性模糊测试与一致性策略**：
    -   规划单元测试、文档测试和 `proptest` 属性测试（分支覆盖率
        目标为 `>= 95%`），并使用 `N` 个确定性种子对照黄金输出，
        确保结果处于文档规定的 epsilon 容差以内。
5.  **四阶段基准测试与 PGO 流水线计划**：
    -   衡量四阶段加速阶梯的策略：`legacy_baseline`
        -> `safe_rust` -> `soa_simd` -> `pgo_lto`（LLVM 基于性能剖析的
        优化 + 完整链接时优化）。
6.  **分阶段执行路线图**：
    -   阶段 2 执行的逐步里程碑，以及任何**待解决
        问题**。

--------------------------------------------------------------------------------

## 3. 持续遥测生命周期（`scripts/telemetry.py`）

将 `{skill_dir}` 解析为已加载的 `SKILL.md` 文件
所在目录。在每次阶段转换时调用 `python3 {skill_dir}/scripts/telemetry.py`，
确保每项指标都以真实测量为依据，而不是事后
估算。

### 步骤 A：初始化遥测并扫描遗留代码库（`discovery` 任务计时分组）

克隆或找到遗留仓库后，立即执行：

```bash
python3 "{skill_dir}/scripts/telemetry.py" init \
  --telemetry "{workspace_dir}/migration_telemetry.json" \
  --project-name "{project_name}" \
  --legacy-lang "{legacy_language}"

python3 "{skill_dir}/scripts/telemetry.py" start-bucket \
  --telemetry "{workspace_dir}/migration_telemetry.json" \
  --bucket discovery

python3 "{skill_dir}/scripts/telemetry.py" scan-codebase \
  --telemetry "{workspace_dir}/migration_telemetry.json" \
  --phase before \
  --dir "{legacy_src_dir}"
```

确认遗留基线二进制文件并通过 `/usr/bin/time -v`（或 Python
`resource`／`time` 包装器）运行
（`{baseline_run_command}`）后，记录基线基准测试：

```bash
python3 "{skill_dir}/scripts/telemetry.py" log-benchmark \
  --telemetry "{workspace_dir}/migration_telemetry.json" \
  --stage legacy_baseline \
  --label "1. 遗留 {legacy_language} 实现基线" \
  --wall-time-ms {legacy_ms} \
  --peak-rss-mb {legacy_rss_mb} \
  --notes "原始遗留实现的基线。"
```

### 步骤 B：记录改进机会与遗留代码中的潜在缺陷（`blueprint` 任务计时分组）

转换至阶段 1（架构蓝图）时：

```bash
python3 "{skill_dir}/scripts/telemetry.py" start-bucket \
  --telemetry "{workspace_dir}/migration_telemetry.json" \
  --bucket blueprint
```

对于审查中发现的每项架构改进机会、性能瓶颈、内存风险或
**原始代码中的潜在缺陷**，均予以记录：

```bash
python3 "{skill_dir}/scripts/telemetry.py" log-opportunity \
  --telemetry "{workspace_dir}/migration_telemetry.json" \
  --category latent_bug \
  --title "tick 0 时边界状态未初始化" \
  --file "src/solver.cpp:142" \
  --description "禁用周期性回绕时，边缘单元会读取未初始化的内存。"
```

有效的 `--category` 值：`latent_bug`、`performance`、`safety`、`hygiene`、
`architecture`。

### 步骤 C：安全 Rust 重写与模块化（`rewrite` 任务计时分组）

开始阶段 2 实现时：

```bash
python3 "{skill_dir}/scripts/telemetry.py" start-bucket \
  --telemetry "{workspace_dir}/migration_telemetry.json" \
  --bucket rewrite
```

-   在 `src/lib.rs` 和 `src/main.rs` 的顶部放置 `#![forbid(unsafe_code)]`，
    由编译器强制保证内存安全。
-   使用 `log-benchmark` 对符合 Rust 惯用写法的初始安全 Rust 移植（`safe_rust`）
    和数组结构／SIMD／零分配重构（`soa_simd`）分别进行
    基准测试。

### 步骤 D：记录每次测试运行与自动修复（`test_heal` 任务计时分组）

初始测试失败是第 3 章（“验证试炼”）的核心内容。
启动 `test_heal` 任务计时分组并记录**每次**测试执行迭代，
包括第 1 次迭代中 `X%` 测试失败的情况、失败原因，
以及修复方式：

```bash
python3 "{skill_dir}/scripts/telemetry.py" start-bucket \
  --telemetry "{workspace_dir}/migration_telemetry.json" \
  --bucket test_heal

python3 "{skill_dir}/scripts/telemetry.py" log-test-run \
  --telemetry "{workspace_dir}/migration_telemetry.json" \
  --iteration 1 \
  --total 42 \
  --passed 34 \
  --failed 8 \
  --coverage-pct 83.5 \
  --clippy-warnings 3 \
  --failures-summary "19.0% 失败（8/42）：边界反射的偏一错误，以及极端种子的 NaN 处理问题。" \
  --fix-applied "修正反方向索引查找表（LUT），并增加定义域验证。"
```

每次重新构建／测试循环均重复执行 `log-test-run`（最多 5 次迭代），
目标为 `--failed 0`、`--clippy-warnings 0` 和 `--coverage-pct >= 95.0`。

### 步骤 E：记录 A/B 差分一致性迭代（`parity` 任务计时分组）

启动 `parity` 任务计时分组，记录使用 `N` 个种子的每次
并排对照运行，包括初始种子结果的任何偏离，以及采取的修复措施：

```bash
python3 "{skill_dir}/scripts/telemetry.py" start-bucket \
  --telemetry "{workspace_dir}/migration_telemetry.json" \
  --bucket parity

python3 "{skill_dir}/scripts/telemetry.py" log-parity-run \
  --telemetry "{workspace_dir}/migration_telemetry.json" \
  --iteration 1 \
  --seeds-tested 100 \
  --seeds-passed 96 \
  --max-abs-error "4.2e-4" \
  --divergence-cause "4 个种子因 f32 累加器舍入，在第 380 步的偏差超出 1e-12 epsilon。" \
  --fix-applied "将归约累加器提升为 f64，以匹配遗留参考实现的精度。"

python3 "{skill_dir}/scripts/telemetry.py" log-parity-run \
  --telemetry "{workspace_dir}/migration_telemetry.json" \
  --iteration 2 \
  --seeds-tested 100 \
  --seeds-passed 100 \
  --max-abs-error "2.1e-14 (<= 1e-12 epsilon)" \
  --divergence-cause "无 — 100/100 个种子的结果均在 1e-12 epsilon 范围内一致。" \
  --fix-applied "已验证全部 100 个确定性种子的结果等价。"
```

--------------------------------------------------------------------------------

## 4. 基于性能剖析的优化（PGO）工作流（`pgo_bench` 任务计时分组）

完成各轮测试与一致性验证后，启动 `pgo_bench`
任务计时分组，并执行一轮 LLVM 基于性能剖析的优化：

```bash
python3 "{skill_dir}/scripts/telemetry.py" start-bucket \
  --telemetry "{workspace_dir}/migration_telemetry.json" \
  --bucket pgo_bench
```

### 步骤 1：定位 `llvm-profdata`

先运行 `rustc --print sysroot`，再在该
工具链路径中定位 `llvm-profdata`（或检查 `which llvm-profdata`）：

```bash
rustc --print sysroot
```

### 步骤 2：构建插桩后的二进制文件（`-Cprofile-generate`）

在 `Cargo.toml` 中配置 release 构建的 LTO 设置：

```toml
[profile.release]
opt-level = 3
lto = "fat"
codegen-units = 1
panic = "abort"
```

启用性能剖析插桩进行编译，并使用项目工作区中的
`pgo-data` 目录：

```bash
RUSTFLAGS="-Cprofile-generate=./pgo-data" cargo build --release
```

### 步骤 3：执行代表性性能剖析工作负载

使用 3–5 个代表性种子／工作负载运行插桩后的二进制文件，使 LLVM
能够准确记录分支概率和热点循环的迭代次数：

```bash
./target/release/{binary_name} {representative_workload_args}
```

### 步骤 4：合并性能剖析数据并编译最终 PGO 二进制文件（`-Cprofile-use`）

```bash
{llvm_profdata_binary} merge -o ./pgo-data/merged.profdata ./pgo-data
```

```bash
RUSTFLAGS="-Cprofile-use=./pgo-data/merged.profdata -Cllvm-args=-pgo-warn-missing-function" cargo build --release
```

> **环境中未安装 `llvm-profdata` 时的回退方案**：在步骤 4 中使用
> `RUSTFLAGS="-C target-cpu=native -C opt-level=3 -C lto=fat -C
> codegen-units=1"` 编译，并在 `--notes` 中注明编译器的 target-cpu + fat-LTO
> 优化过程。

### 步骤 5：对最终 PGO 二进制文件进行基准测试并记录阶段 4

使用完全相同的基线工作负载，测量 PGO 二进制文件的实际耗时和峰值常驻内存，
并记录 `pgo_lto`：

```bash
python3 "{skill_dir}/scripts/telemetry.py" log-benchmark \
  --telemetry "{workspace_dir}/migration_telemetry.json" \
  --stage pgo_lto \
  --label "4. 基于性能剖析的优化（PGO）+ 完整链接时优化" \
  --wall-time-ms {pgo_ms} \
  --peak-rss-mb {pgo_rss_mb} \
  --notes "使用代表性工作负载进行性能剖析，并以 -Cprofile-use + 完整链接时优化重新编译。"
```

--------------------------------------------------------------------------------

## 5. 最终代码概况统计、第一人称叙事与信息图生成

PGO 基准测试完成后：

1.  **扫描最终 Rust 代码库**：

    ```bash
    python3 "{skill_dir}/scripts/telemetry.py" scan-codebase \
      --telemetry "{workspace_dir}/migration_telemetry.json" \
      --phase after \
      --dir "{rust_crate_dir}/src" \
      --coverage-pct {final_coverage_pct} \
      --clippy-warnings 0
    ```
2.  **记录代码转换前后对照亮点**：

    ```bash
    python3 "{skill_dir}/scripts/telemetry.py" log-spotlight \
      --telemetry "{workspace_dir}/migration_telemetry.json" \
      --explanation "遗留热点循环如何转化为文档完备、零分配的安全 Rust 核心。" \
      --legacy-file "{legacy_file_path}" \
      --legacy-code "{legacy_snippet}" \
      --rust-file "{rust_file_path}" \
      --rust-code "{rust_snippet}"
    ```
3.  **撰写 AI 第一人称叙事章节**：从 AI 的
    第一人称视角撰写（`“我发现……”`、`“我分析了……”`、`“在我的首次
    测试运行中，X% 的测试失败……”`、`“我修复了……”`、`“最后我运行了
    PGO……”`）：

    ```bash
    python3 "{skill_dir}/scripts/telemetry.py" set-story \
      --telemetry "{workspace_dir}/migration_telemetry.json" \
      --headline "“我接手了一个 {legacy_lang} 代码库，发现了 {N} 个潜在缺陷，通过自动修复解决了初始 {X}% 的测试失败，并交付了一个经 PGO 调优、速度提升至 {S}x 的安全 Rust 移植版本。”" \
      --intro "{2-3 sentence executive summary from AI POV}" \
      --ch1-narrative "{Chapter 1: What I found in the legacy codebase & opportunities/bugs discovered}" \
      --ch2-narrative "{Chapter 2: How I reorganized the architecture, capped files <=400 LOC, and added +X% docs}" \
      --ch3-narrative "{Chapter 3: The test crucible — initial failure %, root causes diagnosed, and self-healing fixes}" \
      --ch4-narrative "{Chapter 4: Proving output parity across N seeds}" \
      --ch5-narrative "{Chapter 5: The 4-stage speedup staircase culminating in PGO}"
    ```
4.  **结束最后一个任务计时分组并渲染 HTML 信息图**：

    ```bash
    python3 "{skill_dir}/scripts/telemetry.py" end-bucket \
      --telemetry "{workspace_dir}/migration_telemetry.json" \
      --bucket pgo_bench

    python3 "{skill_dir}/scripts/telemetry.py" render-infographic \
      --telemetry "{workspace_dir}/migration_telemetry.json" \
      --out "{output_dir}/migration_infographic.html" \
      --scope-summary "{short_summary_of_ported_scope}"
    ```
