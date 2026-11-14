#!/usr/bin/env python3
"""kane-migrate-to-rust 技能的遥测与管理层信息图生成器。

跟踪各迁移任务计时分组的真实实际耗时，自动执行迁移前后的代码概况统计
（代码行数、模块化程度、注释／文档密度、认知复杂度、遗留代码内存隐患与
Rust unsafe 块），记录测试／一致性验证的自动修复迭代和阶梯式 PGO 基准测试，
根据实测值计算 8 个维度的管理层评分卡，并通过
references/infographic_template.html 渲染自包含的 HTML 信息图。
"""

import argparse
import datetime
import json
import os
from pathlib import Path
import re
import sys
import time

BUCKET_META = {
    "discovery": ("探索与基线采集", "bg-sky-400"),
    "blueprint": ("深入审计与六部分架构蓝图", "bg-indigo-400"),
    "rewrite": ("安全 Rust 重写与模块化", "bg-emerald-400"),
    "test_heal": ("测试生成与自动修复循环", "bg-amber-400"),
    "parity": ("A/B 差分一致性验证", "bg-cyan-400"),
    "pgo_bench": ("PGO 性能剖析与 Criterion 基准测试", "bg-violet-400"),
}

STAGE_LABELS = {
    "legacy_baseline": "1. 遗留基线二进制程序",
    "safe_rust": "2. 初始安全 Rust 移植（符合惯用写法）",
    "soa_simd": "3. 数组结构（SoA）与零分配调优",
    "pgo_lto": "4. 基于性能剖析的优化（PGO）+ 完整链接时优化",
}

LEGACY_EXTS = {
    ".c",
    ".cc",
    ".cpp",
    ".cxx",
    ".h",
    ".hh",
    ".hpp",
    ".f",
    ".f90",
    ".f95",
    ".for",
    ".py",
    ".java",
    ".sh",
    ".bash",
    ".r",
}
RUST_EXTS = {".rs"}


class TelemetryError(Exception):
  """遥测输入或文件无效时抛出的错误，提供可操作的处理信息。"""


def grade_from_score(score: int | None) -> str:
  if score is None:
    return "N/A"
  if score >= 95:
    return "A+"
  if score >= 90:
    return "A"
  if score >= 85:
    return "A-"
  if score >= 80:
    return "B+"
  if score >= 75:
    return "B"
  if score >= 65:
    return "C"
  if score >= 50:
    return "D"
  return "F"


def clamp_score(val: float, low: int = 0, high: int = 100) -> int:
  return max(low, min(high, int(round(val))))


def load_telemetry(path: Path) -> dict:
  if not path.exists():
    raise TelemetryError(
        f"未找到遥测文件：'{path}'。请先运行 'telemetry.py init"
        f" --telemetry {path} --project-name <name> --legacy-lang <lang>'"
        "。"
    )
  try:
    with path.open("r", encoding="utf-8") as f:
      data = json.load(f)
  except json.JSONDecodeError as exc:
    raise TelemetryError(
        f"遥测文件 '{path}' 的 JSON 格式有误：{exc}。请使用"
        " 'telemetry.py init' 重新初始化，或修正 JSON 语法。"
    ) from exc
  except OSError as exc:
    raise TelemetryError(
        f"无法读取遥测文件 '{path}'：{exc}"
    ) from exc
  if not isinstance(data, dict):
    raise TelemetryError(
        f"遥测文件 '{path}' 必须包含顶层 JSON 对象。"
    )
  return data


def save_telemetry(path: Path, data: dict) -> None:
  try:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as f:
      json.dump(data, f, indent=2)
  except OSError as exc:
    raise TelemetryError(
        f"无法写入遥测文件 '{path}'：{exc}"
    ) from exc


def resolve_effective_model(
    cli_model: str | None, existing_model: str | None
) -> str | None:
  """从 CLI 参数、已有遥测数据或环境变量中解析当前使用的模型名称。"""
  for candidate in (
      cli_model,
      existing_model,
      os.environ.get("MIGRATE_TO_RUST_MODEL"),
  ):
    if candidate and candidate.strip():
      cleaned = candidate.strip()
      if cleaned.lower() not in {"none", "unspecified", "unknown"}:
        return cleaned
  return None


def close_active_bucket(data: dict, now: float) -> None:
  active = data.get("_active_bucket")
  if isinstance(active, dict) and active.get("name"):
    bname = active["name"]
    elapsed_sec = max(0.0, now - float(active.get("started_at", now)))
    buckets = data.setdefault("_bucket_seconds", {})
    buckets[bname] = buckets.get(bname, 0.0) + elapsed_sec
    data["_active_bucket"] = None


