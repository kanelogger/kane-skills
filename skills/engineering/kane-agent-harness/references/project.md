# 项目操作

下文 `H` 代表用 Bun 执行技能目录下的 `scripts/main.ts`，不是必须安装的全局命令。PROJECT 和文件名替换为实际路径。命令输出 JSON。退出 0 表示所请求的命令成功，1 表示决策、引用或验证问题，2 表示调用、输入或执行错误。

| 命令 | 作用 |
| --- | --- |
| `H catalog --check` | 检查默认、全选及单部件模板布局，输出 ID、默认选择、来源、目标和正文摘要 |
| `H status PROJECT` | 查看已采用部件、状态、本地例外与退役项 |
| `H status PROJECT --id independent-review --detail` | 查看上次正本 previous、上次实际采用 installed、当前 current、新版正本 next 及决策摘要 |
| `H fingerprint PROJECT CONTRIBUTING.md` | 获取已有目标整文件摘要，目标缺失返回 null |
| `H plan init PROJECT --diff` | 初始化默认部件，预览逐文件变化 |
| `H plan adopt PROJECT --id independent-review --decisions FILE` | 接入指定部件并采用给定的语义判断 |
| `H plan upgrade PROJECT` | 检查已启用部件是否有更新；可用 --id 限定 |
| `H plan add PROJECT --id tasks`、`H plan remove PROJECT --id tasks` | 启用或停用一个部件，可重复传 --id |
| `H apply ACTION PROJECT ...` | 使用与 plan 相同的参数重新核对并写入 |
| `H verify PROJECT` | 核对安装正文、实际导航、受管链接、规格入口中的本地链接与未确认改动 |

## 如何判断已有内容

**需求与规格**的片段 key 为 `requirements/requirements`。已有项目先沿根 AGENTS、README 和产品文档导航查找当前生效的需求。阅读正文核对适用范围和验收依据；区分已归档版本、架构现状和任务执行记录。若有多份并行生效的功能规格，优先引用团队维护的索引。无本地索引而确需一个入口时，用适配的短正文链接各权威来源。

找到现行 PRD 后，决策选 `reference`，`path` 填其项目相对路径，`expected` 用该文件的 fingerprint，`incoming` 取 catalog 中 requirements 片段的摘要，首次采用时 `base` 为 null。已有来源即使尚有待明确的条款，也保留实际文档，记录缺口。查明尚无来源才选 `append`，沿用默认模板。首次接入已有项目时若缺少这项选择，预检以 `needs_decision` 提示执行 Agent 补上依据。空目录（可含 Git 元数据）用 `init` 直接生成模板。采用后核对 AGENTS 的链接目的地；引用原文时对照内容摘要，确认没有额外创建规格副本。

以独立审阅为例，阅读目标项目的贡献指南、角色约定及团队例外，并与包内对应正文逐项比较。看到“所有改动需要 review”时，继续核对谁评审、是否使用全新上下文、如何传共同证据、修复后谁复核。完整覆盖可选择 reference。已有部分内容时，以 append 把缺失的标准段落合并到实际文件；提供 body 时把本地链接写成相对最终路径。全新独立文件一般直接采用正本。多个部件可选择同一份 Markdown 文档，团队原文始终在托管边界之外。

需填写项目事实时，从项目已有资料提取，并在 append 决策里提供含标准条款的实际正文，包括新文件的首版。已有根 README 可引用团队说明；明确缺少协作入口时，追加相应段落。检查 `project.yml` 是否以真实命令与资源为准。若已有不同格式的配置，核对等价来源后引用，或选择独立位置维护新设置，避免重复键和覆盖。已核实缺少命令的空项目可保留空映射或待补事实，并记录尚待首个业务任务验证。

## 决策文件

写入本地临时 JSON 数组。每项指定 key、mode、reason 及三个 SHA-256。key 为 catalog 中“部件 ID/片段 ID”。expected 是最终目标文件在本轮操作前的全文摘要，base 是上次已采用正本的摘要，incoming 是本轮分发正文的摘要。目标文件不存在或没有旧版时，用 JSON null。直接从 plan 的 issues、status、fingerprint 和 catalog 取值，实际文本要同时阅读。映射到其他文件时重新取该目标的 expected。

```json
[
  {
    "key": "independent-review/independent-review",
    "mode": "append",
    "path": "CONTRIBUTING.md",
    "reason": "团队在本页维护审核人资格。追加独立上下文、证据与修复后复核规则。",
    "expected": "<来自 fingerprint 的目标文件摘要>",
    "base": null,
    "incoming": "<来自 catalog 的该片段摘要>"
  }
]
```

