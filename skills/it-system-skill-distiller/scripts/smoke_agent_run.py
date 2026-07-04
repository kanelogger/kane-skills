#!/usr/bin/env python3
"""Smoke test the skill through a project-enabled agent skill path."""

from __future__ import annotations

import argparse
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path


def write(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content.strip() + "\n", encoding="utf-8")


def run(cmd: list[str]) -> None:
    subprocess.run(cmd, check=True)


def fill_package(root: Path) -> None:
    write(
        root / "README.md",
        """
# 合同管理系统 · 蒸馏技能包

本目录把合同管理系统蒸馏为一套 AI 可理解、可检索、可调用的业务能力说明。AI 只通过 API 操作业务，不直接访问数据库。

## 阅读顺序 / 加载策略

常驻加载：
1. `00-overview.md`
2. `01-glossary.md`
3. `domain/_index.md`
4. `api/_index.md`

按需检索：
- `domain/*.md`
- `api/contract/*.md`
- `reference/schema/*.md`
- `reference/enums.md`
- `reference/error-codes.md`
- `reference/model-code-conflicts.md`

## 资料盘点

| 资料类型 | 是否具备 | 路径 | 可信度 | 用途 |
| --- | --- | --- | --- | --- |
| 原始需求文档 | 是 | docs/requirements.md | 中 | 业务意图、术语、功能范围 |
| 数据库 Schema | 是 | db/schema.sql | 高 | 数据结构、约束、枚举 |
| 数据库实例/种子数据 | 是 | db/seed.sql | 高 | 真实取值、主数据、样例数据 |
| 本体/领域模型 | 否 | 未提供 | 中 | 对象关系、声明式约束 |
| 服务层源码 | 是 | src/services/contracts.py | 最高 | 实际规则、业务行为 |
| 路由/API 源码 | 是 | src/routes/contracts.py | 最高 | 接口清单、入参出参、鉴权 |

## 事实优先级

实际行为 / 规则细节：源码 > 数据库约束 > 需求文档。业务意图 / 概念含义：需求文档 > 代码注释。

## 目录结构

见 `domain/`、`api/`、`reference/`、`requirements/` 和 `validation/`。

## 写权限策略

读接口可直接调用；写接口为受控写，必须先回显客户 ID、金额、付款条款比例和预计状态，由用户确认后再提交。
""",
    )
    write(
        root / "00-overview.md",
        """
# 合同管理系统 · 能力总览

## 系统定位

合同管理系统管理已签署合同的录入、查询和开票前基础校验。它服务销售运营人员，把合同金额、客户和付款条款沉淀为后续开票和收款的依据。

## 业务边界

- 管理什么：已签署合同、客户引用、合同金额、付款条款和合同状态。
- 不管理什么：合同审批流、电子签章、发票税控和实际收款入账。

## 核心业务链路

客户主数据查询 -> 录入合同 -> 查询合同详情 -> 按合同状态进入后续开票流程。

## 核心业务对象

| 对象 | 角色 | 说明 | 详见 |
| --- | --- | --- | --- |
| 合同 | 聚合根 | 记录已签署合同及付款条款 | [[contract]] |

## 能力总览

| 能力 | 类型 | API | 详见 |
| --- | --- | --- | --- |
| 录入合同 | 写 | POST /api/contracts | [[create-contract]] |

## 给 AI 的操作约定

1. 只通过 API 操作，不直接读写数据库。
2. 写操作前通过客户查询接口把客户名称解析为 ID。
3. 服务端维护字段以系统返回为准，调用方不要自行设置。
4. 遵守写权限分级和确认要求。
5. 严格解释规则标签：`【服务端强制】`, `【服务端维护】`, `【调用方需预判】`, `【副作用】`。

## 技术事实

- 技术栈：Flask + SQLite
- 鉴权方式：Bearer token
- 统一响应信封：`{ "ok": boolean, "data": object, "errorCode": string, "message": string }`
- 错误说明：[[error-codes]]
""",
    )
    write(
        root / "01-glossary.md",
        """
# 业务术语表

| 术语 | 别名 / 代码名 | 含义 |
| --- | --- | --- |
| 合同 | contract | 与客户已签署的销售合同，金额必须大于 0。 |
| 客户 | customerId | 合同归属主体，写入时必须使用 ID。 |
| 付款条款 | paymentTerms | 合同付款阶段及比例，比例合计必须为 1。 |
""",
    )
    write(
        root / "domain" / "_index.md",
        """
# 领域模型总览

## 对象关系图

```text
Customer 1:N Contract
Contract 1:N PaymentTerm
```

## 关键关系说明

- 客户 1:N 合同：合同引用客户，客户生命周期独立于合同。
- 合同 1:N 付款条款：付款条款随合同创建，比例合计用于服务端校验。

## 对象清单

| 对象 | 角色 | 文档 |
| --- | --- | --- |
| 合同 | 聚合根 | [[contract]] |
""",
    )
    write(
        root / "domain" / "contract.md",
        """
# 业务对象：合同 (Contract)

## 一句话定义

合同是客户已签署销售协议的系统记录，是后续开票和收款的业务根对象。

## 业务语义

合同由销售运营人员录入。它承载客户、合同金额和付款条款。后续开票能力必须以合同状态和剩余金额为依据。

## 生命周期 / 状态

草稿 -> 已生效 -> 已关闭。创建接口默认生成已生效合同；关闭由后续流程触发。

## 关键属性（语义级）

| 属性 | 含义 | 约束 / 来源 |
| --- | --- | --- |
| customerId | 客户 ID | 必填，引用客户主数据 |
| totalAmount | 合同总额 | 【服务端强制】必须大于 0 |
| paymentTerms | 付款条款 | 【服务端强制】比例合计必须为 1 |
| status | 合同状态 | 【服务端维护】创建后返回 |

## 关系

- 包含付款条款：1:N，随合同创建。
- 引用客户：通过 `customerId` 关联客户主数据。

## 核心业务规则

1. 【服务端强制】合同金额必须大于 0，违反返回 `CONTRACT_AMOUNT_INVALID`。
2. 【服务端强制】付款比例合计必须等于 1，违反返回 `PAYMENT_RATIO_INVALID`。
3. 【服务端维护】合同编号和状态由服务端生成。
4. 【调用方需预判】客户名称必须先解析为客户 ID。
5. 【副作用】创建合同后会生成付款条款快照。

## 相关能力

- 录入合同：[[create-contract]]

## 明细索引

- Schema：`reference/schema/contracts.md`
- 枚举：[[enums]]
- 冲突：[[model-code-conflicts]]
""",
    )
    write(
        root / "api" / "_index.md",
        """
# API 能力清单

统一响应信封：`{ "ok": boolean, "data": object, "errorCode": string, "message": string }`。
鉴权：`Authorization: Bearer <token>`。

## 业务能力

| 能力 | 方法 + 路径 | 类型 | 文档 |
| --- | --- | --- | --- |
| 录入合同 | POST /api/contracts | 写 | [[create-contract]] |

## 平台 / 辅助接口

| 接口 | 方法 + 路径 | 用途 |
| --- | --- | --- |
| 查询客户 | GET /api/customers?name= | 名称转 ID |

## 典型编排

- “给客户 A 录入一笔 10 万合同” -> 查询客户 ID -> [[create-contract]] -> 查询合同详情复核。
""",
    )
    write(
        root / "api" / "contract" / "create-contract.md",
        """
# 接口：录入合同 (create-contract)

`POST /api/contracts`

## 业务场景

当用户要求为已签署客户合同建档时使用。例如：“给客户 A 录入一笔 10 万合同，分两期各 50%”。这是完整业务动作，不是底层 CRUD。

## 能力边界

- 做什么：创建合同主记录和付款条款快照。
- 不做什么：不审批合同、不开票、不确认收款。

## 输入（Body）

| 参数 | 类型 | 必填 | 含义 | 约束 |
| --- | --- | --- | --- | --- |
| customerId | string | 是 | 客户 ID | 调用前由客户查询接口解析 |
| totalAmount | number | 是 | 合同金额 | 大于 0 |
| paymentTerms | array | 是 | 付款阶段和比例 | ratio 合计为 1 |

## 输出（`data`）

| 字段 | 含义 |
| --- | --- |
| id | 合同 ID |
| contractNo | 【服务端维护】合同编号 |
| status | 【服务端维护】合同状态 |

## 关键规则

1. 【服务端强制】`totalAmount <= 0` 返回 `CONTRACT_AMOUNT_INVALID`。
2. 【服务端强制】付款比例合计不为 1 返回 `PAYMENT_RATIO_INVALID`。
3. 【调用方需预判】客户名称必须先解析为 customerId。
4. 【服务端维护】合同编号、状态由服务端生成。
5. 【副作用】服务端保存付款条款快照。

## 涉及对象

- 主对象：[[contract]]

## 可能错误

| message / errorCode | 含义 | AI 处理方式 |
| --- | --- | --- |
| CONTRACT_AMOUNT_INVALID | 金额非法 | 请用户提供大于 0 的金额 |
| PAYMENT_RATIO_INVALID | 付款比例非法 | 要求用户修正比例合计为 100% |

## 调用示例

```json
{
  "customerId": "cus_001",
  "totalAmount": 100000,
  "paymentTerms": [
    { "name": "首款", "ratio": 0.5 },
    { "name": "尾款", "ratio": 0.5 }
  ]
}
```

## 写权限分级

受控写。调用前必须回显客户 ID、金额和付款比例，并等待用户确认。
""",
    )
    write(
        root / "reference" / "schema" / "contracts.md",
        """
# Schema：contracts（合同主表）

对应领域对象：[[contract]]。AI 不直接访问该表；本文件只用于理解语义和排错。

| 字段 | 类型 | 含义 | 约束 | 领域/API 映射 |
| --- | --- | --- | --- | --- |
| id | text | 合同 ID | PK | id |
| customer_id | text | 客户 ID | NOT NULL | customerId |
| total_amount | numeric | 合同金额 | CHECK > 0 | totalAmount |
| status | text | 合同状态 | NOT NULL | status |

## 约束体现的业务规则

- `total_amount > 0` -> 合同金额必须大于 0。
""",
    )
    write(
        root / "reference" / "enums.md",
        """
# 枚举 / 字典值

`✅` = 代码实际使用。`⚠️` = 仅需求/模型定义或尚未验证。

## contract.status

| 值 | 含义 | 状态 |
| --- | --- | --- |
| active | 已生效 | ✅ |
| closed | 已关闭 | ✅ |
""",
    )
    write(
        root / "reference" / "error-codes.md",
        """
# 错误码与错误处理

统一响应信封：`{ ok, data, errorCode, message }`。

| errorCode / message | HTTP | 含义 | 来源 | AI 处理方式 |
| --- | --- | --- | --- | --- |
| CONTRACT_AMOUNT_INVALID | 400 | 合同金额必须大于 0 | createContract | 询问用户修正金额 |
| PAYMENT_RATIO_INVALID | 400 | 付款比例合计必须等于 1 | createContract | 要求用户修正付款条款 |
""",
    )
    write(
        root / "reference" / "model-code-conflicts.md",
        """
# 需求 / 模型 / 代码冲突

除非产品决策另行覆盖，实际运行行为以代码为准。

## 1. 暂无已确认冲突

- 需求/模型说：需求未提供独立本体模型。
- 代码实际行为：以服务层校验和数据库约束为准。
- AI 影响：无法证明的业务意图标注为待业务确认。
- 治理建议：补充正式领域模型后重新比对。
""",
    )
    write(
        root / "requirements" / "_index.md",
        """
# 原始需求

原始来源路径：docs/requirements.md

## 业务范围

管理已签署合同的基础建档和查询。

## 原始业务对象

合同、客户、付款条款。

## 原始要求的业务功能

1. 录入合同 -> [[create-contract]]

## 蒸馏中补充识别的能力

- 名称转客户 ID -> 平台辅助接口
""",
    )
    write(
        root / "validation" / "scenarios.md",
        """
# 验证场景

| ID | 类型 | 用户场景 | 预期 API 序列 | 预期结果 |
| --- | --- | --- | --- | --- |
| V1 | 读/查询 | 查客户 A 的 ID | GET /api/customers?name=A | 返回 cus_001 |
| V2 | 写操作 | 给客户 A 录入 10 万合同 | GET /api/customers -> POST /api/contracts | 返回 active 合同 |
| V3 | 统计 | 统计 active 合同数量 | GET /api/contracts?status=active | 返回数量 |
| V4 | 规则反例 | 付款比例 0.4 + 0.5 | POST /api/contracts | 返回 PAYMENT_RATIO_INVALID |
""",
    )
    write(
        root / "validation" / "results.md",
        """
# 验证结果

## 结论

仅通过静态验证。未连接测试环境，动态 API 调用未执行。

## 静态验证

| 场景 | 状态 | 证据 | 缺口 / 修复 |
| --- | --- | --- | --- |
| V1 | pass | api/_index.md 有客户查询编排 | 无 |
| V2 | pass | create-contract.md 有输入、规则、示例和写权限 | 无 |
| V3 | pass | api/_index.md 标注统计能力入口 | 后续需补完整统计 API |
| V4 | pass | create-contract.md 和 error-codes.md 记录 PAYMENT_RATIO_INVALID | 无 |

## 动态验证

- 状态：未执行
- 原因 / 证据：没有可用测试环境；剩余风险是接口返回字段和错误消息需在真实环境复核。
""",
    )


