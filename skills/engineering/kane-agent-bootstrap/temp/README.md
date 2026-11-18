# prototype-03：个人全栈 AI 开发协作模板

供个人全栈工程师跨项目复用：固定适合自己的协作方式和工程底线，让 Agent 找到事实、完成修改、验证结果，并在后续会话中接续工作。前端、后端、数据与部署规范按任务涉及的范围读取，技术栈根据实际问题选择。以 prototype-01 的工程、测试和集成规范为基础，吸收 prototype-02 的任务恢复、环境登记和操作护栏；整合取舍见 [适配说明](docs/reference-analysis.md)。另原样收录 prototype-02 的 `rules/` 与 `specs/`，其适用边界见下文。

当前交付为文档、填写模板与最小 `.gitignore`，没有应用源码、运行命令、检查脚本、工具安装器、CI 或自动调度器。文档中的协议需要采用项目落实；整套流程尚未在采用项目中通过真实开发任务验收。

日常小改在当前会话中明确目标、修改、验证并报告结果；复杂或高风险工作再增加计划与独立审阅，需要跨会话或长期追溯时再留持久任务记录。角色、分支、PR、ADR 和共享状态均按实际需要启用，详见 [工作流程](docs/workflow.md)。

## 阅读入口

下表链接指向本目录实际提供的文件。带 `.template` 的文件是采用底稿，不是已启用的项目配置；规范中提到的 `AGENTS.md`、`project.yml`、`agents.yml` 和 `LESSONS.md` 均指采用后目标项目中的文件，生成方式见下文。

| 文档 | 职责 | 何时阅读 |
| --- | --- | --- |
| [AGENTS.project.template.md](AGENTS.project.template.md) | 项目级协作入口模板：个人约定、读取条件和执行边界 | 采用时填写；生成的 `AGENTS.md` 用于开始任务 |
| [project.template.yml](project.template.yml) | 项目标识、数据平台字段与最小环境声明模板 | 采用时按项目裁剪；生成的 `project.yml` 用于开始或恢复任务 |
| [agents.template.yml](agents.template.yml) | 角色、可选 Agent 与模型、公共和角色默认提示词模板 | 启用角色分工或独立审阅时填写为 `agents.yml` |
| [工程标准](docs/code-standards.md) | 行为正确性、数据保护与审阅要求 | 修改代码或规范 |
| [工作流程](docs/workflow.md) | 目标、实施、验证、留证与复盘 | 开发、修复、审阅和交付 |
| [测试规范](docs/testing.md) | 回归证明、隔离、确定性与覆盖边界 | 编写、运行或修复测试 |
| [集成规范](docs/integrating.md) | 外部契约、配置所有权与迁移恢复 | 接入服务或迁移数据 |
| [实现文档索引](docs/subsystems/README.md) | 当前模块事实与源码入口 | 核对实现或修改契约 |
| [经验库模板](LESSONS.template.md) | 通用易漏模式与本地复盘格式 | 采用时合并为 `LESSONS.md`；修改前参考、出现新发现后回写 |

按任务需要启用以下载体，无需为简单任务逐项建档：

| 文档 | 用途 |
| --- | --- |
| [任务规范与模板](tasks/README.md) | 跨会话、复杂协调和需追溯的交付记录；完成后归档保留证据 |
| [环境指南](docs/agent-environment/README.md) | 工具链、命令、权限、资源与验证边界 |
| [决策记录](docs/adr/README.md) | 保存有长期影响的选择理由 |
| [导入规则索引](rules/README.md) | 从 prototype-02 原样复制的工作流、测试、安全、Git 与代码风格规则，采用前需与现有规范对照合并 |
| [导入架构说明](specs/architecture.md) | 从 prototype-02 原样复制的架构资料，采用时按目标项目事实改写，不作为本目录已实现能力的证明 |
| [目录级 AGENTS 模板](docs/AGENTS.directory.template.md) | 在需要局部约束的目录中填写为 `AGENTS.md`，只补充该目录的差异 |
| [通用项目环境模板](docs/project.template.yml) | 展开工具链、命令、服务、权限与环境需求的填写格式，与根模板按需取用，最终统一到根 `project.yml` |
| [Git 操作护栏](docs/git.md) | 已授权的暂存、提交、推送及工作区保护 |
| [.gitignore](.gitignore) | 密钥、本机状态和临时缓存的最小忽略规则 |
| [开发演练](docs/agent-environment/development-rehearsal.md) | 检验真实任务、交接恢复与证据是否连贯 |

## 导入目录的适用边界

