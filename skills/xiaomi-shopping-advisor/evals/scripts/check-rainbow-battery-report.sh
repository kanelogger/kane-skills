#!/usr/bin/env bash
set -euo pipefail

report="shopping-report/index.html"

python3 - <<'PY'
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlparse
import re
import sys

root = Path("shopping-report").resolve()
report = root / "index.html"
failures = []

class Parser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.ids, self.images, self.links, self.remote = set(), [], [], []
        self.cards = 0
        self.viewport = self.title = self.time = self.table = False
        self.in_title = False
    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        classes = set((a.get("class") or "").split())
        if a.get("id"): self.ids.add(a["id"])
        if "product-card" in classes: self.cards += 1
        if tag == "meta" and (a.get("name") or "").lower() == "viewport": self.viewport = True
        if tag == "title": self.in_title = True
        if tag == "time" and a.get("datetime"): self.time = True
        if tag == "table" and "comparison-table" in classes: self.table = True
        if tag == "img": self.images.append((a.get("src") or "", a.get("alt") or ""))
        if tag == "a" and urlparse(a.get("href") or "").scheme in {"http", "https"}: self.links.append(a["href"])
        if tag == "script" and a.get("src"): self.remote.append(a["src"])
        if tag == "link" and "stylesheet" in (a.get("rel") or "").lower(): self.remote.append(a.get("href") or "")
    def handle_endtag(self, tag):
        if tag == "title": self.in_title = False
    def handle_data(self, data):
        if self.in_title and data.strip(): self.title = True

if not report.is_file():
    sys.exit("missing shopping-report/index.html")
html = report.read_text(encoding="utf-8")
p = Parser(); p.feed(html); p.close()
required = {"summary", "products", "comparison", "price-audit", "scenarios", "evidence"}
if required - p.ids: failures.append("missing sections: " + ", ".join(sorted(required - p.ids)))
if not all((p.viewport, p.title, p.time, p.table)): failures.append("missing viewport, title, time, or comparison table")
if p.cards < 3 or len(p.links) < 3: failures.append("need at least 3 product cards and source links")
for src, alt in p.images:
    parsed = urlparse(src)
    path = (root / parsed.path).resolve()
    if not alt.strip() or parsed.scheme or src.startswith(("//", "data:")): failures.append(f"invalid image reference: {src}")
    elif root not in path.parents or path.suffix.lower() not in {".avif", ".jpeg", ".jpg", ".png", ".webp"} or not path.is_file() or path.stat().st_size == 0: failures.append(f"missing or invalid local image: {src}")
if any(urlparse(value).scheme in {"http", "https"} or value.startswith("//") for value in p.remote): failures.append("remote CSS/JavaScript dependency")
if re.search(r"\{\{[^{}]+\}\}", html): failures.append("unresolved template placeholder")
if failures:
    raise SystemExit("\n".join(failures))
print("core shopping report checks passed")
PY
grep -q "小米彩虹电池" "$report"
grep -Eq "5号|AA" "$report"
grep -Eq "每节|单节|每颗" "$report"
grep -Eq "碱性" "$report"
grep -Eq "漏液|防漏|保质期" "$report"
grep -Eq "四驱车|单次实测|待核实|不能代表" "$report"
