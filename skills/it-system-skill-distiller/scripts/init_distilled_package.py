#!/usr/bin/env python3
"""为 IT 业务系统创建标准 distilled/ 技能包骨架。"""

from __future__ import annotations

import argparse
from pathlib import Path


PLACEHOLDER = "<待根据资料填写>"


FILES = {
    "README.md": """# {system_name} · 蒸馏技能包

本目录把 {system_name} 蒸馏为一套 AI 可理解、可检索、可调用的业务能力说明。AI 只通过 API 操作业务，不直接访问数据库。

## 阅读顺序 / 加载策略

常驻加载：
1. `00-overview.md`
2. `01-glossary.md`
3. `domain/_index.md`
4. `api/_index.md`

按需检索：
- `domain/*.md`
- `api/<domain>/*.md`
- `reference/schema/*.md`
- `reference/enums.md`
- `reference/error-codes.md`
- `reference/model-code-conflicts.md`

## 资料盘点

| 资料类型 | 是否具备 | 路径 | 可信度 | 用途 |
| --- | --- | --- | --- | --- |
| 原始需求文档 | {placeholder} | {placeholder} | 中 | 业务意图、术语、功能范围 |
| 数据库 Schema | {placeholder} | {placeholder} | 高 | 数据结构、约束、枚举 |
| 数据库实例/种子数据 | {placeholder} | {placeholder} | 高 | 真实取值、主数据、样例数据 |
| 本体/领域模型 | {placeholder} | {placeholder} | 中 | 对象关系、声明式约束 |
| 服务层源码 | {placeholder} | {placeholder} | 最高 | 实际规则、业务行为 |
| 路由/API 源码 | {placeholder} | {placeholder} | 最高 | 接口清单、入参出参、鉴权 |

## 目录结构

{placeholder}

## 写权限策略

{placeholder}
""",
    "00-overview.md": """# {system_name} · 能力总览

## 系统定位

{placeholder}

## 业务边界

- 管理什么：{placeholder}
- 不管理什么：{placeholder}

## 核心业务链路

{placeholder}

## 核心业务对象

| 对象 | 角色 | 说明 | 详见 |
| --- | --- | --- | --- |
| {placeholder} | {placeholder} | {placeholder} | [[{placeholder}]] |

## 能力总览

| 能力 | 类型 | API | 详见 |
| --- | --- | --- | --- |
| {placeholder} | 读/写/统计 | {placeholder} | [[{placeholder}]] |

## 给 AI 的操作约定

1. 只通过 API 操作，不直接读写数据库。
2. 写操作前通过主数据/查询接口把名称解析为 ID。
3. 服务端维护字段以系统返回为准，调用方不要自行设置。
4. 遵守写权限分级和确认要求。
5. 严格解释规则标签：`【服务端强制】`, `【服务端维护】`, `【调用方需预判】`, `【副作用】`。

## 技术事实

- 技术栈：{placeholder}
- 鉴权方式：{placeholder}
- 统一响应信封：{placeholder}
- 错误说明：[[error-codes]]
""",
    "01-glossary.md": """# 业务术语表

| 术语 | 别名 / 代码名 | 含义 |
| --- | --- | --- |
| {placeholder} | {placeholder} | {placeholder} |
""",
    "domain/_index.md": """# 领域模型总览

## 对象关系图

```text
{placeholder}
```

## 关键关系说明

- {placeholder}

## 对象清单

| 对象 | 角色 | 文档 |
| --- | --- | --- |
| {placeholder} | 聚合根/明细/主数据 | [[{placeholder}]] |
""",
    "api/_index.md": """# API 能力清单

统一响应信封：`{placeholder}`。
鉴权：`{placeholder}`。

## 业务能力

| 能力 | 方法 + 路径 | 类型 | 文档 |
| --- | --- | --- | --- |
| {placeholder} | {placeholder} | 读/写/统计 | [[{placeholder}]] |

## 平台 / 辅助接口

| 接口 | 方法 + 路径 | 用途 |
| --- | --- | --- |
| {placeholder} | {placeholder} | {placeholder} |

## 典型编排

- “{placeholder}” -> [[{placeholder}]]。
""",
    "reference/enums.md": """# 枚举 / 字典值

`✅` = 代码实际使用。`⚠️` = 仅需求/模型定义或尚未验证。

## {placeholder}

| 值 | 含义 | 状态 |
| --- | --- | --- |
| {placeholder} | {placeholder} | ✅ |
""",
    "reference/error-codes.md": """# 错误码与错误处理

统一响应信封：{placeholder}。

| errorCode / message | HTTP | 含义 | 来源 | AI 处理方式 |
| --- | --- | --- | --- | --- |
| {placeholder} | {placeholder} | {placeholder} | {placeholder} | {placeholder} |
""",
    "reference/model-code-conflicts.md": """# 需求 / 模型 / 代码冲突

除非产品决策另行覆盖，实际运行行为以代码为准。

## 1. {placeholder}

- 需求/模型说：{placeholder}
- 代码实际行为：{placeholder}
- AI 影响：{placeholder}
- 治理建议：{placeholder}
""",
    "requirements/_index.md": """# 原始需求

原始来源路径：{placeholder}

## 业务范围

{placeholder}

## 原始业务对象

{placeholder}

## 原始要求的业务功能

1. {placeholder} -> [[{placeholder}]]

## 蒸馏中补充识别的能力

- {placeholder} -> [[{placeholder}]]
""",
    "validation/scenarios.md": """# 验证场景

| ID | 类型 | 用户场景 | 预期 API 序列 | 预期结果 |
| --- | --- | --- | --- | --- |
| V1 | 读/查询 | {placeholder} | {placeholder} | {placeholder} |
| V2 | 写操作 | {placeholder} | {placeholder} | {placeholder} |
| V3 | 统计 | {placeholder} | {placeholder} | {placeholder} |
| V4 | 规则反例 | {placeholder} | {placeholder} | {placeholder} |
""",
    "validation/results.md": """# 验证结果

## 结论

{placeholder}

## 静态验证

| 场景 | 状态 | 证据 | 缺口 / 修复 |
| --- | --- | --- | --- |
| {placeholder} | pending | {placeholder} | {placeholder} |

## 动态验证

- 状态：{placeholder}
- 原因 / 证据：{placeholder}
""",
}