def main() -> int:
    parser = argparse.ArgumentParser(description="Run a smoke test through the enabled skill path.")
    parser.add_argument(
        "--skill-dir",
        default=".",
        help="Installed skill package directory",
    )
    parser.add_argument("--output-dir", help="Directory for the smoke distilled package")
    parser.add_argument("--keep", action="store_true", help="Do not delete the temporary output")
    args = parser.parse_args()

    skill_dir = Path(args.skill_dir).expanduser().resolve()
    init_script = skill_dir / "scripts" / "init_distilled_package.py"
    validate_script = skill_dir / "scripts" / "validate_distilled_package.py"

    if not init_script.exists() or not validate_script.exists():
        print(f"ERROR: enabled skill scripts are missing under {skill_dir}", file=sys.stderr)
        return 2

    temp_dir: tempfile.TemporaryDirectory[str] | None = None
    if args.output_dir:
        output_dir = Path(args.output_dir).expanduser().resolve()
        if output_dir.exists():
            shutil.rmtree(output_dir)
    else:
        temp_dir = tempfile.TemporaryDirectory(prefix="it-system-distiller-smoke-")
        output_dir = Path(temp_dir.name) / "distilled"

    run([sys.executable, str(init_script), str(output_dir), "--system-name", "合同管理系统", "--overwrite"])
    fill_package(output_dir)
    run([sys.executable, str(validate_script), str(output_dir)])
    print(f"SMOKE OK: agent skill path produced a valid distilled package: {output_dir}")

    if temp_dir and not args.keep:
        temp_dir.cleanup()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
