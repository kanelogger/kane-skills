# Kane Agent Bootstrap

根据已有项目的业务、技术栈和协作约定，接入适合 Agent 开发的最小环境，并在后续任务中按需读取和维护项目上下文。适合个人跨项目复用，也支持多会话和按需分工。

初始化时先查项目材料与实际入口，再用少量问题补齐关键缺口，合并适用规则、真实环境声明和可用索引，把读取与更新责任接入实际工作流，并验证开发环境。已有项目规范、命令和工具优先复用，目标项目沿用自己的业务技术栈。

## 何时使用

仅由用户主动触发：使用 `$kane-agent-bootstrap`、`/kane-agent-bootstrap` 或明确要求使用本技能。以下场景均需明确调用，不会因普通开发任务、缺少 Agent 配置或已有上下文索引而自动触发。

- 首次让 Agent 参与一个已有项目。
- 现有 AGENTS、环境说明与实际项目不一致，需要修正。
- 希望新的 Agent 能找到真实命令、运行检查并验证业务链路。
- 已完成接入，希望日常任务按 key 找到相关知识，并在来源或结论变化后维护索引。

技能有两种用法：首次接入或修正时完成初始化；后续任务只执行上下文检索与维护，不重跑访谈、资产投放或环境准备。执行说明见 [SKILL.md](SKILL.md)。

## 输入与输出

提供目标项目路径和本次接入或任务目标。已有业务文档、约定或专用样例可直接提供位置；初始化时先读取能查明的事实，默认最多两轮、每轮 1–3 个必要问题，信息足够时不提问。

初始化会交付可用索引与入口/工作流协议，其余材料按实际需要选择；后续任务只维护受影响内容：

- 合并后的 Agent 入口、真实项目环境声明及可达的实际工作流。
- 随版本控制的 `.agents/context/index.json`，定位现有文件、Markdown 段落或 YAML/JSON 字段。
- 工作流开始、计划、实施、验证与交接节点的读取和更新协议，直接合并进项目 AGENTS 与实际工作流。
- 已确认事实、采用假设、冲突和未知事项及其影响。
- 协作材料、本机环境、业务链路各自的验证结果与缺口。
- 本轮文件操作收据及必要恢复路径；不强制额外任务系统或全套目录。

索引保留 key、别名、检索描述、适用节点与来源依赖；正文继续留在 `project.yml`、现有业务/子系统文档和本次唯一任务或 Issue 中。只有跨来源综合形成、确需独立保存的稳定结论才按需进入 `.agents/context/derived/`，不保存重复 `raw/` 或全局 `active_task`。资料面向 Agent/LLM，由 Agent 在执行任务时维护。

## 运行依赖与 CLI

技能脚本使用 TypeScript + Bun。优先本机 `bun`；缺少时可在当前网络与授权允许的范围用 `npx -y bun`。缺运行时则先说明，可正常安装 Bun，不自动修改系统或 npm 安全配置。技能依赖不加入业务项目。

首次使用前在技能工具目录执行 `bun install --frozen-lockfile --ignore-scripts --cwd "/path/to/kane-agent-bootstrap/scripts"`，按包内锁文件准备依赖，安装与项目调用分开。

所有脚本以本技能目录为基准。路径中的占位符需替换，含空格的路径要引用：

```sh
bun "/path/to/kane-agent-bootstrap/scripts/main.ts" inspect "/path/to/project"
bun "/path/to/kane-agent-bootstrap/scripts/main.ts" apply "/path/to/project" --plan "/path/to/plan.json" --dry-run
bun "/path/to/kane-agent-bootstrap/scripts/main.ts" apply "/path/to/project" --plan "/path/to/plan.json"
bun "/path/to/kane-agent-bootstrap/scripts/main.ts" verify "/path/to/project"
bun "/path/to/kane-agent-bootstrap/scripts/main.ts" context search "/path/to/project" "支付 状态" --limit 8
bun "/path/to/kane-agent-bootstrap/scripts/main.ts" context get "/path/to/project" workflow business.checkout
bun "/path/to/kane-agent-bootstrap/scripts/main.ts" context node "/path/to/project" plan --keys business.checkout --task tasks/checkout-fix.md
bun "/path/to/kane-agent-bootstrap/scripts/main.ts" context check "/path/to/project" --changed docs/checkout.md --keys business.checkout
bun "/path/to/kane-agent-bootstrap/scripts/main.ts" context update "/path/to/project" --plan "/path/to/index-plan.json" --dry-run
```

