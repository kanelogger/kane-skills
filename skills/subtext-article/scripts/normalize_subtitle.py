#!/usr/bin/env python3
"""Normalize common subtitle/transcript files into continuous spoken text."""

from __future__ import annotations

import argparse
import html
import json
import re
import sys
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Iterable


TIMESTAMP_LINE = re.compile(
    r"^\s*(?:\(?\[?)?(?:\d{1,2}:)?\d{1,2}:\d{2}(?:[.,]\d{1,3})?(?:\)?\]?)?"
    r"(?:\s*-->\s*(?:\(?\[?)?(?:\d{1,2}:)?\d{1,2}:\d{2}(?:[.,]\d{1,3})?(?:\)?\]?)?(?:\s+.*)?)?\s*$"
)
INLINE_TIMESTAMP = re.compile(r"(?:\(|\[)?\b(?:\d{1,2}:)?\d{1,2}:\d{2}(?:[.,]\d{1,3})?\b(?:\)|\])?")
WEBVTT_METADATA = re.compile(r"^\s*(WEBVTT|Kind:|Language:|NOTE\b|STYLE\b|REGION\b)")
TRANSCRIPT_LABEL = re.compile(r"^\s*(Transcripts?|Transcript|字幕|转写)\s*[:：]\s*", re.IGNORECASE)
ASS_SECTION = re.compile(r"^\s*\[[^\]]+\]\s*$")
ASS_DIALOGUE = re.compile(r"^\s*Dialogue\s*:\s*", re.IGNORECASE)
ASS_OVERRIDE = re.compile(r"\{[^}]*\}")
HTML_TAG = re.compile(r"<[^>]+>")
JSON_CONTAINER_KEYS = (
    "body",
    "segments",
    "utterances",
    "captions",
    "subtitles",
    "sentences",
    "chunks",
    "results",
    "items",
    "events",
    "words",
    "lines",
)
JSON_TEXT_KEYS = (
    "content",
    "text",
    "transcript",
    "sentence",
    "subtitle",
    "caption",
    "utterance",
    "line",
    "word",
    "utf8",
)
ORDER_KEYS = (
    "sid",
    "index",
    "id",
    "from",
    "start",
    "start_time",
    "startTime",
    "begin",
    "offset",
    "tStartMs",
    "time",
)


def clean_line(line: str) -> str:
    line = html.unescape(line.strip())
    line = TRANSCRIPT_LABEL.sub("", line)
    line = line.replace("\\N", " ").replace("\\n", " ")
    line = ASS_OVERRIDE.sub("", line)
    line = INLINE_TIMESTAMP.sub("", line).strip()
    line = HTML_TAG.sub("", line)
    line = re.sub(r"\s+", " ", line)
    return line


def parse_order(value) -> float:
    if isinstance(value, (int, float)):
        return float(value)
    if not isinstance(value, str):
        return 0.0
    raw = value.strip().rstrip("s")
    if raw.endswith("ms"):
        try:
            return float(raw[:-2]) / 1000
        except ValueError:
            return 0.0
    if ":" in raw:
        total = 0.0
        for part in raw.replace(",", ".").split(":"):
            try:
                total = total * 60 + float(part)
            except ValueError:
                return 0.0
        return total
    try:
        return float(raw)
    except ValueError:
        return 0.0


def order_value(item) -> float:
    if not isinstance(item, dict):
        return 0.0
    for key in ORDER_KEYS:
        if key in item:
            return parse_order(item[key])
    return 0.0


def extract_from_json(value) -> list[str]:
    if isinstance(value, dict):
        for key in JSON_CONTAINER_KEYS:
            child = value.get(key)
            if isinstance(child, list):
                return extract_from_json(sorted(child, key=order_value))
        collected: list[str] = []
        for key in JSON_TEXT_KEYS:
            text = value.get(key)
            if isinstance(text, str) and text.strip():
                collected.append(text.strip())
                break
        if collected:
            return collected
        for child in value.values():
            collected.extend(extract_from_json(child))
        return collected
    if isinstance(value, list):
        collected: list[str] = []
        for item in value:
            collected.extend(extract_from_json(item))
        return collected
    return []


