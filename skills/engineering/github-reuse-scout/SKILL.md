---
name: github-reuse-scout
description: >-
  针对用户的新开发需求，先在 GitHub 上搜索相关开源项目并判断是否存在可直接复用的架构：
  构建搜索查询、收集并评分候选仓库、深入检查架构，输出 fork（基于现有项目开发）/reference
  （参考架构自建）/none（不复用）决策及依据；复用后基于现有方案启动开发，并在后续会话中按
  迁移计划把借用代码逐步迁移到用户更熟悉的框架。适用于用户提出要开发的工具/应用/系统/服务
  需求、希望"先找开源现成方案""避免重复造轮子""站在已有项目上开发""先调研 GitHub 再动手"、
  或要求"渐进迁移到某框架"时。不用于仅查找某个依赖库或代码片段、通用开源项目调研报告、
  已有明确选型的技术方案设计、纯 prompt 优化、文章分析或需求文档撰写。
---

# GitHub 复用侦察（GitHub Reuse Scout）

收到一个开发需求时，先在 GitHub 上找可复用的开源项目：能直接复用的就基于现有方案启动开发，
项目深入后按迁移计划把借用代码逐步迁移到用户更熟悉的框架。核心产物是 `.reuse/reuse-plan.md`：
一份同时承载复用决策、借用单元清单与迁移状态的常驻文档。

## 执行流程

### 阶段 0 需求解析

1. 用业务语言复述需求，确认理解一致。
2. 抽取搜索要素：
   - 领域词 2-4 个（需求所属领域，如 短链接、发票、知识库）；
   - 实体词（核心对象，如 URL、审批单）；
   - 约束词（self-hosted/self-host/离线/单机/CLI/Web/移动端 等）；
   - 技术栈提示（用户明确提到或可合理推断的语言/框架）。
3. 按 `references/search-queries.md` 生成 3-6 条 GitHub 查询串。
4. 只有需求模糊到无法抽出任何领域词时才向用户提问澄清；否则直接推进。

### 阶段 1 候选收集

对每条查询串运行：

```bash
python3 <skill-dir>/scripts/search_candidates.py --query "<查询串>" --top 15 --workdir <项目根目录>
```

脚本把结果按查询缓存到 `<项目根>/.reuse/search-cache.json`，并把全部查询合并去重后写入
`<项目根>/.reuse/candidates.json`（`merged` 按 star 数降序）。重复执行同一查询命中缓存，不消耗 API 配额。

全部查询执行完毕后若 `merged` 为空：直接给出决策 `none`，在 `reuse-plan.md` 中记录"缺什么就能复用"，跳过阶段 2-3。

### 阶段 2 评分初筛

```bash
python3 <skill-dir>/scripts/score_candidates.py --workdir <项目根目录> [--language <技术栈>]
```

脚本按确定性权重评分并写入 `<项目根>/.reuse/scored.json`（每项含各因子 breakdown，archived 仓库进入 `excluded`）。
取前 10 个，剔除领域明显不匹配的，保留至少 3 个进入阶段 3。不足 3 个时最多补一轮查询（回到阶段 1）；
补完仍不足 → 直接进入阶段 4 决策。

### 阶段 3 深入检查

```bash
python3 <skill-dir>/scripts/inspect_candidates.py --top 3 --workdir <项目根目录>
```

脚本对评分前 3 的仓库做浅克隆到 `.reuse/cache/<owner>-<repo>/`，并抽取
`.reuse/evidence/<owner>-<repo>.json`（README 前 60 行、依赖清单前 40 行、顶层目录、LICENSE、入口文件）。

**决策前必须**用 read 工具读完排名第 1 候选的 evidence（README、清单、目录树）；第 2、3 名至少看 README 头与清单。

### 阶段 4 复用决策

按 `references/reuse-decision.md` 的 rubric 逐维评估，得出 `fork` / `reference` / `none` 之一，并写入
`<项目根>/.reuse/reuse-plan.md`（结构见下文"产物契约"）。目标框架必须在决策时向用户确认；
用户未回答 → 记为 `待确认`，迁移挂起，不阻塞启动开发。

### 阶段 5 基于现有方案启动

- `fork`：把上游仓库浅克隆到项目目录 → 删除 `.git` 并 `git init` 建立自有仓库 → 在 README 顶部注明上游来源与 LICENSE 归属 → 按上游文档跑通安装与冒烟验证 → 向项目 `.gitignore` 追加（不覆盖）：

  ```text
  .reuse/cache/
  .reuse/candidates.json
  .reuse/scored.json
  .reuse/evidence/
  ```

- `reference`：用目标框架脚手架，按 `reuse-plan.md` 的架构蓝图建立模块骨架，不复制上游代码。
- `none`：从零开发，无额外启动步骤。

### 阶段 6 渐进迁移

按 `references/migration-protocol.md` 执行：每会话迁移 1 个借用单元（用户明确要求更多除外），
迁移顺序由清单中的优先级决定；新功能一律用目标框架原生实现，不继续堆借用代码。
全部单元 `ported` 后把迁移状态置为 `已完成`。

## 恢复逻辑

触发本技能时，先检查 `<项目根>/.reuse/reuse-plan.md`：

- 文件不存在 → 从阶段 0 走完整流程。
- 存在且决策=`fork` 且仍有 `borrowed` 单元 → 跳过阶段 0-5，直接从阶段 6 继续迁移。
- 存在且决策=`reference`/`none` → 迁移不适用，按正常开发推进；用户提出新需求时走完整流程。
- 存在且迁移状态=`已完成`，用户提出的是新需求 → 先把现有文件改名为 `reuse-plan-archived-<YYYYMMDD>.md`，再从阶段 0 重新开始。

## 产物契约

`<项目根>/.reuse/reuse-plan.md` 固定结构：

```markdown
# 复用计划
## 需求摘要
## 目标框架（待确认 / 具体栈）
## 候选清单（top5：仓库、评分、简述）
## 深入检查（top3 关键发现）
## 复用决策：fork | reference | none
## 决策依据（逐条对应 rubric 维度）
## 待确认项
## 借用单元清单（仅 fork 模式；reference/none 为"不适用"）
| 单元 | 来源路径 | 状态(borrowed/ported/deleted) | 迁移优先级 | 依赖的借用单元 |
## 迁移状态：进行中 / 未开始 / 不适用 / 已完成
## 迁移日志（每次迁移追加：日期、单元、动作、测试结果）
```

工作数据（`search-cache.json`、`candidates.json`、`scored.json`、`evidence/`、`cache/`）不进版本库
（阶段 5 已写入 .gitignore）；`reuse-plan.md` 应提交。

## 边界

- 只找"可复用架构/可作开发基座"的项目，不用于查找单个依赖库、代码片段或通用开源调研。
- 决策之后、迁移之前的日常功能开发不是本技能的输出范围；本技能只负责启动（阶段 5）与迁移（阶段 6）。
- 迁移只替换借用代码：新功能必须原生实现，不扩大借用面。
- 不臆造评分数据：评分与证据一律来自脚本产物；脚本不可用时降级为手动 `gh search repos`/web 搜索，
  并在 `reuse-plan.md` 决策依据中注明证据来源为手动。

## 完成标准

- `.reuse/reuse-plan.md` 存在且结构完整（含候选清单、决策、依据、待确认项）。
- 决策前已读排名第 1 候选的 evidence（无候选时除外）。
- 待确认项（如目标框架）显式列出，未确认的项不假装已定。
- fork 模式下所有借用单元 `ported` 后才报告迁移完成。
- 最终回复只报告产物路径、决策与关键结论，不粘贴 `reuse-plan.md` 全文。