- **append** 用于首次接入。省略 body 时复制完整正文并重定向可解析的模板链接。需要局部适配时提供最终片段 body，保留标准中的触发条件、行动和验收。Markdown 和 .gitignore 可与团队原文共存。
- **reference** 用于已有且已读的等价文件，写明覆盖依据；正文归项目所有。其内容变化后重新核实等价性。记录会保存标准基线和项目文档摘要。
- **merge** 用于升级时显式提供合并后的 body。比较 previous、installed、current、next；有证据的本地例外继续保留。**keep** 采用当前有效正文作为本地决定，写明为何足以覆盖或为何需要例外。
- **detach** 停止管理并保留现有正文，供仍需保留的本地规则使用。**drop** 用于已核实可删除的受管适配内容。两者都须与当前文件及正本匹配。移除 reference 只撤去采用记录和导航关系。默认部件停用后按项目选择保留，显式 add 可重新启用。
- 重复接入已采用项时，先核对 status，再不带已消费的首次决策文件运行 plan。初次计划中绑定的是改动前摘要。更新正本使用 upgrade。
- Markdown 链接指向已删除的文档或锚点时，计划列出引用来源，实际写入前更新它的归属文档或保留稳定目标。脚本检查托管文档及项目普通 Markdown 文件对改动目标的反向引用，跳过隐藏目录、依赖和构建产物。受管文本上限 4 MiB；单份反向引用来源可达 32 MiB。不可读或超限的普通 Markdown 列在 unverifiedReferences，交付时说明，按实际需要独立复核。外部 Issue、Wiki 与动态生成链接按项目实际使用情况另行核对。

## 已采用规格换源

项目已采用默认规格模板、现在改用团队现行 PRD，或原先引用的 PRD 改了路径时，使用一条 `reference` 决策。先读新 PRD 的正文与验收条件，再运行 `H status PROJECT --id requirements --detail` 核对旧位置与基线。旧文件已移走时，对照版本历史或已采用记录核实来历。用 `H fingerprint PROJECT 'product/现行 PRD.md'` 取新文件的全文摘要。

```json
[
  {
    "key": "requirements/requirements",
    "mode": "reference",
    "from": "specs/requirements.md",
    "fromExpected": "<status 中旧位置的 expected，旧文件已移走时填 JSON null>",
    "fromBaseline": "<status 中上次实际采用的 fromBaseline>",
    "path": "product/现行 PRD.md",
    "expected": "<新文件的 fingerprint>",
    "base": "<status 中的 base>",
    "incoming": "<status 中的 incoming>",
    "reason": "产品团队改在此处维护退款行为，已核对重复请求与验收条件。"
  }
]
```

将示例中的占位值换成实际摘要。运行 `H plan upgrade PROJECT --id requirements --decisions FILE --diff`，检查根导航、工作流等受管正文里的目的地，以及旧文件中保留的内容。确认后用相同参数执行 `H apply upgrade`，再运行 `H verify PROJECT`。接入流程也可以使用同一份决策执行 `plan adopt` 和 `apply adopt`。重复已完成的同一决策会得到空变更。

旧 PRD 仍然存在时，根导航和未定制的标准流程会跟随新 PRD。若定制片段也链接旧路径，先读两份规格和该片段的上下文。比如团队记录“按旧版验收复查”，两份规格恰好都叫“验收”的标题也可能有不同含义。根据计划返回的片段 key 和摘要，在同一份决策文件中附上 `keep` 保留该片段全文，或用 `merge` 提供最终片段，把现行入口改到新版，同时保留留档链接。在 reason 中写下依据。团队自行维护的文档由其维护者调整。旧文件真正移走或锚点消失时，仍须解决失效引用。

文件或目录仅调整大小写时，`from` 仍采用上次记录的拼写，`path` 填目录中实际的新拼写。旧拼写消失后 `fromExpected` 为 null，`expected` 取新文件的完整摘要。写入时会再次核对新位置和原文。

换源保留团队 PRD 的原文。旧模板中未改动的受管说明会撤去，已填写或适配的段落保留为项目正文，受管边界外的原文也会保留。工具创建的旧模板清空后才会随本次变更移除。原先采用的团队 PRD 若仍在原处，其正文继续保留。若团队页面仍引用消失的旧文件或锚点，或重定向后的受管链接在新 PRD 找不到对应锚点，预检会列出来源。核实引用含义，修复对应链接或恢复仍需保留的目标后，再次计划并应用。

`plan`、`apply` 和 `verify` 也会读取已登记规格的完整 Markdown，从该文件的实际目录解析正文直接引用的本地路径与 Markdown 锚点，包括引用式链接以及在模板块外填写的条款。例如规格索引从 `product/` 移到 `design/`，条款文件仍在原目录时，索引中的相对链接也需要调整。其他部件继续核对受管正文中的链接。外部服务、动态生成的页面及更深层级的条款索引，由执行 Agent 沿本次任务涉及的路径复核。

## 中断与恢复

项目写入先核对所有读写前提、锁定目录，再记录可用于回滚的本地日志。发现未完成的 `.kane-harness-pending.json` 会停止写入。保留现场，核对日志中的 before、after、当前文件与后续团队改动，只恢复仍属于该次操作的差异。确认树与采用记录一致后将日志移至私有位置，再运行 verify 和新的 plan。日志可含本次变更的完整文档，避免提交。
