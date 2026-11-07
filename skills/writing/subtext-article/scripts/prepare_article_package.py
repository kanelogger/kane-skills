#!/usr/bin/env python3
"""Prepare a source copy and readable transcript for article writing."""

from __future__ import annotations

import argparse
import shutil
import sys
from pathlib import Path

from normalize_subtitle import normalize


def source_artifact_name(source: Path) -> str:
    suffix = source.suffix or ".txt"
    name = f"00-source{suffix}"
    return f"work-{name}" if name.casefold() == f"{source.stem}.md".casefold() else name


def prepare_package(source: Path, package_dir: Path | None = None) -> Path:
    if not source.exists():
        raise FileNotFoundError(f"Input not found: {source}")
    if not source.is_file():
        raise ValueError(f"Input is not a file: {source}")

    package_dir = package_dir or source.with_name(f"{source.stem}_article")
    if package_dir.exists() and (not package_dir.is_dir() or any(package_dir.iterdir())):
        raise FileExistsError(f"Package directory is not empty; choose a new --output-dir: {package_dir}")
    package_dir.mkdir(parents=True, exist_ok=True)

    source_copy = package_dir / source_artifact_name(source)
    normalized = package_dir / "01-normalized.txt"
    shutil.copy2(source, source_copy)

    try:
        normalized.write_text(normalize(source_copy), encoding="utf-8")
    except Exception:
        normalized.unlink(missing_ok=True)
        raise

    return package_dir


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Prepare a source copy and readable transcript for article writing."
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
