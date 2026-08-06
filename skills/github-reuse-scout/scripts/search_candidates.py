#!/usr/bin/env python3
"""搜索 GitHub 候选仓库并缓存搜索结果。"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import quote

KEEP_FIELDS = (
    "full_name",
    "html_url",
    "description",
    "language",
    "stargazers_count",
    "forks_count",
    "pushed_at",
    "archived",
    "size",
    "topics",
)


def _keep(raw: dict) -> dict:
    item = {k: raw.get(k) for k in KEEP_FIELDS}
    lic = raw.get("license")
    item["license"] = lic.get("spdx_id") if isinstance(lic, dict) else None
    return item


def _parse_items(raw: str) -> list[dict] | None:
    try:
        payload = json.loads(raw)
    except json.JSONDecodeError:
        print("[解析失败] GitHub 返回的不是合法 JSON", file=sys.stderr)
        return None
    if "items" not in payload:
        message = str(payload.get("message", raw[:200]))
        if "rate limit" in message.lower():
            print("[限流] GitHub 搜索 API 触发速率限制，请稍后重试或检查配额", file=sys.stderr)
        else:
            print(f"[接口异常] {message}", file=sys.stderr)
        return None
    return [_keep(item) for item in payload["items"]]


def fetch_with_gh(query: str, top: int) -> list[dict] | None:
    """用 gh api 调用 GitHub 搜索接口；gh 不可用或调用失败时返回 None。"""
    cmd = [
        "gh", "api", "-X", "GET", "search/repositories",
        "-f", f"q={query}",
        "-f", f"per_page={top}",
        "-f", "sort=stars",
        "-f", "order=desc",
    ]
    try:
        proc = subprocess.run(cmd, capture_output=True, text=True)
    except FileNotFoundError:
        return None
    if proc.returncode != 0:
        stderr = proc.stderr.strip()
        if "403" in stderr:
            print("[限流] GitHub 搜索 API 触发速率限制，请稍后重试或检查配额", file=sys.stderr)
        else:
            print(f"[gh 调用失败] {stderr}", file=sys.stderr)
        return None
    return _parse_items(proc.stdout)


def fetch_with_curl(query: str, top: int) -> list[dict] | None:
    """curl 兜底：带 GITHUB_TOKEN（如有）或匿名访问；失败时返回 None。"""
    url = (
        "https://api.github.com/search/repositories"
        f"?q={quote(query)}&per_page={top}&sort=stars&order=desc"
    )
    cmd = ["curl", "-s", url]
    token = os.environ.get("GITHUB_TOKEN")
    if token:
        cmd += ["-H", f"Authorization: Bearer {token}"]
    try:
        proc = subprocess.run(cmd, capture_output=True, text=True)
    except FileNotFoundError:
        return None
    if proc.returncode != 0:
        print(f"[curl 调用失败] {proc.stderr.strip()}", file=sys.stderr)
        return None
    return _parse_items(proc.stdout)


def main() -> int:
    parser = argparse.ArgumentParser(description="搜索 GitHub 候选仓库并缓存搜索结果。")
    parser.add_argument("--query", required=True, help="GitHub 搜索查询串")
    parser.add_argument("--top", type=int, default=15, help="每查询取回数量（默认 15）")
    parser.add_argument("--workdir", default=".", help="项目根目录（默认当前目录）")
    parser.add_argument("--sleep", type=float, default=2.5, help="每次 API 调用前等待秒数（默认 2.5）")
    args = parser.parse_args()

    reuse_dir = Path(args.workdir) / ".reuse"
    reuse_dir.mkdir(parents=True, exist_ok=True)
    cache_path = reuse_dir / "search-cache.json"
    cache: dict = {}
    if cache_path.exists():
        cache = json.loads(cache_path.read_text(encoding="utf-8"))

    if args.query in cache:
        print("cache hit，跳过 GitHub API 调用")
    else:
        time.sleep(args.sleep)
        items = fetch_with_gh(args.query, args.top)
        if items is None:
            items = fetch_with_curl(args.query, args.top)
        if items is None:
            print("gh 与 curl 均不可用或调用失败，无法搜索。可改用 web 搜索或检查凭据。", file=sys.stderr)
            return 1
        cache[args.query] = {
            "fetched_at": datetime.now(timezone.utc).isoformat(),
            "items": items,
        }
        cache_path.write_text(json.dumps(cache, ensure_ascii=False, indent=2), encoding="utf-8")

    merged: dict[str, dict] = {}
    for entry in cache.values():
        for item in entry.get("items", []):
            merged[item["full_name"]] = item
    candidates = {
        "queries": cache,
        "merged": sorted(merged.values(), key=lambda it: it.get("stargazers_count") or 0, reverse=True),
    }
    out_path = reuse_dir / "candidates.json"
    out_path.write_text(json.dumps(candidates, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"候选 {len(candidates['merged'])} 个 -> {out_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
