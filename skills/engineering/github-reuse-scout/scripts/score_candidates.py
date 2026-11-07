#!/usr/bin/env python3
"""按确定性权重给候选仓库评分并排序。"""

from __future__ import annotations

import argparse
import json
import math
from datetime import datetime, timezone
from pathlib import Path

# 评分权重（数值即最终规格）
PERMISSIVE_LICENSES = {
    "Apache-2.0", "MIT", "BSD-3-Clause", "BSD-2-Clause", "ISC", "Mozilla-2.0",
}
LICENSE_SCORE = 3.0         # 宽松许可
NO_LICENSE_SCORE = -3.0     # 无 license
GPL_SCORE = -2.0            # GPL/AGPL 家族（传染性）
OTHER_LICENSE_SCORE = -1.0  # 其他许可
RECENCY_SCORE_6M = 4.0      # 近 6 个月有提交
RECENCY_SCORE_18M = 2.0     # 6-18 个月有提交
RECENCY_SCORE_OLD = 0.0     # 超过 18 个月未提交
SIZE_PENALTY_KB = 200_000   # 体积超过该值（KB）扣分
SIZE_PENALTY = -2.0
LANGUAGE_BONUS = 3.0        # 命中 --language 提示
ARCHIVED_EXCLUDE = True     # archived 仓库直接排除


def license_score(spdx: str | None) -> float:
    if not spdx:
        return NO_LICENSE_SCORE
    if spdx in PERMISSIVE_LICENSES:
        return LICENSE_SCORE
    if spdx.startswith("GPL") or spdx.startswith("AGPL"):
        return GPL_SCORE
    return OTHER_LICENSE_SCORE


def recency_score(pushed_at: str | None) -> float:
    if not pushed_at:
        return RECENCY_SCORE_OLD
    try:
        pushed = datetime.fromisoformat(pushed_at.replace("Z", "+00:00"))
    except ValueError:
        return RECENCY_SCORE_OLD
    months = (datetime.now(timezone.utc) - pushed).days / 30.44
    if months <= 6:
        return RECENCY_SCORE_6M
    if months <= 18:
        return RECENCY_SCORE_18M
    return RECENCY_SCORE_OLD


def stars_score(stars: int | None) -> float:
    return min(4.0, math.log10((stars or 0) + 1) * 1.2)


def main() -> int:
    parser = argparse.ArgumentParser(description="按确定性权重给候选仓库评分并排序。")
    parser.add_argument("--workdir", default=".", help="项目根目录（默认当前目录）")
    parser.add_argument("--language", default=None, help="用户技术栈提示，命中加分")
    args = parser.parse_args()

    reuse_dir = Path(args.workdir) / ".reuse"
    cand_path = reuse_dir / "candidates.json"
    if not cand_path.exists():
        print(f"未找到 {cand_path}，请先运行 search_candidates.py", file=sys.stderr)
        return 1
    data = json.loads(cand_path.read_text(encoding="utf-8"))

    scored: list[dict] = []
    excluded: list[str] = []
    for item in data.get("merged", []):
        if item.get("archived") and ARCHIVED_EXCLUDE:
            excluded.append(item["full_name"])
            continue
        breakdown = {
            "archived": 0.0,
            "license": license_score(item.get("license")),
            "recency": recency_score(item.get("pushed_at")),
            "stars": round(stars_score(item.get("stargazers_count")), 2),
            "size": SIZE_PENALTY if (item.get("size") or 0) > SIZE_PENALTY_KB else 0.0,
            "language": (
                LANGUAGE_BONUS
                if args.language
                and item.get("language")
                and item["language"].lower() == args.language.lower()
                else 0.0
            ),
        }
        scored.append({
            "full_name": item["full_name"],
            "score": round(sum(breakdown.values()), 2),
            "breakdown": breakdown,
            "description": item.get("description"),
            "language": item.get("language"),
            "html_url": item.get("html_url"),
        })
    scored.sort(key=lambda it: it["score"], reverse=True)

    out_path = reuse_dir / "scored.json"
    out_path.write_text(
        json.dumps({"scored": scored, "excluded": excluded}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(f"评分 {len(scored)} 个（排除 archived {len(excluded)} 个）-> {out_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
