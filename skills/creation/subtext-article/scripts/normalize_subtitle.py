#!/usr/bin/env python3
"""Normalize common subtitle/transcript files into continuous spoken text."""

from __future__ import annotations

import argparse
import html
import json
import math
import re
import sys
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Iterable, Optional


TIME = r"(?:\d+:\d{2}:\d{2}|\d{1,2}:\d{2})(?:[.,]\d{1,3})?"
CUE_TIMING = re.compile(rf"^\s*{TIME}\s*-->\s*{TIME}(?:\s+.*)?\s*$")
PREFIX_TIMESTAMP = re.compile(rf"^\s*(?:\[{TIME}\]|\({TIME}\)|{TIME}(?=\s+\S))\s*")
LRC_METADATA = re.compile(r"^\[(?:ar|al|ti|au|by|offset|re|ve|length):.*\]$", re.IGNORECASE)
ASS_SECTION = re.compile(r"^\s*\[[^\]]+\]\s*$")
ASS_DIALOGUE = re.compile(r"^\s*Dialogue\s*:\s*", re.IGNORECASE)
ASS_OVERRIDE = re.compile(r"\{\\[^}]*\}")
SUBTITLE_TAG = re.compile(r"</?(?:b|i|u|s|font|ruby|rt|c|v|lang)(?:[.\s][^<>]*)?>", re.IGNORECASE)
VTT_TIMESTAMP = re.compile(rf"<{TIME}>")
JSON_CONTAINER_KEYS = (
    "body", "segments", "utterances", "captions", "subtitles", "sentences",
    "chunks", "results", "items", "events", "words", "lines", "data",
    "result", "transcription", "transcripts", "alternatives", "channels",
)
JSON_TEXT_KEYS = (
    "text", "transcript", "content", "sentence", "subtitle", "caption",
    "utterance", "line", "word", "utf8",
)
ORDER_KEYS = (
    "start", "start_time", "startTime", "from", "begin", "offset", "tStartMs",
    "time", "index", "sid",
)


def clean_line(line: str) -> str:
    return re.sub(r"\s+", " ", line).strip()


def clean_subtitle_line(line: str) -> str:
    line = SUBTITLE_TAG.sub("", line)
    line = VTT_TIMESTAMP.sub("", line)
    return clean_line(html.unescape(line))


def parse_order(value) -> Optional[float]:
    if isinstance(value, bool) or not isinstance(value, (int, float, str)):
        return None
    try:
        if isinstance(value, str):
            raw = value.strip().replace(",", ".")
            if raw.endswith("ms"):
                result = float(raw[:-2]) / 1000
            elif raw.endswith("s"):
                result = float(raw[:-1])
            elif ":" in raw:
                parts = raw.split(":")
                if len(parts) not in {2, 3}:
                    return None
                result = 0.0
                for part in parts:
                    result = result * 60 + float(part)
            else:
                result = float(raw)
        else:
            result = float(value)
    except (ValueError, OverflowError):
        return None
    return result if math.isfinite(result) else None


def extract_from_json(value) -> list[str]:
    if isinstance(value, dict):
        for key in JSON_TEXT_KEYS:
            text = value.get(key)
            if isinstance(text, str) and text.strip():
                return [text.strip()]
        segs = value.get("segs")
        if isinstance(segs, list):
            text = "".join(
                seg["utf8"] for seg in segs
                if isinstance(seg, dict) and isinstance(seg.get("utf8"), str)
            )
            if text.strip():
                return [text.strip()]
        for key in JSON_CONTAINER_KEYS:
            child = value.get(key)
            if isinstance(child, (list, dict)):
                lines = extract_from_json(child)
                if lines:
                    return lines
        return []
    if isinstance(value, list):
        ordered = value
        if value and all(isinstance(item, dict) for item in value):
            for key in ORDER_KEYS:
                orders = [parse_order(item.get(key)) for item in value]
                if all(order is not None for order in orders):
                    ordered = [item for _, item in sorted(zip(orders, value), key=lambda pair: pair[0])]
                    break
        lines: list[str] = []
        for item in ordered:
            if isinstance(item, str):
                if item.strip():
                    lines.append(item.strip())
            else:
                lines.extend(extract_from_json(item))
        return lines
    return []


def extract_from_xml(text: str) -> list[str]:
    try:
        root = ET.fromstring(text)
    except ET.ParseError as exc:
        raise ValueError(f"Invalid XML transcript: {exc}") from None

    def local_name(tag: str) -> str:
        return tag.rsplit("}", 1)[-1].lower()

    root_name = local_name(root.tag)
    if root_name not in {"tt", "transcript", "timedtext", "subtitles", "captions"}:
        raise ValueError(f"Unsupported XML transcript root: {root_name}")
    if root_name == "tt":
        bodies = [node for node in root.iter() if local_name(node.tag) == "body"]
        nodes = [node for body in bodies for node in body.iter() if local_name(node.tag) == "p"]
    else:
        nodes = [node for node in root.iter() if local_name(node.tag) == "text"]
        if not nodes:
            nodes = [node for node in root.iter() if local_name(node.tag) in {"p", "s"}]

    def spoken_text(node) -> str:
        parts = [node.text or ""]
        for child in node:
            parts.append(" " if local_name(child.tag) == "br" else spoken_text(child))
            parts.append(child.tail or "")
        return "".join(parts)

    return [spoken_text(node) for node in nodes]