def write_file(path: Path, content: str, overwrite: bool) -> bool:
    if path.exists() and not overwrite:
        return False
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")
    return True


def main() -> int:
    parser = argparse.ArgumentParser(description="创建 distilled 技能包骨架。")
    parser.add_argument("output_dir", help="输出目录，通常是 /path/to/project/distilled")
    parser.add_argument("--system-name", default="目标系统", help="业务系统名称")
    parser.add_argument("--overwrite", action="store_true", help="覆盖已存在的骨架文件")
    args = parser.parse_args()

    output_dir = Path(args.output_dir).expanduser().resolve()
    created = []
    skipped = []

    for rel_path, template in FILES.items():
        rendered = template.format(system_name=args.system_name, placeholder=PLACEHOLDER)
        target = output_dir / rel_path
        if write_file(target, rendered, args.overwrite):
            created.append(rel_path)
        else:
            skipped.append(rel_path)

    schema_dir = output_dir / "reference" / "schema"
    schema_dir.mkdir(parents=True, exist_ok=True)
    keep = schema_dir / ".gitkeep"
    if write_file(keep, "", args.overwrite):
        created.append("reference/schema/.gitkeep")
    else:
        skipped.append("reference/schema/.gitkeep")

    print(f"蒸馏技能包目录: {output_dir}")
    print(f"新建文件数: {len(created)}")
    for item in created:
        print(f"  + {item}")
    if skipped:
        print(f"已存在并跳过: {len(skipped)}")
        for item in skipped:
            print(f"  = {item}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