def cmd_init(args: argparse.Namespace) -> None:
  out_path = Path(args.telemetry)
  now = time.time()
  user = getattr(args, "user", None) or os.environ.get("USER", "developer")
  model = resolve_effective_model(getattr(args, "model", None), None)
  data = {
      "project_name": args.project_name,
      "legacy_language": args.legacy_lang,
      "user": user,
      "model": model,
      "source_url": getattr(args, "source_url", None) or "",
      "scope_summary": getattr(args, "scope_summary", None) or "",
      "started_at_epoch": now,
      "completed_at": None,
      "_active_bucket": None,
      "_bucket_seconds": {k: 0.0 for k in BUCKET_META},
      "story": {
          "headline": "",
          "intro": "",
          "ch1_narrative": "",
          "ch2_narrative": "",
          "ch3_narrative": "",
          "ch4_narrative": "",
          "ch5_narrative": "",
      },
      "census": {
          "before": {
              "scanned": False,
              "files": 0,
              "code_loc": 0,
              "comment_loc": 0,
              "comment_pct": None,
              "max_file_loc": 0,
              "avg_file_loc": 0,
              "files_under_400_pct": None,
              "doc_tests": 0,
              "max_nesting_depth": None,
              "avg_fn_loc": None,
              "hazards_count": None,
              "latent_bugs_found": None,
          },
          "after": {
              "scanned": False,
              "files": 0,
              "code_loc": 0,
              "comment_loc": 0,
              "comment_pct": None,
              "max_file_loc": 0,
              "avg_file_loc": 0,
              "files_under_400_pct": None,
              "doc_tests": 0,
              "max_nesting_depth": None,
              "avg_fn_loc": None,
              "unsafe_blocks": None,
              "forbid_unsafe": False,
              "branch_coverage_pct": None,
              "clippy_warnings": None,
          },
      },
      "opportunities": [],
      "test_iterations": [],
      "parity_iterations": [],
      "benchmarks": [],
      "time_buckets": [],
      "scorecard": [],
      "roi": {},
      "spotlight": {
          "explanation": "",
          "legacy_file": "",
          "legacy_code": "",
          "rust_file": "",
          "rust_code": "",
      },
  }
  save_telemetry(out_path, data)
  print(
      f"[telemetry] 已初始化 {out_path}，用于 '{args.project_name}'"
      f" ({args.legacy_lang})."
  )


def cmd_start_bucket(args: argparse.Namespace) -> None:
  path = Path(args.telemetry)
  data = load_telemetry(path)
  now = time.time()
  close_active_bucket(data, now)
  data["_active_bucket"] = {"name": args.bucket, "started_at": now}
  save_telemetry(path, data)
  print(f"[telemetry] 已启动任务计时分组 '{args.bucket}' 的计时器。")


def cmd_end_bucket(args: argparse.Namespace) -> None:
  path = Path(args.telemetry)
  data = load_telemetry(path)
  now = time.time()
  close_active_bucket(data, now)
  if args.minutes is not None:
    data.setdefault("_bucket_seconds", {})[args.bucket] = (
        float(args.minutes) * 60.0
    )
  save_telemetry(path, data)
  print(f"[telemetry] 已结束任务计时分组 '{args.bucket}' 的计时器。")


def analyze_directory(root_dir: Path, is_rust: bool) -> dict:
  if not root_dir.exists():
    raise TelemetryError(
        f"待扫描目录不存在：'{root_dir}'。请向"
        " 'scan-codebase --dir' 传入有效的源代码目录。"
    )
  exts = RUST_EXTS if is_rust else LEGACY_EXTS
  skip_dirs = {
      ".git",
      "target",
      "build",
      "node_modules",
      ".venv",
      "__pycache__",
  }

  files_loc = []
  total_code = 0
  total_comments = 0
  doc_tests = 0
  max_nesting = 0
  fn_count = 0
  hazards = 0
  unsafe_blocks = 0
  forbid_unsafe = False

  fn_pattern_rust = re.compile(
      r"^\s*(?:pub(?:\([^)]*\))?\s+)?(?:const\s+|async\s+)?fn\s+\w+"
  )
  fn_pattern_legacy = re.compile(
      r"^\s*(?:[\w:<>~*&\s]+)\s+\w+\s*\([^;]*\)\s*(?:const)?\s*\{|"
      r"^\s*def\s+\w+\s*\(|"
      r"^\s*(?:subroutine|function)\s+\w+",
      re.IGNORECASE,
  )
  hazard_pattern = re.compile(
      r"\b(?:malloc|calloc|realloc|free|new|delete|memcpy|memset|goto|COMMON|EQUIVALENCE)\b|"
      r"\*\s*\w+\s*=|->\w+|\bstatic\s+(?!const\b)\w+",
  )
  unsafe_pattern = re.compile(r"\bunsafe\s*(?:\{|fn\b|impl\b|trait\b)")

  for dirpath, dirnames, filenames in os.walk(root_dir):
    dirnames[:] = [d for d in dirnames if d not in skip_dirs]
    for fname in filenames:
      fpath = Path(dirpath) / fname
      if fpath.suffix.lower() not in exts:
        continue
      try:
        lines = fpath.read_text(encoding="utf-8", errors="ignore").splitlines()
      except OSError:
        continue

      file_code = 0
      file_comment = 0
      in_block_comment = False
      in_doctest = False
      brace_depth = 0

      for line in lines:
        stripped = line.strip()
        if not stripped:
          continue

        if is_rust and "#![forbid(unsafe_code)]" in stripped:
          forbid_unsafe = True

        # 处理块注释
        if in_block_comment:
          file_comment += 1
          if "*/" in stripped:
            in_block_comment = False
          continue

        if stripped.startswith("/*"):
          file_comment += 1
          if "*/" not in stripped[2:]:
            in_block_comment = True
          continue

        if is_rust:
          if stripped.startswith("///") or stripped.startswith("//!"):
            file_comment += 1
            if "```" in stripped:
              if not in_doctest:
                doc_tests += 1
                in_doctest = True
              else:
                in_doctest = False
            continue
          if stripped.startswith("//"):
            file_comment += 1
            continue
        else:
          if (
              stripped.startswith("//")
              or stripped.startswith("#")
              or (
                  fpath.suffix.lower() in {".f", ".f90", ".f95", ".for"}
                  and stripped.startswith("!")
              )
          ):
            file_comment += 1
            continue

        # 统计代码行
        file_code += 1
        if "//" in stripped:
          file_comment += 1

        # 估算嵌套深度
        if fpath.suffix.lower() == ".py":
          indent = len(line) - len(line.lstrip(" "))
          depth = indent // 4
          max_nesting = max(max_nesting, depth)
        else:
          brace_depth += stripped.count("{") - stripped.count("}")
          brace_depth = max(0, brace_depth)
          max_nesting = max(max_nesting, brace_depth)

        if is_rust:
          if fn_pattern_rust.match(line):
            fn_count += 1
          if unsafe_pattern.search(stripped):
            unsafe_blocks += 1
        else:
          if fn_pattern_legacy.match(line):
            fn_count += 1
          hazards += len(hazard_pattern.findall(stripped))

      file_total_loc = file_code + file_comment
      if file_total_loc > 0:
        files_loc.append(file_total_loc)
        total_code += file_code
        total_comments += file_comment

  num_files = len(files_loc)
  max_loc = max(files_loc) if files_loc else 0
  avg_loc = int(round(sum(files_loc) / num_files)) if num_files else 0
  under_400 = (
      round((sum(1 for x in files_loc if x <= 400) / num_files) * 100.0, 1)
      if num_files
      else None
  )
  comment_pct = (
      round((total_comments / max(1, total_code)) * 100.0, 1)
      if total_code > 0
      else None
  )
  avg_fn_loc = (
      int(round(total_code / max(1, fn_count))) if total_code > 0 else None
  )
  measured_nesting = (
      max(1, min(max_nesting, 12 if is_rust else 15)) if num_files > 0 else None
  )

  if is_rust:
    return {
        "scanned": num_files > 0,
        "files": num_files,
        "code_loc": total_code,
        "comment_loc": total_comments,
        "comment_pct": comment_pct,
        "max_file_loc": max_loc,
        "avg_file_loc": avg_loc,
        "files_under_400_pct": under_400,
        "doc_tests": doc_tests,
        "max_nesting_depth": measured_nesting,
        "avg_fn_loc": avg_fn_loc,
        "unsafe_blocks": unsafe_blocks if num_files > 0 else None,
        "forbid_unsafe": forbid_unsafe,
    }
  return {
      "scanned": num_files > 0,
      "files": num_files,
      "code_loc": total_code,
      "comment_loc": total_comments,
      "comment_pct": comment_pct,
      "max_file_loc": max_loc,
      "avg_file_loc": avg_loc,
      "files_under_400_pct": under_400,
      "doc_tests": 0,
      "max_nesting_depth": measured_nesting,
      "avg_fn_loc": avg_fn_loc,
      "hazards_count": hazards if num_files > 0 else None,
  }