def extract_from_ass(text: str) -> list[str]:
    lines: list[str] = []
    in_events = False
    for raw in text.splitlines():
        stripped = raw.strip()
        if ASS_SECTION.match(stripped):
            in_events = stripped.lower() == "[events]"
            continue
        if not in_events or not ASS_DIALOGUE.match(stripped):
            continue
        payload = ASS_DIALOGUE.sub("", stripped, count=1)
        parts = payload.split(",", 9)
        if len(parts) != 10:
            raise ValueError("Invalid ASS/SSA dialogue: expected ten fields")
        line = ASS_OVERRIDE.sub("", parts[9])
        line = line.replace("\\N", " ").replace("\\n", " ").replace("\\h", " ")
        lines.append(clean_line(line))
    return lines


def extract_from_cues(text: str, webvtt: bool = False) -> list[str]:
    lines: list[str] = []
    for block in re.split(r"\n\s*\n", text.strip()):
        rows = [row.strip() for row in block.splitlines()]
        if not rows or not rows[0]:
            continue
        if webvtt and re.match(r"^(?:WEBVTT(?:\s|$)|NOTE(?:\s|$)|STYLE$|REGION$)", rows[0]):
            continue
        timing = next((i for i, row in enumerate(rows) if CUE_TIMING.fullmatch(row)), None)
        if timing is None or timing > 1:
            raise ValueError("Invalid subtitle cue: expected a timestamp range")
        for i in range(timing + 1, len(rows)):
            if CUE_TIMING.fullmatch(rows[i]):
                continue
            if i + 1 < len(rows) and CUE_TIMING.fullmatch(rows[i + 1]) and (webvtt or rows[i].isdigit()):
                continue
            lines.append(clean_subtitle_line(rows[i]))
    return lines


def extract_from_text(text: str, lrc: bool = False) -> list[str]:
    lines: list[str] = []
    for raw in text.splitlines():
        stripped = raw.strip()
        if lrc and LRC_METADATA.fullmatch(stripped):
            continue
        while True:
            without_timestamp = PREFIX_TIMESTAMP.sub("", stripped, count=1)
            if without_timestamp == stripped:
                break
            stripped = without_timestamp
        cleaned = clean_line(stripped)
        if cleaned:
            lines.append(cleaned)
    return lines


def merge_lines(lines: Iterable[str]) -> str:
    paragraphs: list[str] = []
    current: list[str] = []
    current_length = 0
    strong_end = re.compile(r"[。！？!?]$")

    for line in lines:
        if not line:
            continue
        if current:
            current.append(" " + line)
            current_length += len(line) + 1
        else:
            current.append(line)
            current_length = len(line)
        if strong_end.search(line) or current_length >= 220:
            paragraphs.append("".join(current))
            current = []
            current_length = 0
    if current:
        paragraphs.append("".join(current))

    return "\n\n".join(paragraphs).strip() + "\n"


def normalize(path: Path) -> str:
    raw = path.read_text(encoding="utf-8-sig")
    suffix = path.suffix.lower()

    stripped = raw.lstrip()
    if suffix in {".ass", ".ssa"} or re.match(r"\[(?:Script Info|Events|V4\+? Styles)\]", stripped, re.IGNORECASE):
        lines = extract_from_ass(raw)
    elif (
        suffix in {".xml", ".ttml", ".dfxp"}
        or re.match(r"<(?:\?xml\b|(?:tt|transcript|timedtext|subtitles|captions)(?:\s|/?>))", stripped, re.IGNORECASE)
    ):
        lines = extract_from_xml(raw)
    elif suffix in {".json", ".json3"} or re.match(r'\{\s*(?:"|\})|\[\s*[\[\{"]', stripped):
        try:
            parsed = json.loads(raw)
        except json.JSONDecodeError as exc:
            raise ValueError(f"Invalid JSON transcript: {exc.msg}") from None
        lines = extract_from_json(parsed)
        if not lines:
            raise ValueError("Unsupported JSON transcript structure or no spoken text found")
    elif suffix == ".vtt" or re.match(r"WEBVTT(?:\s|$)", stripped):
        lines = extract_from_cues(raw, webvtt=True)
    elif suffix == ".srt" or any(CUE_TIMING.fullmatch(row) for row in raw.splitlines()):
        lines = extract_from_cues(raw)
    else:
        lines = extract_from_text(raw, lrc=suffix == ".lrc")
    lines = [clean_line(line) for line in lines]
    lines = [line for line in lines if line]
    if not lines:
        raise ValueError("No spoken text found in input")
    return merge_lines(lines)


def main() -> int:
    parser = argparse.ArgumentParser(description="Normalize subtitle/transcript text.")
    parser.add_argument("input", type=Path, help="Input subtitle, transcript, or JSON file")
    parser.add_argument("-o", "--output", type=Path, help="Output text path; defaults to stdout")
    args = parser.parse_args()

    try:
        result = normalize(args.input)
        if args.output:
            args.output.write_text(result, encoding="utf-8")
        else:
            sys.stdout.write(result)
    except (OSError, UnicodeError, ValueError) as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