| 命令 | 用途 |
| --- | --- |
| `inspect` | 只读收集来源分组、文件摘要、候选入口和示例变量名 |
| `apply` | 按明确计划写入、预检冲突并保存本轮恢复收据 |
| `verify` | 静态检查结构与引用及发现的索引；可用 `--context` 核对本轮可选证据 |
| `recover` | 按收据有条件恢复，仅处理仍与本轮结果匹配的文件 |
| `context search/get` | 搜索索引元数据，或按精确 key/别名批量读取正文 |
| `context check/node` | 检查受影响来源，或按工作流节点读取候选知识与明确任务 |
| `context update` | 按明确增量计划维护索引，保留未涉及条目，沿用预检和收据机制 |

操作计划与资产选择见 [适配契约](references/adaptation.md)，背景与本轮证据 JSON 见 [背景说明](references/context.md)，索引格式、CLI 与项目协议见 [按需上下文与工作流](references/retrieval.md)，收据和恢复见 [恢复说明](references/recovery.md)。本轮证据 JSON 与长期检索索引是两种独立格式。

## 日常检索与维护

知道 key 时直接批量读取，未知时先搜元数据；索引摘要只帮助找资料。默认正文预算 16 KiB，超预算整项略过并报告未覆盖，不静默截断。直接引用的正文变化后返回当前内容并标记 `changed`；综合结论的源依赖变化时标记 `stale`，不返回旧结论正文，Agent 需要重读来源、修正或重证结论。

先更新知识所属文档或任务记录，再只改受影响索引项。`context check --changed` 或 `--keys` 限制检查范围，无过滤条件才检查全索引；检查不写入，也不自动刷新摘要。重要决策与下一步写回本次唯一任务记录，稳定知识写回其所属文档。

已有索引时，普通 `apply` 写后用 `context_updates` 报告本轮变化关联的待复核项，文件写入结果保持独立；`verify` 默认检查发现的索引，限定文件范围时仅在显式选中索引后纳入。两者都不自动改写知识或刷新源摘要。

新 Agent 从项目 AGENTS 获取协议和工作流。用户明确调用本技能且工具可用时，定位当前已安装的技能基准调用 CLI，项目规则不写本机绝对技能路径。未调用本技能或工具不可用时，直接按索引读当前段落或字段并执行同样维护，不要求复制整套技能或重新初始化；项目协议本身不触发本技能。

## 边界与恢复

写入与恢复使用 Bun 内置 FFI 调用宿主文件原语。目前支持并验证 macOS，Linux 尚未实机验证，Windows 不支持写入。能力不足时保留候选内容和原因，不降低保护。

CLI 不安装依赖、不运行项目命令、不提交推送或部署；Agent 在现有授权范围内核对并执行必要准备和真实验证。环境声明中的命令也可以是手工说明，不会被当作 shell 代码自动运行。

节点动作由加载项目规则的 Agent 主动执行；技能不安装客户端 hooks，不提供强制调度、LLM 语义判断或通用业务状态机。索引 JSON 与摘要只证明结构或版本，业务完成仍依靠原始目标与真实验证证据。检索效果按实际读取量、工具轮次、来源是否正确和过期项处理情况核对，不承诺恒定耗时。

实际修改前保存收据，默认在目标 `.agents/state/bootstrap/`；dry-run 和零变化不创建收据。收据含修改前文本，应忽略入库并限制本机访问。秘密文件不进入计划或备份。恢复要求当前内容仍等于本轮写入结果，其他会话的修改会导致冲突，避免旧备份覆盖新工作。

`.agents/context/index.json` 和已确认需要的派生知识应入库；`.agents/state/` 继续忽略。新增或合并忽略项时核对索引仍可被跟踪。

```sh
bun "/path/to/kane-agent-bootstrap/scripts/main.ts" recover "/path/to/project" --receipt ".agents/state/bootstrap/adoption.json" --dry-run
```

收据不是跨文件事务或授权。静态通过不表示本机或业务已验证；技能会分别报告实际证据、未运行项与具体下一步。

## 维护验证

在技能目录执行 `bun test scripts/tests`。包内资产来自固定快照；只有作者更新源材料时才运行 `scripts/sync-assets.ts <源目录> [--check]`。项目初始化和单独复制使用不依赖原模板仓库。
