#!/usr/bin/env python3
"""Validate a distilled/ package before handoff."""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path


PLACEHOLDERS = ("<待根据资料填写>", "<placeholder>", "TODO")
RULE_TAGS = ("【服务端强制】", "【服务端维护】", "【调用方需预判】", "【副作用】")

REQUIRED_FILES = (
    "README.md",
    "00-overview.md",
    "01-glossary.md",
    "domain/_index.md",
    "api/_index.md",
    "reference/enums.md",
    "reference/error-codes.md",
    "reference/model-code-conflicts.md",
    "requirements/_index.md",
    "validation/scenarios.md",
    "validation/results.md",
)

REQUIRED_TEXT = {
    "README.md": ("资料盘点", "写权限"),
    "00-overview.md": ("系统定位", "业务边界", "给 AI 的操作约定", "只通过 API"),
    "domain/_index.md": ("对象关系", "对象清单"),
    "api/_index.md": ("业务能力", "典型编排"),
    "validation/scenarios.md": ("读/查询", "写操作", "统计", "规则反例"),
    "validation/results.md": ("证据",),
}


def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def rel(path: Path, root: Path) -> str:
    return str(path.relative_to(root))


def markdown_files(root: Path) -> list[Path]:
    return sorted(path for path in root.rglob("*.md") if path.is_file())


def is_nonempty_markdown(path: Path) -> bool:
    return path.is_file() and bool(read_text(path).strip())


def has_real_table_rows(text: str) -> bool:
    return any(line.startswith("|") and "---" not in line and "<" not in line for line in text.splitlines())


def collect_refs(text: str) -> set[str]:
    return set(re.findall(r"\[\[([a-z0-9][a-z0-9-]*)\]\]", text))


def known_slugs(root: Path) -> set[str]:
    slugs = {path.stem for path in markdown_files(root)}
    slugs.update({"enums", "error-codes", "model-code-conflicts"})
    return slugs


def main() -> int:
    parser = argparse.ArgumentParser(description="Validate a distilled package.")
    parser.add_argument("distilled_dir", help="Path to distilled output directory")
    args = parser.parse_args()

    root = Path(args.distilled_dir).expanduser().resolve()
    errors: list[str] = []
    warnings: list[str] = []

    if not root.exists():
        print(f"ERROR: distilled directory does not exist: {root}")
        return 2
    if not root.is_dir():
        print(f"ERROR: distilled path is not a directory: {root}")
        return 2

    for item in REQUIRED_FILES:
        path = root / item
        if not is_nonempty_markdown(path):
            errors.append(f"missing or empty required file: {item}")

    schema_files = sorted((root / "reference" / "schema").glob("*.md"))
    if not schema_files:
        errors.append("missing reference/schema/*.md")

    domain_files = [path for path in sorted((root / "domain").glob("*.md")) if path.name != "_index.md"]
    if not domain_files:
        errors.append("missing domain/<business-object>.md")

    api_files = [path for path in sorted((root / "api").rglob("*.md")) if path.name != "_index.md"]
    if not api_files:
        errors.append("missing api/<domain>/<use-case>.md")

    for path in markdown_files(root):
        text = read_text(path)
        for placeholder in PLACEHOLDERS:
            if placeholder in text:
                errors.append(f"placeholder remains in {rel(path, root)}: {placeholder}")
                break

    for item, terms in REQUIRED_TEXT.items():
        path = root / item
        if path.exists():
            text = read_text(path)
            for term in terms:
                if term not in text:
                    errors.append(f"{item} missing required section/text: {term}")

    readme = root / "README.md"
    if readme.exists() and not has_real_table_rows(read_text(readme)):
        errors.append("README.md does not contain real inventory table rows")

    for path in domain_files + api_files:
        text = read_text(path)
        if not any(tag in text for tag in RULE_TAGS):
            errors.append(f"{rel(path, root)} missing rule execution tag")

    for path in api_files:
        text = read_text(path)
        for term in ("业务场景", "能力边界", "输入", "输出", "关键规则", "可能错误", "调用示例", "写权限分级"):
            if term not in text:
                errors.append(f"{rel(path, root)} missing API contract section: {term}")

    for path in domain_files:
        text = read_text(path)
        for term in ("一句话定义", "业务语义", "生命周期", "关键属性", "核心业务规则", "相关能力", "明细索引"):
            if term not in text:
                errors.append(f"{rel(path, root)} missing domain section: {term}")

    slugs = known_slugs(root)
    for path in markdown_files(root):
        for ref in collect_refs(read_text(path)):
            if ref not in slugs:
                warnings.append(f"{rel(path, root)} references unknown slug: [[{ref}]]")

    results = root / "validation" / "results.md"
    if results.exists():
        result_text = read_text(results)
        if "pending" in result_text:
            errors.append("validation/results.md still contains pending status")
        if "仅通过静态验证" not in result_text and "动态验证通过" not in result_text:
            errors.append("validation/results.md must state 仅通过静态验证 or 动态验证通过")

    if warnings:
        print("WARNINGS:")
        for warning in warnings:
            print(f"  - {warning}")
    if errors:
        print("FAILED:")
        for error in errors:
            print(f"  - {error}")
        return 1

    print(f"OK: distilled package passed validation: {root}")
    print(f"domain files: {len(domain_files)}")
    print(f"api files: {len(api_files)}")
    print(f"schema files: {len(schema_files)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