def cmd_scan_codebase(args: argparse.Namespace) -> None:
  path = Path(args.telemetry)
  data = load_telemetry(path)
  target_dir = Path(args.dir)
  is_rust = args.phase == "after"
  stats = analyze_directory(target_dir, is_rust=is_rust)

  census = data.setdefault("census", {})
  before_c = census.setdefault("before", {})
  after_c = census.setdefault("after", {})

  if is_rust:
    if args.coverage_pct is not None:
      stats["branch_coverage_pct"] = round(float(args.coverage_pct), 1)
    else:
      stats["branch_coverage_pct"] = after_c.get("branch_coverage_pct")
    if args.clippy_warnings is not None:
      stats["clippy_warnings"] = int(args.clippy_warnings)
    else:
      stats["clippy_warnings"] = after_c.get("clippy_warnings")
    after_c.update(stats)
  else:
    existing_latent = before_c.get("latent_bugs_found")
    if existing_latent is None:
      existing_latent = sum(
          1
          for o in data.get("opportunities", [])
          if o.get("category") == "latent_bug"
      )
    stats["latent_bugs_found"] = existing_latent
    before_c.update(stats)

  save_telemetry(path, data)
  print(
      f"[telemetry] 已扫描 '{args.phase}' 阶段的代码库，位置为 {target_dir}："
      f" {json.dumps(stats)}"
  )


def cmd_log_opportunity(args: argparse.Namespace) -> None:
  path = Path(args.telemetry)
  data = load_telemetry(path)
  entry = {
      "category": args.category,
      "title": args.title,
      "file": args.file or "",
      "description": args.description,
  }
  data.setdefault("opportunities", []).append(entry)
  if args.category == "latent_bug":
    latent = sum(
        1 for o in data["opportunities"] if o.get("category") == "latent_bug"
    )
    data.setdefault("census", {}).setdefault("before", {})[
        "latent_bugs_found"
    ] = latent
  save_telemetry(path, data)
  print(f"[telemetry] 已记录 {args.category}：{args.title}")


def cmd_log_test_run(args: argparse.Namespace) -> None:
  path = Path(args.telemetry)
  data = load_telemetry(path)
  cov_val = (
      round(float(args.coverage_pct), 1)
      if args.coverage_pct is not None
      else None
  )
  clippy_val = (
      int(args.clippy_warnings) if args.clippy_warnings is not None else None
  )
  entry = {
      "iteration": args.iteration,
      "total": args.total,
      "passed": args.passed,
      "failed": args.failed,
      "coverage_pct": cov_val,
      "clippy_warnings": clippy_val,
      "failures_summary": args.failures_summary,
      "fix_applied": args.fix_applied,
  }
  runs = data.setdefault("test_iterations", [])
  runs = [r for r in runs if r.get("iteration") != args.iteration]
  runs.append(entry)
  runs.sort(key=lambda r: r["iteration"])
  data["test_iterations"] = runs
  after_c = data.setdefault("census", {}).setdefault("after", {})
  if cov_val is not None:
    after_c["branch_coverage_pct"] = cov_val
  if clippy_val is not None:
    after_c["clippy_warnings"] = clippy_val
  save_telemetry(path, data)
  print(
      f"[telemetry] 已记录第 {args.iteration} 次测试迭代："
      f" {args.passed}/{args.total} 通过。"
  )


