#!/usr/bin/env python3
"""Create a traceable article package for a subtitle/transcript source."""

from __future__ import annotations

import argparse
import json
import shutil
import sys
from datetime import datetime, timezone
from pathlib import Path

from normalize_subtitle import normalize


def source_artifact_name(source: Path) -> str:
    suffix = source.suffix or ".txt"
    return f"00-source{suffix}"


def build_manifest(source: Path, package_dir: Path, source_copy: Path, normalized: Path) -> dict:
    now = datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")
    return {
        "source": str(source.resolve()),
        "package": str(package_dir.resolve()),
        "created_at": now,
        "status": "prepared",
        "artifacts": [
            {
                "step": "source_copy",
                "path": source_copy.name,
                "status": "success",
                "description": "Original input copied into the article package.",
            },
            {
                "step": "normalize",
                "path": normalized.name,
                "status": "success",
                "description": "Code-normalized continuous spoken text.",
            },
            {
                "step": "evidence_map",
                "path": "02-evidence-map.md",
                "status": "pending",
                "description": "Agent-written map of claims, order, data, examples, and key quotes.",
            },
            {
                "step": "draft",
                "path": "03-draft.md",
                "status": "pending",
                "description": "First complete article draft.",
            },
            {
                "step": "self_check",
                "path": "04-self-check.md",
                "status": "pending",
                "description": "Fidelity check against the normalized transcript.",
            },
            {
                "step": "final_article",
                "path": "article.md",
                "status": "pending",
                "description": "Final publishable Markdown article.",
            },
        ],
    }


def prepare_package(source: Path, package_dir: Path | None = None) -> Path:
    if not source.exists():
        raise FileNotFoundError(f"Input not found: {source}")
    if not source.is_file():
        raise ValueError(f"Input is not a file: {source}")

    package_dir = package_dir or source.with_name(f"{source.stem}_article")
    package_dir.mkdir(parents=True, exist_ok=True)

    source_copy = package_dir / source_artifact_name(source)
    shutil.copy2(source, source_copy)

    normalized = package_dir / "01-normalized.txt"
    normalized.write_text(normalize(source), encoding="utf-8")

    manifest = build_manifest(source, package_dir, source_copy, normalized)
    (package_dir / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    return package_dir


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Create a traceable article package from a subtitle/transcript file."
    )
    parser.add_argument("input", type=Path, help="Input subtitle, transcript, or JSON file")
    parser.add_argument(
        "-o",
        "--output-dir",
        type=Path,
        help="Package directory; defaults to <input-stem>_article next to the input",
    )
    args = parser.parse_args()

    try:
        package_dir = prepare_package(args.input, args.output_dir)
    except Exception as exc:
        print(f"Failed to prepare article package: {exc}", file=sys.stderr)
        return 1

    print(package_dir)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