def extract_from_xml(text: str) -> list[str]:
    try:
        root = ET.fromstring(text)
    except ET.ParseError:
        return []

    def local_name(tag: str) -> str:
        return tag.rsplit("}", 1)[-1].lower()

    preferred = [node for node in root.iter() if local_name(node.tag) == "text"]
    if not preferred:
        preferred = [node for node in root.iter() if local_name(node.tag) in {"p", "s"}]

    lines = []
    for node in preferred:
        content = "".join(node.itertext()).strip()
        if content:
            lines.append(content)
    return lines


def extract_from_ass(text: str) -> list[str]:
    lines: list[str] = []
    in_events = False
    for raw in text.splitlines():
        stripped = raw.strip()
        if not stripped:
            continue
        if ASS_SECTION.match(stripped):
            in_events = stripped.lower() == "[events]"
            continue
        if not in_events or not ASS_DIALOGUE.match(stripped):
            continue
        payload = ASS_DIALOGUE.sub("", stripped, count=1)
        parts = payload.split(",", 9)
        if len(parts) == 10:
            cleaned = clean_line(parts[9])
            if cleaned:
                lines.append(cleaned)
    return lines


def extract_from_text(text: str) -> list[str]:
    lines: list[str] = []
    for raw in text.splitlines():
        stripped = raw.strip()
        if not stripped:
            continue
        if stripped.startswith("[") and ASS_SECTION.match(stripped):
            continue
        if ASS_DIALOGUE.match(stripped):
            parts = ASS_DIALOGUE.sub("", stripped, count=1).split(",", 9)
            if len(parts) == 10:
                stripped = parts[9]
        if stripped.isdigit():
            continue
        if TIMESTAMP_LINE.match(stripped):
            continue
        if WEBVTT_METADATA.match(stripped):
            continue
        cleaned = clean_line(stripped)
        if cleaned:
            lines.append(cleaned)
    return lines


def merge_lines(lines: Iterable[str]) -> str:
    paragraphs: list[str] = []
    current: list[str] = []
    strong_end = re.compile(r"[。！？!?]$")

    for line in lines:
        if not line:
            continue
        if current:
            current.append(" " + line)
        else:
            current.append(line)
        if strong_end.search(line) or len("".join(current)) >= 220:
            paragraphs.append("".join(current))
            current = []
    if current:
        paragraphs.append("".join(current))

    return "\n\n".join(paragraphs).strip() + "\n"


def normalize(path: Path) -> str:
    raw = path.read_text(encoding="utf-8-sig")
    suffix = path.suffix.lower()

    if suffix in {".ass", ".ssa"}:
        lines = extract_from_ass(raw)
    elif suffix in {".xml", ".ttml", ".dfxp"} or raw.lstrip().startswith("<"):
        lines = extract_from_xml(raw)
        if not lines:
            lines = extract_from_text(raw)
    else:
        try:
            parsed = json.loads(raw)
        except json.JSONDecodeError:
            lines = extract_from_text(raw)
        else:
            lines = [clean_line(line) for line in extract_from_json(parsed)]
            lines = [line for line in lines if line]
            if not lines:
                lines = extract_from_text(raw)
    return merge_lines(lines)


def main() -> int:
    parser = argparse.ArgumentParser(description="Normalize subtitle/transcript text.")
    parser.add_argument("input", type=Path, help="Input subtitle, transcript, or JSON file")
    parser.add_argument("-o", "--output", type=Path, help="Output text path; defaults to stdout")
    args = parser.parse_args()

    if not args.input.exists():
        print(f"Input not found: {args.input}", file=sys.stderr)
        return 1

    result = normalize(args.input)
    if args.output:
        args.output.write_text(result, encoding="utf-8")
    else:
        sys.stdout.write(result)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