def cmd_log_parity_run(args: argparse.Namespace) -> None:
  path = Path(args.telemetry)
  data = load_telemetry(path)
  entry = {
      "iteration": args.iteration,
      "seeds_tested": args.seeds_tested,
      "seeds_passed": args.seeds_passed,
      "max_abs_error": args.max_abs_error,
      "divergence_cause": args.divergence_cause,
      "fix_applied": args.fix_applied,
  }
  runs = data.setdefault("parity_iterations", [])
  runs = [r for r in runs if r.get("iteration") != args.iteration]
  runs.append(entry)
  runs.sort(key=lambda r: r["iteration"])
  data["parity_iterations"] = runs
  save_telemetry(path, data)
  print(
      f"[telemetry] 已记录第 {args.iteration} 次一致性验证迭代："
      f" {args.seeds_passed}/{args.seeds_tested} 个种子的结果一致。"
  )


def cmd_log_benchmark(args: argparse.Namespace) -> None:
  path = Path(args.telemetry)
  data = load_telemetry(path)
  benches = data.setdefault("benchmarks", [])
  benches = [b for b in benches if b.get("stage") != args.stage]

  base_ms = float(args.wall_time_ms)
  for b in benches:
    if b.get("stage") == "legacy_baseline":
      base_ms = float(b["wall_time_ms"])
      break

  entry = {
      "stage": args.stage,
      "label": args.label or STAGE_LABELS.get(args.stage, args.stage),
      "wall_time_ms": round(float(args.wall_time_ms), 2),
      "peak_rss_mb": round(float(args.peak_rss_mb), 2),
      "speedup": round(base_ms / max(0.001, float(args.wall_time_ms)), 2),
      "notes": args.notes or "",
  }
  benches.append(entry)
  stage_order = ["legacy_baseline", "safe_rust", "soa_simd", "pgo_lto"]
  benches.sort(
      key=lambda b: stage_order.index(b["stage"])
      if b["stage"] in stage_order
      else 99
  )

  # 相对于首个基准测试重新计算加速比
  if benches:
    first_ms = max(0.001, float(benches[0]["wall_time_ms"]))
    for b in benches:
      b["speedup"] = round(first_ms / max(0.001, float(b["wall_time_ms"])), 2)

  data["benchmarks"] = benches
  save_telemetry(path, data)
  print(
      f"[telemetry] 已记录基准测试 '{args.stage}'：{entry['wall_time_ms']} ms"
      f" ({entry['speedup']}x)."
  )


def cmd_log_spotlight(args: argparse.Namespace) -> None:
  path = Path(args.telemetry)
  data = load_telemetry(path)
  legacy_code = args.legacy_code or ""
  if args.legacy_code_file:
    lpath = Path(args.legacy_code_file)
    if not lpath.exists():
      raise TelemetryError(f"未找到代码对比中的遗留代码文件：'{lpath}'")
    legacy_code = lpath.read_text(encoding="utf-8", errors="ignore")
  rust_code = args.rust_code or ""
  if args.rust_code_file:
    rpath = Path(args.rust_code_file)
    if not rpath.exists():
      raise TelemetryError(f"未找到代码对比中的 Rust 代码文件：'{rpath}'")
    rust_code = rpath.read_text(encoding="utf-8", errors="ignore")

  data["spotlight"] = {
      "explanation": args.explanation,
      "legacy_file": args.legacy_file,
      "legacy_code": legacy_code,
      "rust_file": args.rust_file,
      "rust_code": rust_code,
  }
  save_telemetry(path, data)
  print("[telemetry] 已更新迁移前后的重点代码对比。")


def cmd_set_story(args: argparse.Namespace) -> None:
  path = Path(args.telemetry)
  data = load_telemetry(path)
  story = data.setdefault("story", {})
  for field in [
      "headline",
      "intro",
      "ch1_narrative",
      "ch2_narrative",
      "ch3_narrative",
      "ch4_narrative",
      "ch5_narrative",
  ]:
    val = getattr(args, field, None)
    if val:
      story[field] = val
  save_telemetry(path, data)
  print("[telemetry] 已更新 AI 第一人称叙述章节。")


