# Kane Agent Bootstrap

根据已有项目的业务、技术栈和协作约定，接入适合 Agent 开发的最小环境。适合个人跨项目复用，也支持多会话和按需分工。

技能先查项目材料与实际入口，再用少量问题补齐会影响结果的缺口，合并适用规则，准备并验证开发环境。已有项目规范、命令和工具优先复用，目标项目不要求使用 Bun 或任何固定业务技术栈。

## 何时使用

- 首次让 Agent 参与一个已有项目。
- 现有 AGENTS、环境说明与实际项目不一致，需要修正。
- 希望新的 Agent 能找到真实命令、运行检查并验证业务链路。

普通功能开发不需要重复初始化；本技能也不代替完整需求访谈、业务实现或部署流程。执行说明见 [SKILL.md](SKILL.md)。

## 输入与输出

提供目标项目路径和本次接入目标。已有业务文档、约定或专用样例可直接提供位置；技能会先读取能查明的事实，默认最多两轮、每轮 1–3 个必要问题，信息足够时不提问。

产出按实际需要选择：

- 合并后的 Agent 入口、项目环境声明及必要开发说明。
- 已确认事实、采用假设、冲突和未知事项及其影响。
- 协作材料、本机环境、业务链路各自的验证结果与缺口。
- 本轮文件操作收据及必要恢复路径；不强制额外任务系统或全套目录。

## 运行依赖与 CLI

技能脚本使用 TypeScript + Bun。优先本机 `bun`；缺少时可在当前网络与授权允许的范围用 `npx -y bun`。缺运行时则先说明，可正常安装 Bun，不自动修改系统或 npm 安全配置。技能依赖不加入业务项目。

首次使用前在技能工具目录执行 `bun install --frozen-lockfile --ignore-scripts --cwd "/path/to/kane-agent-bootstrap/scripts"`，按包内锁文件准备依赖，安装与项目调用分开。

所有脚本以本技能目录为基准。路径中的占位符需替换，含空格的路径要引用：

```sh
bun "/path/to/kane-agent-bootstrap/scripts/main.ts" inspect "/path/to/project"
bun "/path/to/kane-agent-bootstrap/scripts/main.ts" apply "/path/to/project" --plan "/path/to/plan.json" --dry-run
bun "/path/to/kane-agent-bootstrap/scripts/main.ts" apply "/path/to/project" --plan "/path/to/plan.json"
bun "/path/to/kane-agent-bootstrap/scripts/main.ts" verify "/path/to/project"
```

| 命令 | 用途 |
| --- | --- |
| `inspect` | 只读收集来源分组、文件摘要、候选入口和示例变量名 |
| `apply` | 按明确计划写入、预检冲突并保存本轮恢复收据 |
| `verify` | 静态检查结构与引用；可用 `--context` 核对可选上下文来源 |
| `recover` | 按收据有条件恢复，仅处理仍与本轮结果匹配的文件 |

操作计划与资产选择见 [适配契约](references/adaptation.md)，背景与提问见 [上下文说明](references/context.md)，收据和恢复见 [恢复说明](references/recovery.md)。

## 边界与恢复

写入与恢复使用 Bun 内置 FFI 调用宿主文件原语。目前支持并验证 macOS，Linux 尚未实机验证，Windows 不支持写入。能力不足时保留候选内容和原因，不降低保护。

CLI 不安装依赖、不运行项目命令、不提交推送或部署；Agent 在现有授权范围内核对并执行必要准备和真实验证。环境声明中的命令也可以是手工说明，不会被当作 shell 代码自动运行。

实际修改前保存收据，默认在目标 `.agents/state/bootstrap/`；dry-run 和零变化不创建收据。收据含修改前文本，应忽略入库并限制本机访问。秘密文件不进入计划或备份。恢复要求当前内容仍等于本轮写入结果，其他会话的修改会导致冲突，避免旧备份覆盖新工作。

```sh
bun "/path/to/kane-agent-bootstrap/scripts/main.ts" recover "/path/to/project" --receipt ".agents/state/bootstrap/adoption.json" --dry-run
```

收据不是跨文件事务或授权。静态通过不表示本机或业务已验证；技能会分别报告实际证据、未运行项与具体下一步。

## 维护验证

在技能目录执行 `bun test scripts/tests`。包内资产来自固定快照；只有作者更新源材料时才运行 `scripts/sync-assets.ts <源目录> [--check]`。项目初始化和单独复制使用不依赖原模板仓库。
