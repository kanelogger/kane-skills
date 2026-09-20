#!/usr/bin/env bash
set -euo pipefail

skill_root="$(cd "$(dirname "$0")/../.." && pwd)"
report="shopping-report/index.html"

python3 "$skill_root/scripts/validate_report.py" shopping-report
grep -q "小米巨能写" "$report"
grep -Eq "低频|偶尔书写|办公室" "$report"
grep -Eq "高频|备考|长时间书写" "$report"
grep -Eq "握持|防滑|人体工学" "$report"
grep -Eq "顺滑|书写手感" "$report"