`rules/` 与 `specs/` 保留源目录的文件名、结构和内容，未改写其中的旧项目约定。当前协作入口仍指向 `docs/` 下的规范；复制目录不会自动替换入口、启用规则或增加工具能力。

- `rules/` 包含工作流、测试、安全、Git 与代码风格说明，部分内容与 `docs/` 重叠。采用时先核对适用范围与冲突，同一事项只维护一份有效规则，并同步所有入口；不要直接叠加两套执行要求。
- `rules/code-style.md` 中的 JavaScript ESM 约定、`rules/testing.md` 中的 `pnpm` 命令，以及 `specs/architecture.md` 中的脚本、技能与 CI 描述均是源材料内容，不代表本目录已有对应实现。命令、技术栈与能力以目标项目实际配置和验证为准。
- 源材料引用的 `docs/lessons.md`、`docs/subsystems/agent-tooling.md` 和 `.github/workflows/ci.yml` 在本目录中不存在。采用时按实际内容修正或删除这些引用，不为满足文档描述虚构文件、命令或实现。

## 在项目中采用

模板文件与目标项目文件的对应关系如下。目标文件已存在时合并内容，不直接覆盖。

| 本目录提供 | 目标项目中的路径 | 采用要求 |
| --- | --- | --- |
| [AGENTS.project.template.md](AGENTS.project.template.md) | `AGENTS.md` | 改写项目定位与现状，保留适用的协作约定，核实客户端的读取方式 |
| [project.template.yml](project.template.yml) 或 [通用环境模板](docs/project.template.yml) | `project.yml` | 按实际项目选择、裁剪和合并字段，只维护一份有效环境声明 |
| [agents.template.yml](agents.template.yml) | `agents.yml` | 需要角色分工或独立审阅时启用，按当前环境填写可用 Agent 与模型 |
| [LESSONS.template.md](LESSONS.template.md) | `LESSONS.md` | 保留适用的问题模式，真实本地复盘与模板示例分开记录 |
| [docs/AGENTS.directory.template.md](docs/AGENTS.directory.template.md) | `<需要局部约束的目录>/AGENTS.md` | 仅在确有目录差异时启用，核对移动后的相对链接 |

1. 核对目标项目已有规则、源码和配置，按上表合并需要的入口与模板，保留已确认的决策和其他执行者的改动。将入口及其他文档中“当前模板”的定位与状态改为目标项目的真实情况。
2. 小项目可把入口、相关规则和实际命令合并到已有 README 或开发说明，无需复制完整目录。测试、集成、任务记录等内容按实际风险选取；删减或合并后同步修改所有入口与引用。
3. 填写目标项目根目录下的 `project.yml`。根 [project.template.yml](project.template.yml) 含项目标识、数据平台字段和最小环境声明；[docs/project.template.yml](docs/project.template.yml) 提供更完整的通用环境填写格式。按实际需求取用，不适用的数据平台字段删除，所有占位值须替换；未核实的要求不能写成已配置或不需要。环境与命令在最终清单中统一声明，版本及命令定义引用实际配置；复杂操作按 [环境指南](docs/agent-environment/README.md) 引用已有说明。将最小忽略规则合并进已有 `.gitignore`，按实际技术栈补充依赖、构建和测试产物，不覆盖原有例外与交付约定。
4. 需要整体架构说明时，按实际实现改写 [specs/architecture.md](specs/architecture.md)，移除不适用的源项目描述；出现稳定模块时填写 [子系统模板](docs/subsystems/TEMPLATE.md)。需要跨会话接续、复杂协调或长期追溯时，按 [任务规范](tasks/README.md) 选定一个权威记录；长期取舍再建立 ADR。
5. 在隔离环境中用一个真实任务走通读取、实施、验证、交付与恢复，保存对应输入、实际结果和未覆盖项。复制文档不代表客户端自动加载、检查已执行或恢复已成功。

## 采用完成的最低条件

- 新执行者能从入口找到适用规则、当前实现和实际命令。
- 真实任务的验收结论绑定实际输入、环境和证据，未完成项有具体下一步。
- 持久任务完成后仍能找到交付记录及其证据；新会话能恢复需要继续的工作。
- 有价值的新经验能回写到唯一经验入口，稳定规则由所属规范维护。

本模板不限定语言、包管理器、前后端结构、数据库、部署平台或技能分发工具。个人协作约定由采用后的根 `AGENTS.md` 维护，技术选择和运行事实由各项目维护；按实际问题扩展，并核实扩展机制的源码、配置和运行结果。