def compute_derived_metrics(data: dict) -> None:
  now = time.time()
  close_active_bucket(data, now)
  after_scanned = bool(
      ((data.get("census") or {}).get("after") or {}).get("scanned")
  )
  if after_scanned:
    data["completed_at"] = datetime.datetime.now(
        datetime.timezone.utc
    ).strftime("%Y-%m-%d %H:%M UTC")
  else:
    data.setdefault("completed_at", None)

  # 1. 任务计时分组（实测实际耗时；未执行的分组记为 0 分钟）
  sec_map = data.get("_bucket_seconds", {})
  time_buckets = []
  total_minutes = 0
  active_buckets_count = 0
  for bkey, (blabel, bcolor) in BUCKET_META.items():
    secs = float(sec_map.get(bkey, 0.0))
    if secs > 0.0:
      mins = max(1, int(round(secs / 60.0)))
      active_buckets_count += 1
    else:
      mins = 0
    total_minutes += mins
    time_buckets.append({
        "bucket": bkey,
        "label": blabel,
        "minutes": mins,
        "color": bcolor,
    })
  data["time_buckets"] = time_buckets

  # 2. 实测智能体执行时间（不套用人为估算的人工工时倍数）
  total_ai_hours = round(total_minutes / 60.0, 2)
  data["roi"] = {
      "total_ai_minutes": total_minutes,
      "total_ai_hours": total_ai_hours,
      "active_buckets_count": active_buckets_count,
  }

  # 3. 严格根据实测值计算评分卡的 8 个维度
  census = data.get("census") or {}
  before_c = census.get("before") or {}
  after_c = census.get("after") or {}

  benches = data.get("benchmarks") or []
  has_benches = len(benches) >= 2
  if has_benches:
    base_b = benches[0]
    final_b = benches[-1]
    base_ms = max(0.001, float(base_b.get("wall_time_ms", 0.0)))
    final_ms = max(0.001, float(final_b.get("wall_time_ms", 0.0)))
    speedup = round(base_ms / final_ms, 2)
    speed_before_score = clamp_score(100.0 / max(1.0, speedup), 0, 100)
    speed_after_score = clamp_score(
        60.0 * speedup
        if speedup < 1.0
        else 60.0 + min(40.0, (speedup - 1.0) * 15.0),
        0,
        100,
    )
    speed_before_label = f"{base_b['wall_time_ms']} ms (1.0x)"
    speed_after_label = f"{final_b['wall_time_ms']} ms ({speedup:.2f}x)"
    speed_delta = (
        f"加速比 {speedup:.2f}x" if speedup >= 1.0 else f"加速比 {speedup:.2f}x"
    )

    rss_before = max(0.001, float(base_b.get("peak_rss_mb", 0.0)))
    rss_after = max(0.001, float(final_b.get("peak_rss_mb", 0.0)))
    rss_drop_pct = round((1.0 - rss_after / rss_before) * 100.0, 1)
    mem_before_score = clamp_score(100.0 - max(0.0, rss_drop_pct), 0, 100)
    mem_after_score = clamp_score(70.0 + rss_drop_pct * 0.3, 0, 100)
    mem_before_label = f"{base_b['peak_rss_mb']} MB 峰值常驻内存"
    mem_after_label = f"{final_b['peak_rss_mb']} MB 峰值常驻内存"
    mem_delta = (
        f"-{rss_drop_pct:.1f}% RAM"
        if rss_drop_pct >= 0
        else f"+{abs(rss_drop_pct):.1f}% RAM"
    )

    compute_saved_pct = int(round((1.0 - final_ms / base_ms) * 100.0))
    cost_before_score = None
    cost_after_score = clamp_score(50.0 + compute_saved_pct * 0.5, 0, 100)
    cost_before_label = "未测量"
    cost_after_label = f"单节点吞吐量 {speedup:.2f} 倍"
    cost_delta = (
        f"-{compute_saved_pct}% 计算时长"
        if compute_saved_pct >= 0
        else f"+{abs(compute_saved_pct)}% 计算时长"
    )
  else:
    speedup = None
    speed_before_score = None
    speed_after_score = None
    speed_before_label = (
        f"{benches[0]['wall_time_ms']} ms" if benches else "未测量"
    )
    speed_after_label = "未测量"
    speed_delta = "未测量"

    mem_before_score = None
    mem_after_score = None
    mem_before_label = (
        f"{benches[0]['peak_rss_mb']} MB" if benches else "未测量"
    )
    mem_after_label = "未测量"
    mem_delta = "未测量"

    cost_before_score = None
    cost_after_score = None
    cost_before_label = "未测量"
    cost_after_label = "未测量"
    cost_delta = "未测量"

  hazards = before_c.get("hazards_count")
  unsafe_cnt = after_c.get("unsafe_blocks")
  if hazards is not None:
    safety_before_score = clamp_score(80.0 - float(hazards) * 2.5, 0, 100)
    safety_before_label = f"{int(hazards)} 处指针／状态隐患"
  else:
    safety_before_score = None
    safety_before_label = "未测量"

  if unsafe_cnt is not None:
    unsafe_int = int(unsafe_cnt)
    safety_after_score = (
        100
        if unsafe_int == 0
        else clamp_score(90.0 - unsafe_int * 10.0, 0, 100)
    )
    safety_after_label = f"{unsafe_int} 个 unsafe 块"
    safety_delta = (
        "100% 安全 Rust" if unsafe_int == 0 else f"{unsafe_int} 处 unsafe"
    )
  else:
    safety_after_score = None
    safety_after_label = "未测量"
    safety_delta = "未测量"

  parity_runs = data.get("parity_iterations") or []
  if parity_runs:
    last_p = parity_runs[-1]
    seeds_t = max(1, int(last_p.get("seeds_tested", 0)))
    seeds_p = int(last_p.get("seeds_passed", 0))
    parity_pct = round((seeds_p / seeds_t) * 100.0, 1)
    parity_before_score = None
    parity_after_score = clamp_score(parity_pct, 0, 100)
    parity_before_label = "未测量"
    parity_after_label = f"{parity_pct}% 一致，共 {seeds_t} 个种子"
    parity_delta = f"{parity_pct}% 已验证"
    parity_expl = (
        "自动化 A/B 差分测试框架验证了"
        f" {seeds_t} 个确定性种子的输出等价性。"
    )
  else:
    parity_before_score = None
    parity_after_score = None
    parity_before_label = "未测量"
    parity_after_label = "未测量"
    parity_delta = "未测量"
    parity_expl = (
        "尚未记录 A/B 一致性验证。请运行 'telemetry.py log-parity-run'"
        " 记录种子结果对比。"
    )

  cov_raw = after_c.get("branch_coverage_pct")
  clippy_raw = after_c.get("clippy_warnings")
  if cov_raw is not None and clippy_raw is not None:
    cov_pct = round(float(cov_raw), 1)
    clippy_w = int(clippy_raw)
    qual_before_score = None
    qual_after_score = clamp_score(cov_pct - clippy_w * 3.0, 0, 100)
    qual_before_label = "未测量"
    qual_after_label = f"{cov_pct}% 覆盖率"
    qual_delta = f"{clippy_w} 条警告 • {cov_pct}% 覆盖率"
  else:
    qual_before_score = None
    qual_after_score = None
    qual_before_label = "未测量"
    qual_after_label = "未测量"
    qual_delta = "未测量"

  doc_before = before_c.get("comment_pct")
  doc_after = after_c.get("comment_pct")
  u400_before = before_c.get("files_under_400_pct")
  u400_after = after_c.get("files_under_400_pct")
  if doc_before is not None and u400_before is not None:
    hygiene_before_score = clamp_score(
        float(doc_before) * 2.0 + float(u400_before) * 0.4, 0, 100
    )
    hygiene_before_label = (
        f"{doc_before}% 注释 • 单文件最多 {before_c.get('max_file_loc', 0)} 行代码"
    )
  else:
    hygiene_before_score = None
    hygiene_before_label = "未测量"

  if doc_after is not None and u400_after is not None:
    hygiene_after_score = clamp_score(
        float(u400_after) * 0.6 + min(40.0, float(doc_after) * 1.8), 0, 100
    )
    hygiene_after_label = (
        f"{doc_after}% 文档 • 单文件最多 {after_c.get('max_file_loc', 0)} 行代码"
    )
    if doc_before is not None and float(doc_before) > 0:
      doc_inc = int(
          round(
              ((float(doc_after) - float(doc_before)) / float(doc_before))
              * 100.0
          )
      )
      hygiene_delta = (
          f"+{doc_inc}% 文档" if doc_inc >= 0 else f"{doc_inc}% 文档"
      )
    else:
      hygiene_delta = f"{doc_after}% 文档"
  else:
    hygiene_after_score = None
    hygiene_after_label = "未测量"
    hygiene_delta = "未测量"

  nest_b = before_c.get("max_nesting_depth")
  fn_b = before_c.get("avg_fn_loc")
  nest_a = after_c.get("max_nesting_depth")
  fn_a = after_c.get("avg_fn_loc")

  if nest_b is not None and fn_b is not None:
    simp_before_score = clamp_score(
        100.0 - int(nest_b) * 5.0 - int(fn_b) * 0.3, 0, 100
    )
    simp_before_label = f"嵌套深度 {int(nest_b)} • 每函数 {int(fn_b)} 行代码"
  else:
    simp_before_score = None
    simp_before_label = "未测量"

  if nest_a is not None and fn_a is not None:
    simp_after_score = clamp_score(
        100.0 - max(0, int(nest_a) - 2) * 4.0 - max(0, int(fn_a) - 20) * 0.4,
        0,
        100,
    )
    simp_after_label = f"嵌套深度 {int(nest_a)} • 每函数 {int(fn_a)} 行代码"
    if fn_b is not None and int(fn_b) > 0:
      fn_drop = int(round(((int(fn_b) - int(fn_a)) / int(fn_b)) * 100.0))
      simp_delta = (
          f"-{fn_drop}% 函数长度"
          if fn_drop >= 0
          else f"+{abs(fn_drop)}% 函数长度"
      )
    else:
      simp_delta = f"每函数 {int(fn_a)} 行代码"
  else:
    simp_after_score = None
    simp_after_label = "未测量"
    simp_delta = "未测量"

  data["scorecard"] = [
      {
          "id": "speed",
          "title": "速度与 PGO 吞吐量",
          "icon": "⚡",
          "before_score": speed_before_score,
          "before_grade": grade_from_score(speed_before_score),
          "before_label": speed_before_label,
          "after_score": speed_after_score,
          "after_grade": grade_from_score(speed_after_score),
          "after_label": speed_after_label,
          "delta_badge": speed_delta,
          "explanation": (
              "比较基线、数组结构（SoA）布局和 LLVM 基于性能剖析的优化（PGO）"
              "各阶段的实际运行耗时。"
          ),
      },
      {
          "id": "memory",
          "title": "内存效率（RSS）",
          "icon": "💾",
          "before_score": mem_before_score,
          "before_grade": grade_from_score(mem_before_score),
          "before_label": mem_before_label,
          "after_score": mem_after_score,
          "after_grade": grade_from_score(mem_after_score),
          "after_label": mem_after_label,
          "delta_badge": mem_delta,
          "explanation": (
              "采用预分配的工作区缓冲区、热点循环零堆分配时的"
              "峰值常驻内存占用。"
          ),
      },
      {
          "id": "safety",
          "title": "内存安全（unsafe 审计）",
          "icon": "🛡️",
          "before_score": safety_before_score,
          "before_grade": grade_from_score(safety_before_score),
          "before_label": safety_before_label,
          "after_score": safety_after_score,
          "after_grade": grade_from_score(safety_after_score),
          "after_label": safety_after_label,
          "delta_badge": safety_delta,
          "explanation": (
              "通过 #![forbid(unsafe_code)] 强制保证编译期内存安全，"
              "消除裸指针和缓冲区隐患。"
          ),
      },
      {
          "id": "parity",
          "title": "输出一致性与确定性",
          "icon": "🎯",
          "before_score": parity_before_score,
          "before_grade": grade_from_score(parity_before_score),
          "before_label": parity_before_label,
          "after_score": parity_after_score,
          "after_grade": grade_from_score(parity_after_score),
          "after_label": parity_after_label,
          "delta_badge": parity_delta,
          "explanation": parity_expl,
      },
      {
          "id": "quality",
          "title": "代码质量与测试覆盖率",
          "icon": "✅",
          "before_score": qual_before_score,
          "before_grade": grade_from_score(qual_before_score),
          "before_label": qual_before_label,
          "after_score": qual_after_score,
          "after_grade": grade_from_score(qual_after_score),
          "after_label": qual_after_label,
          "delta_badge": qual_delta,
          "explanation": (
              "包含单元测试、集成测试、文档测试和基于属性的 proptest 测试套件，"
              "并通过 clippy -D warnings 检查。"
          ),
      },
      {
          "id": "hygiene",
          "title": "代码整洁度与文档",
          "icon": "📚",
          "before_score": hygiene_before_score,
          "before_grade": grade_from_score(hygiene_before_score),
          "before_label": hygiene_before_label,
          "after_score": hygiene_after_score,
          "after_grade": grade_from_score(hygiene_after_score),
          "after_label": hygiene_after_label,
          "delta_badge": hygiene_delta,
          "explanation": (
              "为公共类型和函数编写 rustdoc 文档及可运行的文档测试，"
              "目标为每个文件不超过 400 行代码。"
          ),
      },
      {
          "id": "simplicity",
          "title": "认知简洁性",
          "icon": "🧩",
          "before_score": simp_before_score,
          "before_grade": grade_from_score(simp_before_score),
          "before_label": simp_before_label,
          "after_score": simp_after_score,
          "after_grade": grade_from_score(simp_after_score),
          "after_label": simp_after_label,
          "delta_badge": simp_delta,
          "explanation": (
              "将嵌套很深的单体函数和可变全局变量"
              "拆解为小型、可组合的函数。"
          ),
      },
      {
          "id": "cost",
          "title": "计算吞吐效率",
          "icon": "☁️",
          "before_score": cost_before_score,
          "before_grade": grade_from_score(cost_before_score),
          "before_label": cost_before_label,
          "after_score": cost_after_score,
          "after_grade": grade_from_score(cost_after_score),
          "after_label": cost_after_label,
          "delta_badge": cost_delta,
          "explanation": (
              "测量各基准测试阶段中单节点的"
              "执行加速比与内存降幅。"
          ),
      },
  ]


