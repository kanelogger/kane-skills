#!/usr/bin/env bash
set -euo pipefail

skill_root="$(cd "$(dirname "$0")/../.." && pwd)"
report="shopping-report/index.html"

python3 "$skill_root/scripts/validate_report.py" shopping-report
grep -q "小米彩虹电池" "$report"
grep -Eq "5号|AA" "$report"
grep -Eq "每节|单节|每颗" "$report"
grep -Eq "碱性" "$report"
grep -Eq "漏液|防漏|保质期" "$report"
grep -Eq "四驱车|单次实测|待核实|不能代表" "$report"
