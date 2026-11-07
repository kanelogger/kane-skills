# GitHub 查询构建规则

阶段 0 抽取要素后，按本文件把需求翻译成 3-6 条 GitHub 仓库搜索查询。

## 要素

- 领域词（2-4 个）：需求所属领域。如 短链接、发票、知识库、表单、自动化。
- 实体词：核心对象/动作。如 URL 缩短、审批流、OCR、定时任务。
- 约束词：self-hosted / self-host / 离线 / 单机 / CLI / Web / 移动端 / open source。
- 技术栈提示：用户明确提到的语言或框架；没有则不加 `language:`。

## 规则

1. 查询模板：
   - `<领域词> <约束词>`（主查询，1-2 条）；
   - `<实体词> <约束词>`（1-2 条）；
   - 领域词 + 可选 `language:<栈>`（有技术栈提示时 1 条）；
   - 1 条中文查询兜底（仅当需求为中文表达时）。
2. 可加 qualifier：`archived:false`、`stars:>50`。
3. 中文需求优先英文关键词（GitHub 生态以英文为主），中文兜底查询直接搜中文词。
4. 领域词与实体词用空格分隔，不加引号（除非需要精确短语）。
5. 查询串中不要带评价性词（best、awesome、top）——它们会引入列表类仓库而非实现类项目。

## 示例

示例 1（带技术栈）：需求"做一个自托管的短链接服务，想用 Go 写"。

- `self-hosted url shortener`（+ `archived:false`）
- `url shortener self-host`
- `short link self-hosted`
- `url shortener language:go stars:>50`
- 中文兜底：`短链接 自托管`

示例 2（不带技术栈）：需求"给团队做一个内部发票审批系统"。

- `invoice approval system`
- `invoice workflow self-hosted`
- `expense approval open source`
- 中文兜底：`发票 审批 系统`
