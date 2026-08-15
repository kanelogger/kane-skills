#!/usr/bin/env python3
"""Generate a sentence-level Markdown diff for two cleaned Chinese policy texts."""

from __future__ import annotations

import argparse
import difflib
import html
import re
from pathlib import Path


SENTENCE_BOUNDARY = re.compile(r"(?<=[。！？；!?])\s*")
MARKDOWN_PREFIX = re.compile(r"^\s*(?:#{1,6}\s+|[-*+]\s+|>\s*)")


def read_sentences(path: Path) -> list[str]:
    text = path.read_text(encoding="utf-8-sig").replace("\r\n", "\n")
    if text.startswith("---\n"):
        end = text.find("\n---\n", 4)
        if end != -1:
            text = text[end + 5 :]
    text = html.unescape(text)

    sentences: list[str] = []
    for raw_line in text.splitlines():
        line = MARKDOWN_PREFIX.sub("", raw_line).strip()
        if not line:
            continue
        for part in SENTENCE_BOUNDARY.split(line):
            normalized = re.sub(r"\s+", " ", part).strip()
            if normalized:
                sentences.append(normalized)
    return sentences


def compare(old: list[str], new: list[str]) -> tuple[list[tuple[str, str]], list[str], list[str], int]:
    matcher = difflib.SequenceMatcher(a=old, b=new, autojunk=False)
    modified: list[tuple[str, str]] = []
    added: list[str] = []
    deleted: list[str] = []
    unchanged = 0

    for tag, i1, i2, j1, j2 in matcher.get_opcodes():
        if tag == "equal":
            unchanged += i2 - i1
        elif tag == "insert":
            added.extend(new[j1:j2])
        elif tag == "delete":
            deleted.extend(old[i1:i2])
        else:
            old_block = old[i1:i2]
            new_block = new[j1:j2]
            paired = min(len(old_block), len(new_block))
            modified.extend(zip(old_block[:paired], new_block[:paired]))
            deleted.extend(old_block[paired:])
            added.extend(new_block[paired:])

    return modified, added, deleted, unchanged


def render(old_path: Path, new_path: Path) -> str:
    old = read_sentences(old_path)
    new = read_sentences(new_path)
    modified, added, deleted, unchanged = compare(old, new)

    lines = [
        "# 政策文本对比",
        "",
        f"- 旧文本：`{old_path}`（{len(old)} 句）",
        f"- 新文本：`{new_path}`（{len(new)} 句）",
        f"- 未变化：{unchanged} 句",
        f"- 修改候选：{len(modified)} 组",
        f"- 新增：{len(added)} 句",
        f"- 删除：{len(deleted)} 句",
        "",
        "> 本结果按句子机械对齐，只提供候选差异；政策含义必须结合上下文人工判断。",
        "",
        "## 修改候选",
        "",
    ]

    if modified:
        for index, (before, after) in enumerate(modified, 1):
            lines.extend([f"### M{index}", "", f"- 原文：{before}", f"- 新文：{after}", ""])
    else:
        lines.extend(["无。", ""])

    lines.extend(["## 新增", ""])
    lines.extend([f"- {sentence}" for sentence in added] or ["无。"])
    lines.extend(["", "## 删除", ""])
    lines.extend([f"- {sentence}" for sentence in deleted] or ["无。"])
    lines.append("")
    return "\n".join(lines)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("old", type=Path, help="旧版 UTF-8 文本或 Markdown 文件")
    parser.add_argument("new", type=Path, help="新版 UTF-8 文本或 Markdown 文件")
    parser.add_argument("-o", "--output", type=Path, help="Markdown 输出路径；默认写到标准输出")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    report = render(args.old, args.new)
    if args.output:
        args.output.write_text(report, encoding="utf-8")
    else:
        print(report, end="")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
