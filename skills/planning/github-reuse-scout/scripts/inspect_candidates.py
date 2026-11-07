#!/usr/bin/env python3
"""浅克隆评分前列的候选仓库并抽取架构证据。"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from pathlib import Path

MANIFEST_NAMES = [
    "package.json", "pyproject.toml", "requirements.txt", "go.mod",
    "Cargo.toml", "pom.xml", "build.gradle", "composer.json",
    "Gemfile", "mix.exs", "pubspec.yaml", "setup.py",
]
README_NAMES = ["README.md", "Readme.md", "README", "readme.md"]
ENTRYPOINTS = ["main.py", "app.py", "cli.py", "index.js", "main.go", "cmd/", "src/main.rs"]
README_HEAD_LINES = 60
MANIFEST_HEAD_LINES = 40
LICENSE_HEAD_LINES = 3


def clone(repo_dir: Path, html_url: str) -> str | None:
    """浅克隆到 repo_dir；已存在则直接复用，失败返回错误信息。"""
    if not re.fullmatch(r"https://github\.com/[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+", html_url or ""):
        return "只接受 HTTPS GitHub 仓库地址"
    if repo_dir.is_symlink():
        return "缓存目录不能是符号链接"
    if repo_dir.exists():
        return None
    try:
        proc = subprocess.run(
            ["git", "-c", "protocol.allow=never", "-c", "protocol.https.allow=always",
             "-c", "http.followRedirects=false", "clone", "--depth", "1", "--quiet",
             "--", html_url, str(repo_dir)],
            capture_output=True, text=True, timeout=30,
        )
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return "git 不可用或克隆超过 30 秒"
    if proc.returncode != 0:
        return proc.stderr.strip() or "git clone failed"
    return None


def head_lines(path: Path, limit: int) -> str:
    if path.is_symlink():
        return ""
    try:
        lines = path.read_text(encoding="utf-8", errors="replace").splitlines()
    except OSError:
        return ""
    return "\n".join(lines[:limit])


def extract(repo_dir: Path) -> dict:
    evidence: dict = {
        "readme_head": "",
        "manifests": {},
        "top_dirs": [],
        "license": "",
        "entrypoints": [],
    }
    for name in README_NAMES:
        path = repo_dir / name
        if path.is_file():
            evidence["readme_head"] = head_lines(path, README_HEAD_LINES)
            break
    for name in MANIFEST_NAMES:
        path = repo_dir / name
        if path.is_file():
            evidence["manifests"][name] = head_lines(path, MANIFEST_HEAD_LINES)
    try:
        entries = sorted(repo_dir.iterdir(), key=lambda p: p.name.lower())
        evidence["top_dirs"] = [p.name + "/" if p.is_dir() else p.name for p in entries]
    except OSError:
        pass
    license_path = repo_dir / "LICENSE"
    if license_path.is_file():
        evidence["license"] = head_lines(license_path, LICENSE_HEAD_LINES)
    for name in ENTRYPOINTS:
        if (repo_dir / name).exists():
            evidence["entrypoints"].append(name)
    return evidence


def main() -> int:
    parser = argparse.ArgumentParser(description="浅克隆评分前列的候选仓库并抽取架构证据。")
    parser.add_argument("--top", type=int, default=3, help="检查的仓库数量（默认 3）")
    parser.add_argument("--workdir", default=".", help="项目根目录（默认当前目录）")
    parser.add_argument("--repo", action="append", help="指定已评分的 owner/repo，可重复传入")
    args = parser.parse_args()
    if args.top < 1:
        parser.error("--top 必须大于 0")

    reuse_dir = Path(args.workdir) / ".reuse"
    scored_path = reuse_dir / "scored.json"
    if not scored_path.exists():
        print(f"未找到 {scored_path}，请先运行 score_candidates.py", file=sys.stderr)
        return 1
    data = json.loads(scored_path.read_text(encoding="utf-8"))

    cache_dir = reuse_dir / "cache"
    evidence_dir = reuse_dir / "evidence"
    cache_dir.mkdir(parents=True, exist_ok=True)
    evidence_dir.mkdir(parents=True, exist_ok=True)

    scored = data.get("scored", [])
    if args.repo:
        by_name = {item["full_name"]: item for item in scored}
        if any(name not in by_name for name in args.repo):
            parser.error("--repo 必须来自 scored.json")
        repos = [by_name[name] for name in dict.fromkeys(args.repo)]
    else:
        repos = scored[: args.top]
    if not repos:
        print("没有可检查的候选（scored.json 为空）")
        return 0

    for item in repos:
        if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_.-]*/[A-Za-z0-9][A-Za-z0-9_.-]*", item.get("full_name", "")):
            print("无效的 GitHub 仓库名", file=sys.stderr)
            return 1
        owner_repo = item["full_name"].replace("/", "-")
        repo_dir = cache_dir / owner_repo
        err = clone(repo_dir, item["html_url"])
        if err:
            evidence = {"clone_error": err}
            print(f"[克隆失败] {item['full_name']}: {err}")
        else:
            evidence = extract(repo_dir)
            print(f"[已检查] {item['full_name']} -> {evidence_dir / (owner_repo + '.json')}")
        out_path = evidence_dir / f"{owner_repo}.json"
        out_path.write_text(json.dumps(evidence, ensure_ascii=False, indent=2), encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