def render_infographic_from_template(tpl_path: Path, data: dict) -> str:
  """通过 infographic_template.html 和遥测字典渲染交互式 HTML 信息图。"""
  try:
    html = tpl_path.read_text(encoding="utf-8")
  except OSError as exc:
    raise TelemetryError(
        f"无法读取信息图模板 '{tpl_path}'：{exc}"
    ) from exc
  json_payload = json.dumps(data, indent=2).replace("</", "<\\/")
  return html.replace('"__TELEMETRY_JSON_PLACEHOLDER__"', json_payload)


def cmd_render_infographic(args: argparse.Namespace) -> None:
  tpath = Path(args.telemetry)
  data = load_telemetry(tpath)
  if getattr(args, "user", None):
    data["user"] = args.user
  data["model"] = resolve_effective_model(
      getattr(args, "model", None), data.get("model")
  )
  if getattr(args, "source_url", None):
    data["source_url"] = args.source_url
  if getattr(args, "scope_summary", None):
    data["scope_summary"] = args.scope_summary
  if getattr(args, "run_id", None):
    data["run_id"] = args.run_id

  compute_derived_metrics(data)
  save_telemetry(tpath, data)

  script_dir = Path(__file__).parent.resolve()
  default_tpl = script_dir.parent / "references" / "infographic_template.html"
  tpl_path = Path(args.template) if args.template else default_tpl

  if not tpl_path.exists():
    raise TelemetryError(
        f"未在 '{tpl_path}' 找到信息图模板。请通过 '--template'"
        " 传入有效路径。"
    )

  html_out = render_infographic_from_template(tpl_path, data)

  out_path = Path(args.out)
  try:
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(html_out, encoding="utf-8")
  except OSError as exc:
    raise TelemetryError(
        f"无法将 HTML 信息图写入 '{out_path}'：{exc}"
    ) from exc
  print(f"[telemetry] 已将交互式 HTML 信息图渲染至 {out_path}")


