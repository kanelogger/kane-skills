# 维护随技能分发的正本

选择用户指定、可维护的技能源码目录。每项行为在 assets 中有可阅读的正式正文，catalog 登记部件 ID、标题、默认采用与片段列表。部件 ID 和片段 ID 作为已采用项目的稳定标识。正文按内容摘要识别版本；项目采用记录保留自己的旧版基线，升级时可离线三方比较。

1. 运行源码包的 `catalog --check`，从每个条目的 source 读取当前正文，查清引用与现有职责。先以一个实际项目场景写明触发条件、执行者、输入、处理和可观察结果。确定这是同一行为的修订、可以单独停用的新部件，还是应退役的部件。
2. 改正文时保留稳定 ID。增加部件时在 `assets/catalog.json` 数组加入含 id、title、default、parts 的对象；每个 part 包含全包唯一的 id、项目默认 path、相对 assets 的 .tmpl 正文 source。Markdown 可使用内联或引用式相对链接，跨部件引用需考虑单独停用；示例代码放在围栏中。仅当它是所有项目开始工作所需的约定时才默认启用。
   - 如果部件的标准正文是给无现成来源的项目使用的底稿，可为该片段设置 `preferReference: true`。空项目直接获得底稿，已有项目首次采用时要先定位权威来源，并记录引用或建立底稿的依据。
3. 退役时删除目录条目和不再被使用的正文，同时调整其他标准里依赖旧行为或链接的部分。区分“今后不再采用”和“已有项目明确要求移除”。项目可以继续执行已安装的旧版，后续显式升级或移除时按本地例外处理。
4. 在项目外的私有临时目录生成 edits JSON，包含本次变更的完整、已核实正文。每项 path 相对 assets，可选 catalog.json 或 .tmpl 资产。beforeSha256 是旧文件全文 SHA-256，新文件为 null；after 为新正文，退役文件为 null。旧摘要可通过 `fingerprint SOURCE/assets RELATIVE_PATH` 取得。已有登记的正文摘要也可从 catalog 读取。
5. 运行以下命令。预检在临时目录构建候选包并检查清单、资源，以及默认、全选和单部件布局的引用，写入时重新核对现状。用技能源码自己的 CLI 重新运行 catalog --check，再在隔离项目演练增删、升级及本地差异的保留。这里的 `SOURCE` 是技能源码目录，`EDITS` 是实际 JSON 路径。

```sh
bun "SOURCE/scripts/main.ts" templates plan "SOURCE" --edits "EDITS" --diff
bun "SOURCE/scripts/main.ts" templates apply "SOURCE" --edits "EDITS"
bun "SOURCE/scripts/main.ts" catalog --check
```

调整独立审阅时，可用“已采用旧版、团队额外要求指定维护者复核”的项目做对照。从项目根 AGENTS 进入团队的实际文档，核实新版约定和团队要求能同时执行；只在那个项目停用时，检查其他项目和分发正本仍然保有该部件。
