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
    if not isinstance(payload, dict):
        print("[解析失败] GitHub 返回的不是 JSON 对象", file=sys.stderr)
        return None
    if "items" not in payload:
        message = str(payload.get("message", raw[:200]))
        if "rate limit" in message.lower():
            print("[限流] GitHub 搜索 API 触发速率限制，请稍后重试或检查配额", file=sys.stderr)
        else:
            print(f"[接口异常] {message}", file=sys.stderr)
        return None
    items = payload["items"]
    if not isinstance(items, list) or not all(isinstance(item, dict) for item in items):
        print("[解析失败] GitHub items 格式错误", file=sys.stderr)
        return None
    return [_keep(item) for item in items]


def fetch_with_curl(query: str, top: int) -> list[dict] | None:
    url = (
        "https://api.github.com/search/repositories"
        f"?q={quote(query, safe='')}&per_page={top}&sort=stars&order=desc"
    )
    token = os.environ.get("GITHUB_TOKEN") or os.environ.get("GH_TOKEN")
    if not token:
        try:
            auth = subprocess.run(
                ["gh", "auth", "token", "--hostname", "github.com"],
                capture_output=True, text=True, timeout=5,
            )
            if auth.returncode == 0:
                token = auth.stdout.strip()
        except (FileNotFoundError, subprocess.TimeoutExpired):
            pass
    cmd = [
        "curl", "--silent", "--show-error", "--fail", "--location",
        "--proto", "=https", "--proto-redir", "=https", "--max-redirs", "5",
        "--connect-timeout", "10", "--max-time", "30",
        "--header", "Accept: application/vnd.github+json",
        "--write-out", "\n%{content_type}",
    ]
    if token:
        cmd += ["--header", f"Authorization: Bearer {token}"]
    cmd += [url]
    try:
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=31)
    except (FileNotFoundError, subprocess.TimeoutExpired):
        print("[下载失败] curl 不可用或请求超时", file=sys.stderr)
        return None
    if proc.returncode != 0:
        print(f"[curl 调用失败] {proc.stderr.strip()}", file=sys.stderr)
        return None
    body, sep, content_type = proc.stdout.rpartition("\n")
    mime = content_type.split(";", 1)[0].strip().lower()
    if not sep or mime not in {"application/json", "application/vnd.github+json"}:
        print("[下载失败] GitHub 返回了非预期内容类型", file=sys.stderr)
        return None
    return _parse_items(body)


def main() -> int:
    parser = argparse.ArgumentParser(description="搜索 GitHub 候选仓库并缓存搜索结果。")
    parser.add_argument("--query", required=True, help="GitHub 搜索查询串")
    parser.add_argument("--top", type=int, default=15, help="每查询取回数量（默认 15）")
    parser.add_argument("--workdir", default=".", help="项目根目录（默认当前目录）")
    parser.add_argument("--sleep", type=float, default=2.5, help="每次 API 调用前等待秒数（默认 2.5）")
    args = parser.parse_args()
    if not 1 <= args.top <= 100 or args.sleep < 0:
        parser.error("--top 必须在 1-100 之间，--sleep 不得为负数")

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
        items = fetch_with_curl(args.query, args.top)
        if items is None:
            print("安全下载失败，无法搜索。可改用 web 搜索或检查 curl 与凭据。", file=sys.stderr)
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