def build_parser() -> argparse.ArgumentParser:
  p = argparse.ArgumentParser(
      description="kane-migrate-to-rust 迁移遥测与信息图 CLI"
  )
  sub = p.add_subparsers(dest="cmd", required=True)

  p_init = sub.add_parser("init", help="初始化 migration_telemetry.json")
  p_init.add_argument(
      "--telemetry", required=True, help="migration_telemetry.json 的路径"
  )
  p_init.add_argument(
      "--project-name", required=True, help="便于人类阅读的项目名称"
  )
  p_init.add_argument(
      "--legacy-lang",
      required=True,
      help="检测到的遗留语言（例如 C++14、Fortran90、Python）",
  )
  p_init.add_argument(
      "--model",
      default=None,
      help="可选的 AI 模型标识符",
  )
  p_init.add_argument("--user", default=None, help="开发者用户名")
  p_init.add_argument(
      "--source-url", default=None, help="源代码的 GitHub URL 或仓库路径"
  )
  p_init.add_argument(
      "--scope-summary", default=None, help="迁移范围的简要概述"
  )
  p_init.set_defaults(func=cmd_init)

  p_sb = sub.add_parser(
      "start-bucket", help="启动任务计时分组的实际耗时计时器"
  )
  p_sb.add_argument("--telemetry", required=True)
  p_sb.add_argument("--bucket", required=True, choices=list(BUCKET_META.keys()))
  p_sb.set_defaults(func=cmd_start_bucket)

  p_eb = sub.add_parser(
      "end-bucket", help="结束任务计时分组的实际耗时计时器"
  )
  p_eb.add_argument("--telemetry", required=True)
  p_eb.add_argument("--bucket", required=True, choices=list(BUCKET_META.keys()))
  p_eb.add_argument(
      "--minutes",
      type=float,
      default=None,
      help="可选：显式指定分钟数以覆盖计时值",
  )
  p_eb.set_defaults(func=cmd_end_bucket)

  p_scan = sub.add_parser(
      "scan-codebase",
      help="扫描迁移前（遗留代码）或迁移后（Rust）的代码库指标",
  )
  p_scan.add_argument("--telemetry", required=True)
  p_scan.add_argument("--phase", required=True, choices=["before", "after"])
  p_scan.add_argument("--dir", required=True, help="待扫描目录")
  p_scan.add_argument("--coverage-pct", type=float, default=None)
  p_scan.add_argument("--clippy-warnings", type=int, default=None)
  p_scan.set_defaults(func=cmd_scan_codebase)

  p_opp = sub.add_parser(
      "log-opportunity",
      help="记录架构改进机会或遗留代码中的潜在缺陷",
  )
  p_opp.add_argument("--telemetry", required=True)
  p_opp.add_argument(
      "--category",
      required=True,
      choices=[
          "latent_bug",
          "performance",
          "safety",
          "hygiene",
          "architecture",
      ],
  )
  p_opp.add_argument("--title", required=True)
  p_opp.add_argument("--file", default="")
  p_opp.add_argument("--description", required=True)
  p_opp.set_defaults(func=cmd_log_opportunity)

  p_tr = sub.add_parser(
      "log-test-run", help="记录一次测试执行与自动修复迭代"
  )
  p_tr.add_argument("--telemetry", required=True)
  p_tr.add_argument("--iteration", type=int, required=True)
  p_tr.add_argument("--total", type=int, required=True)
  p_tr.add_argument("--passed", type=int, required=True)
  p_tr.add_argument("--failed", type=int, required=True)
  p_tr.add_argument("--coverage-pct", type=float, default=None)
  p_tr.add_argument("--clippy-warnings", type=int, default=None)
  p_tr.add_argument("--failures-summary", required=True)
  p_tr.add_argument("--fix-applied", required=True)
  p_tr.set_defaults(func=cmd_log_test_run)

  p_pr = sub.add_parser(
      "log-parity-run", help="记录一次 A/B 差分一致性验证迭代"
  )
  p_pr.add_argument("--telemetry", required=True)
  p_pr.add_argument("--iteration", type=int, required=True)
  p_pr.add_argument("--seeds-tested", type=int, required=True)
  p_pr.add_argument("--seeds-passed", type=int, required=True)
  p_pr.add_argument("--max-abs-error", required=True)
  p_pr.add_argument("--divergence-cause", required=True)
  p_pr.add_argument("--fix-applied", required=True)
  p_pr.set_defaults(func=cmd_log_parity_run)

  p_bm = sub.add_parser(
      "log-benchmark", help="记录四阶段 PGO 阶梯中的一个基准测试阶段"
  )
  p_bm.add_argument("--telemetry", required=True)
  p_bm.add_argument(
      "--stage",
      required=True,
      choices=["legacy_baseline", "safe_rust", "soa_simd", "pgo_lto"],
  )
  p_bm.add_argument("--label", default="")
  p_bm.add_argument("--wall-time-ms", type=float, required=True)
  p_bm.add_argument("--peak-rss-mb", type=float, required=True)
  p_bm.add_argument("--notes", default="")
  p_bm.set_defaults(func=cmd_log_benchmark)

  p_sp = sub.add_parser(
      "log-spotlight", help="记录迁移前后的重点代码片段对比"
  )
  p_sp.add_argument("--telemetry", required=True)
  p_sp.add_argument("--explanation", required=True)
  p_sp.add_argument("--legacy-file", required=True)
  p_sp.add_argument("--legacy-code", default="")
  p_sp.add_argument("--legacy-code-file", default="")
  p_sp.add_argument("--rust-file", required=True)
  p_sp.add_argument("--rust-code", default="")
  p_sp.add_argument("--rust-code-file", default="")
  p_sp.set_defaults(func=cmd_log_spotlight)

  p_st = sub.add_parser(
      "set-story", help="设置 AI 第一人称故事叙述字段"
  )
  p_st.add_argument("--telemetry", required=True)
  p_st.add_argument("--headline", default=None)
  p_st.add_argument("--intro", default=None)
  p_st.add_argument("--ch1-narrative", dest="ch1_narrative", default=None)
  p_st.add_argument("--ch2-narrative", dest="ch2_narrative", default=None)
  p_st.add_argument("--ch3-narrative", dest="ch3_narrative", default=None)
  p_st.add_argument("--ch4-narrative", dest="ch4_narrative", default=None)
  p_st.add_argument("--ch5-narrative", dest="ch5_narrative", default=None)
  p_st.set_defaults(func=cmd_set_story)

  p_ri = sub.add_parser(
      "render-infographic",
      help="计算最终评分卡并渲染 HTML 信息图",
  )
  p_ri.add_argument("--telemetry", required=True)
  p_ri.add_argument(
      "--out",
      required=True,
      help="输出 HTML 文件路径",
  )
  p_ri.add_argument(
      "--template", default=None, help="可选的自定义模板路径"
  )
  p_ri.add_argument(
      "--model",
      default=None,
      help="可选的 AI 模型标识符",
  )
  p_ri.add_argument("--user", default=None, help="开发者用户名")
  p_ri.add_argument(
      "--source-url", default=None, help="源代码的 GitHub URL 或仓库路径"
  )
  p_ri.add_argument(
      "--scope-summary", default=None, help="迁移范围的简要概述"
  )
  p_ri.add_argument(
      "--run-id", default=None, help="可选：显式指定运行 ID 短标识"
  )
  p_ri.set_defaults(func=cmd_render_infographic)

  return p


def main(argv: list[str] | None = None) -> int:
  parser = build_parser()
  args = parser.parse_args(argv)
  try:
    args.func(args)
  except TelemetryError as exc:
    print(f"[telemetry] 错误：{exc}", file=sys.stderr)
    return 1
  except KeyError as exc:
    print(
        f"[telemetry] 错误：缺少必需的遥测键 {exc}。请确保已对该文件运行"
        " 'telemetry.py init'。",
        file=sys.stderr,
    )
    return 1
  return 0


if __name__ == "__main__":
  sys.exit(main())
