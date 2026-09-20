#!/usr/bin/env python3
"""Validate the deterministic parts of a generated shopping HTML report."""

from __future__ import annotations

import argparse
import re
import sys
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlparse


REQUIRED_SECTIONS = {
    "summary",
    "products",
    "comparison",
    "price-audit",
    "scenarios",
    "evidence",
}
ALLOWED_IMAGE_SUFFIXES = {".avif", ".jpeg", ".jpg", ".png", ".webp"}


class ReportParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.ids: set[str] = set()
        self.has_viewport = False
        self.has_title = False
        self.has_time = False
        self.has_comparison_table = False
        self.remote_dependencies: list[str] = []
        self.images: list[dict[str, str]] = []
        self.source_links: list[str] = []
        self.cards: list[dict[str, int]] = []
        self._stack: list[tuple[str, int | None]] = []
        self._title_depth = 0

    @staticmethod
    def _attrs(attrs: list[tuple[str, str | None]]) -> dict[str, str]:
        return {key: value or "" for key, value in attrs}

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        values = self._attrs(attrs)
        classes = set(values.get("class", "").split())
        element_id = values.get("id")
        if element_id:
            self.ids.add(element_id)

        current_card = self._stack[-1][1] if self._stack else None
        if "product-card" in classes:
            current_card = len(self.cards)
            self.cards.append({"images": 0})

        self._stack.append((tag, current_card))

        if tag == "meta" and values.get("name", "").lower() == "viewport":
            self.has_viewport = True
        elif tag == "title":
            self._title_depth += 1
        elif tag == "time" and values.get("datetime"):
            self.has_time = True
        elif tag == "table" and "comparison-table" in classes:
            self.has_comparison_table = True
        elif tag == "img":
            image = {"src": values.get("src", ""), "alt": values.get("alt", "")}
            self.images.append(image)
            if current_card is not None:
                self.cards[current_card]["images"] += 1
        elif tag == "a":
            href = values.get("href", "")
            if urlparse(href).scheme in {"http", "https"}:
                self.source_links.append(href)
        elif tag == "script" and values.get("src"):
            src = values["src"]
            if urlparse(src).scheme in {"http", "https"} or src.startswith("//"):
                self.remote_dependencies.append(src)
        elif tag == "link" and "stylesheet" in values.get("rel", "").lower():
            href = values.get("href", "")
            if urlparse(href).scheme in {"http", "https"} or href.startswith("//"):
                self.remote_dependencies.append(href)

    def handle_startendtag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        self.handle_starttag(tag, attrs)
        self.handle_endtag(tag)

    def handle_endtag(self, tag: str) -> None:
        if tag == "title" and self._title_depth:
            self._title_depth -= 1
        for index in range(len(self._stack) - 1, -1, -1):
            if self._stack[index][0] == tag:
                del self._stack[index:]
                break

    def handle_data(self, data: str) -> None:
        if self._title_depth and data.strip():
            self.has_title = True


def resolve_report_path(raw_path: str) -> tuple[Path, Path]:
    supplied = Path(raw_path).expanduser().resolve()
    html_path = supplied / "index.html" if supplied.is_dir() else supplied
    return html_path, html_path.parent


def validate(raw_path: str, min_products: int) -> list[str]:
    html_path, report_root = resolve_report_path(raw_path)
    errors: list[str] = []

    if not html_path.is_file():
        return [f"missing HTML report: {html_path}"]

    try:
        html = html_path.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        return [f"report is not valid UTF-8: {html_path}"]

    parser = ReportParser()
    parser.feed(html)
    parser.close()

    missing_sections = sorted(REQUIRED_SECTIONS - parser.ids)
    if missing_sections:
        errors.append("missing required section ids: " + ", ".join(missing_sections))
    if not parser.has_viewport:
        errors.append("missing viewport meta tag")
    if not parser.has_title:
        errors.append("missing non-empty title")
    if not parser.has_time:
        errors.append('missing <time datetime="YYYY-MM-DD">')
    if not parser.has_comparison_table:
        errors.append('missing <table class="comparison-table">')
    if len(parser.cards) < min_products:
        errors.append(f"found {len(parser.cards)} product cards; expected at least {min_products}")
    for number, card in enumerate(parser.cards, start=1):
        if card["images"] != 1:
            errors.append(f"product card {number} must contain exactly one image")
    if len(parser.images) < min_products:
        errors.append(f"found {len(parser.images)} images; expected at least {min_products}")

    for number, image in enumerate(parser.images, start=1):
        src = image["src"].strip()
        alt = image["alt"].strip()
        if not alt:
            errors.append(f"image {number} has empty alt text")
        if not src:
            errors.append(f"image {number} has empty src")
            continue
        parsed = urlparse(src)
        if parsed.scheme or src.startswith("//") or src.startswith("data:"):
            errors.append(f"image {number} is not a local file: {src}")
            continue
        candidate = (report_root / parsed.path).resolve()
        try:
            candidate.relative_to(report_root)
        except ValueError:
            errors.append(f"image {number} escapes the report directory: {src}")
            continue
        if candidate.suffix.lower() not in ALLOWED_IMAGE_SUFFIXES:
            errors.append(f"image {number} has unsupported format: {src}")
        if not candidate.is_file() or candidate.stat().st_size == 0:
            errors.append(f"image {number} is missing or empty: {src}")

    if parser.remote_dependencies:
        errors.append("remote CSS/JavaScript dependencies: " + ", ".join(parser.remote_dependencies))
    if len(parser.source_links) < min_products:
        errors.append(
            f"found {len(parser.source_links)} external source links; expected at least {min_products}"
        )
    placeholders = sorted(set(re.findall(r"\{\{[^{}]+\}\}", html)))
    if placeholders:
        errors.append("unresolved template placeholders: " + ", ".join(placeholders[:8]))

    return errors


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("report", help="Report directory or path to index.html")
    parser.add_argument(
        "--min-products",
        type=int,
        default=3,
        help="Minimum number of product cards and local images (default: 3)",
    )
    args = parser.parse_args()
    if args.min_products < 1:
        parser.error("--min-products must be at least 1")

    errors = validate(args.report, args.min_products)
    if errors:
        for error in errors:
            print(f"FAIL: {error}", file=sys.stderr)
        print(f"\n{len(errors)} validation failure(s).", file=sys.stderr)
        return 1

    html_path, _ = resolve_report_path(args.report)
    print(f"Shopping report validation passed: {html_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
