#!/usr/bin/env bun
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path";

type Json = Record<string, any>;

const ID_RE = /^[a-z0-9][a-z0-9-]{2,63}$/;

function fail(message: string): never {
  console.error(`Error: ${message}`);
  process.exit(1);
}

function parseArgs() {
  const [command, ...rest] = process.argv.slice(2);
  if (!command) usage();
  const options: Record<string, string | boolean> = {};
  for (const arg of rest) {
    if (!arg.startsWith("--")) fail(`Unexpected argument: ${arg}`);
    const [key, ...value] = arg.slice(2).split("=");
    options[key] = value.length ? value.join("=") : true;
  }
  return { command, options };
}

function usage(): never {
  fail(
    "Usage: evolution-state.ts <init|ingest|curate|prepare|baseline|record|status> " +
      "--project-root=<path> [--input=<json>] [--target-skill=<name-or-path>] [--cycle-id=<id>] " +
      "[--gate=<json>] [--replace] [--approve-warning]",
  );
}

function required(options: Record<string, string | boolean>, key: string): string {
  const value = options[key];
  if (typeof value !== "string" || !value) fail(`--${key}=<value> is required`);
  return value;
}

function now() {
  return new Date().toISOString();
}

function compactTimestamp() {
  return now().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "z").toLowerCase();
}

function readJson(path: string): Json {
  try {
    return JSON.parse(readFileSync(path, "utf-8"));
  } catch (error) {
    fail(`Cannot read JSON ${path}: ${(error as Error).message}`);
  }
}

function writeJsonAtomic(path: string, data: unknown) {
  mkdirSync(dirname(path), { recursive: true });
  const temporary = `${path}.tmp-${process.pid}`;
  writeFileSync(temporary, `${JSON.stringify(data, null, 2)}\n`);
  renameSync(temporary, path);
}

function assertId(value: unknown, field: string): asserts value is string {
  if (typeof value !== "string" || !ID_RE.test(value)) fail(`${field} must match ${ID_RE}`);
}

function assertText(value: unknown, field: string): asserts value is string {
  if (typeof value !== "string" || !value.trim()) fail(`${field} must be a non-empty string`);
}

function assertStringArray(value: unknown, field: string): asserts value is string[] {
  if (!Array.isArray(value) || value.length === 0 || value.some((item) => typeof item !== "string" || !item.trim())) {
    fail(`${field} must be a non-empty string array`);
  }
}

function context(options: Record<string, string | boolean>) {
  const projectRoot = resolve(required(options, "project-root"));
  if (!existsSync(projectRoot)) fail(`Project root not found: ${projectRoot}`);
  return { projectRoot, stateDir: join(projectRoot, ".skill-evolution") };
}

function initialize(stateDir: string) {
  for (const path of [
    join(stateDir, "signals"),
    join(stateDir, "wiki", "patterns"),
    join(stateDir, "wiki", "history"),
    join(stateDir, "cycles"),
    join(stateDir, "logs"),
  ]) {
    mkdirSync(path, { recursive: true });
  }
  const index = join(stateDir, "wiki", "index.md");
  if (!existsSync(index)) writeFileSync(index, "# Skill Evolution Wiki\n\n暂无 Pattern。\n");
}

function logEvent(stateDir: string, event: Json) {
  appendFileSync(join(stateDir, "logs", "events.jsonl"), `${JSON.stringify({ timestamp: now(), ...event })}\n`);
}

function validateSignal(signal: Json) {
  if (signal.schema_version !== "v1") fail("signal.schema_version must be v1");
  assertId(signal.id, "signal.id");
  assertId(signal.target_skill, "signal.target_skill");
  assertText(signal.problem, "signal.problem");
  if (!["session-achieve", "eval-failure", "human-review"].includes(signal.source?.kind)) {
    fail("signal.source.kind must be session-achieve, eval-failure, or human-review");
  }
  assertText(signal.source?.artifact, "signal.source.artifact");
  assertText(signal.source?.observed_at, "signal.source.observed_at");
  if (!Array.isArray(signal.evidence) || signal.evidence.length === 0) fail("signal.evidence must be non-empty");
  for (const [index, evidence] of signal.evidence.entries()) {
    assertText(evidence?.kind, `signal.evidence[${index}].kind`);
    assertText(evidence?.ref, `signal.evidence[${index}].ref`);
    assertText(evidence?.summary, `signal.evidence[${index}].summary`);
  }
  assertText(signal.proposed_eval?.prompt, "signal.proposed_eval.prompt");
  assertText(signal.proposed_eval?.expected_signal, "signal.proposed_eval.expected_signal");
  if (!["dev", "regression"].includes(signal.proposed_eval?.split)) {
    fail("signal.proposed_eval.split must be dev or regression");
  }
}

function validatePattern(pattern: Json, stateDir: string) {
  if (pattern.schema_version !== "v1") fail("pattern.schema_version must be v1");
  assertId(pattern.id, "pattern.id");
  assertText(pattern.title, "pattern.title");
  if (!["candidate", "active", "rejected"].includes(pattern.status)) {
    fail("pattern.status must be candidate, active, or rejected");
  }
  assertStringArray(pattern.applies_to, "pattern.applies_to");
  assertText(pattern.summary, "pattern.summary");
  assertStringArray(pattern.guidance?.do, "pattern.guidance.do");
  assertStringArray(pattern.guidance?.avoid, "pattern.guidance.avoid");
  assertStringArray(pattern.source_signal_ids, "pattern.source_signal_ids");
  if (!["human", "rule"].includes(pattern.decision?.authority)) fail("pattern.decision.authority must be human or rule");
  assertText(pattern.decision?.rationale, "pattern.decision.rationale");
  for (const id of pattern.source_signal_ids) {
    assertId(id, "pattern.source_signal_ids[]");
    if (!existsSync(join(stateDir, "signals", `${id}.json`))) fail(`Unknown source signal: ${id}`);
  }
  const distinctSignals = new Set(pattern.source_signal_ids);
  if (distinctSignals.size !== pattern.source_signal_ids.length) fail("pattern.source_signal_ids must not contain duplicates");
  if (pattern.status === "active" && distinctSignals.size < 2 && pattern.decision.authority !== "human") {
    fail("active pattern requires two source signals or an explicit human decision");
  }
}

function rebuildIndex(stateDir: string) {
  const dir = join(stateDir, "wiki", "patterns");
  const patterns = readdirSync(dir)
    .filter((name) => name.endsWith(".json"))
    .map((name) => readJson(join(dir, name)))
    .sort((a, b) => String(a.id).localeCompare(String(b.id)));
  const rows = patterns.map(
    (pattern) => `| ${pattern.id} | ${pattern.status} | ${pattern.applies_to.join(", ")} | ${pattern.title} |`,
  );
  writeFileSync(
    join(stateDir, "wiki", "index.md"),
    [
      "# Skill Evolution Wiki",
      "",
      "| Pattern | 状态 | 适用技能 | 标题 |",
      "|---|---|---|---|",
      ...(rows.length ? rows : ["| — | — | — | 暂无 Pattern |"]),
      "",
    ].join("\n"),
  );
}

function resolveTarget(projectRoot: string, input: string) {
  const target = input.includes("/") || input.startsWith(".") ? resolve(projectRoot, input) : join(projectRoot, "skills", input);
  const rel = relative(projectRoot, target);
  if (rel.startsWith("..") || isAbsolute(rel)) fail("Target skill must be inside project root");
  if (!existsSync(join(target, "SKILL.md"))) fail(`Target SKILL.md not found: ${target}`);
  const content = readFileSync(join(target, "SKILL.md"), "utf-8");
  const skillName = content.match(/^name:\s*([^\n]+)$/m)?.[1]?.trim() || basename(target);
  return { target, skillName };
}

function phaseForGate(outcome: string, approveWarning: boolean) {
  if (outcome === "keep" || (outcome === "keep-with-warning" && approveWarning)) return "kept";
  if (outcome === "discard") return "discarded";
  return "needs-human-review";
}

function main() {
  const { command, options } = parseArgs();
  const { projectRoot, stateDir } = context(options);
  initialize(stateDir);

  if (command === "init") {
    logEvent(stateDir, { event: "initialized", project_root: projectRoot });
    console.log(JSON.stringify({ project_root: projectRoot, state_dir: stateDir }, null, 2));
    return;
  }

  if (command === "ingest") {
    const signal = readJson(resolve(required(options, "input")));
    validateSignal(signal);
    const destination = join(stateDir, "signals", `${signal.id}.json`);
    if (existsSync(destination)) {
      const existing = readFileSync(destination, "utf-8").trim();
      const incoming = JSON.stringify(signal, null, 2).trim();
      if (existing !== incoming) fail(`Signal id already exists with different content: ${signal.id}`);
      console.log(JSON.stringify({ status: "unchanged", signal_id: signal.id, path: destination }, null, 2));
      return;
    }
    writeJsonAtomic(destination, signal);
    logEvent(stateDir, { event: "signal-ingested", signal_id: signal.id, target_skill: signal.target_skill });
    console.log(JSON.stringify({ status: "ingested", signal_id: signal.id, path: destination }, null, 2));
    return;
  }

  if (command === "curate") {
    const pattern = readJson(resolve(required(options, "input")));
    validatePattern(pattern, stateDir);
    const destination = join(stateDir, "wiki", "patterns", `${pattern.id}.json`);
    if (existsSync(destination) && options.replace !== true) fail(`Pattern already exists; use --replace: ${pattern.id}`);
    if (existsSync(destination)) {
      const history = join(stateDir, "wiki", "history", `${pattern.id}-${compactTimestamp()}.json`);
      writeFileSync(history, readFileSync(destination));
    }
    writeJsonAtomic(destination, { ...pattern, updated_at: now() });
    rebuildIndex(stateDir);
    logEvent(stateDir, { event: "pattern-curated", pattern_id: pattern.id, status: pattern.status });
    console.log(JSON.stringify({ status: pattern.status, pattern_id: pattern.id, path: destination }, null, 2));
    return;
  }

  if (command === "prepare") {
    const { target, skillName } = resolveTarget(projectRoot, required(options, "target-skill"));
    const signals = readdirSync(join(stateDir, "signals"))
      .filter((name) => name.endsWith(".json"))
      .map((name) => readJson(join(stateDir, "signals", name)))
      .filter((item) => item.target_skill === skillName);
    if (signals.length === 0) fail(`No matching Signal for target skill: ${skillName}`);
    const patterns = readdirSync(join(stateDir, "wiki", "patterns"))
      .filter((name) => name.endsWith(".json"))
      .map((name) => readJson(join(stateDir, "wiki", "patterns", name)))
      .filter((item) => item.status === "active" && (item.applies_to.includes(skillName) || item.applies_to.includes("*")));
    const cycleId = typeof options["cycle-id"] === "string"
      ? options["cycle-id"]
      : `cycle-${compactTimestamp()}-${skillName}`.slice(0, 64);
    assertId(cycleId, "cycle-id");
    const cycleDir = join(stateDir, "cycles", cycleId);
    if (existsSync(cycleDir)) fail(`Cycle already exists: ${cycleId}`);
    mkdirSync(cycleDir, { recursive: true });
    const evalSuite = join(target, "evals", "evals.json");
    const manifest = {
      schema_version: "v1",
      id: cycleId,
      target_skill: skillName,
      target_skill_path: relative(projectRoot, target),
      signal_ids: signals.map((item) => item.id),
      pattern_ids: patterns.map((item) => item.id),
      phase: existsSync(evalSuite) ? "eval-ready" : "needs-eval",
      eval_suite: relative(projectRoot, evalSuite),
      workspace: null,
      created_at: now(),
      updated_at: now(),
    };
    writeJsonAtomic(join(cycleDir, "manifest.json"), manifest);
    writeFileSync(
      join(cycleDir, "evaluation-brief.md"),
      [
        `# Evaluation Brief: ${skillName}`,
        "",
        `周期：${cycleId}`,
        "",
        "## Signal",
        "",
        ...(signals.length
          ? signals.flatMap((item) => [
              `### ${item.id}`,
              "",
              item.problem,
              "",
              `- Prompt: ${item.proposed_eval.prompt}`,
              `- Expected: ${item.proposed_eval.expected_signal}`,
              `- Suggested split: ${item.proposed_eval.split}`,
              "",
            ])
          : ["暂无匹配 Signal。不得凭空构造修改理由。", ""]),
        "## 交接要求",
        "",
        `由 skill-evaluator 更新 \`${relative(projectRoot, evalSuite)}\`。新信号先进入 dev；已修复的真实 Bad Case 才进入 regression；保留 Signal ID。`,
        "",
      ].join("\n"),
    );
    writeFileSync(
      join(cycleDir, "optimizer-brief.md"),
      [
        `# Optimizer Brief: ${skillName}`,
        "",
        `周期：${cycleId}`,
        "",
        "## Active Wiki Patterns",
        "",
        ...(patterns.length
          ? patterns.flatMap((item) => [
              `- ${item.id}: ${item.summary}`,
              `  - Do: ${item.guidance.do.join("；")}`,
              `  - Avoid: ${item.guidance.avoid.join("；")}`,
            ])
          : ["- 无。仅使用 Signal 与评测 Trace 形成假设。"]),
        "",
        "## 门禁",
        "",
        "仅在 baseline、boundary、regression、cost、safety 全部满足时保留修改；否则回滚或进入人工复核。",
        "",
      ].join("\n"),
    );
    logEvent(stateDir, { event: "cycle-prepared", cycle_id: cycleId, target_skill: skillName, phase: manifest.phase });
    console.log(JSON.stringify({ cycle_id: cycleId, cycle_dir: cycleDir, phase: manifest.phase }, null, 2));
    return;
  }

  if (command === "baseline") {
    const cycleId = required(options, "cycle-id");
    assertId(cycleId, "cycle-id");
    const manifestPath = join(stateDir, "cycles", cycleId, "manifest.json");
    if (!existsSync(manifestPath)) fail(`Cycle not found: ${cycleId}`);
    const manifest = readJson(manifestPath);
    const { target } = resolveTarget(projectRoot, manifest.target_skill_path);
    const evalSuite = join(projectRoot, manifest.eval_suite);
    if (!existsSync(evalSuite)) fail(`Eval suite missing; run skill-evaluator first: ${evalSuite}`);
    const workspace = join(stateDir, "cycles", cycleId, "workspace");
    if (existsSync(workspace)) fail(`Workspace already exists: ${workspace}`);
    const optimizer = join(projectRoot, "skills", "skill-optimizer", "scripts", "workspace-init.ts");
    if (!existsSync(optimizer)) fail(`skill-optimizer workspace initializer not found: ${optimizer}`);
    const proc = Bun.spawnSync(["bun", optimizer, target, `--out-dir=${workspace}`], { stdout: "pipe", stderr: "pipe" });
    if (proc.exitCode !== 0) fail(`Baseline failed: ${proc.stderr.toString().trim()}`);
    const updated = { ...manifest, phase: "baseline-ready", workspace: relative(projectRoot, workspace), updated_at: now() };
    writeJsonAtomic(manifestPath, updated);
    logEvent(stateDir, { event: "baseline-ready", cycle_id: cycleId, workspace: updated.workspace });
    console.log(JSON.stringify({ cycle_id: cycleId, phase: updated.phase, workspace }, null, 2));
    return;
  }

  if (command === "record") {
    const cycleId = required(options, "cycle-id");
    assertId(cycleId, "cycle-id");
    const manifestPath = join(stateDir, "cycles", cycleId, "manifest.json");
    if (!existsSync(manifestPath)) fail(`Cycle not found: ${cycleId}`);
    const gatePath = resolve(required(options, "gate"));
    const expectedGatePath = join(stateDir, "cycles", cycleId, "workspace", "logs", "last-gate.json");
    if (gatePath !== expectedGatePath) fail(`Gate must be the cycle workspace result: ${expectedGatePath}`);
    const gate = readJson(gatePath);
    const allowed = ["keep", "discard", "keep-with-warning", "needs-human-review", "bad-gt-suspected", "flaky-suspected"];
    if (!allowed.includes(gate.outcome)) fail(`Unsupported gate outcome: ${gate.outcome}`);
    const gateDimensions = ["intent_metric", "boundary", "regression", "cost", "safety"];
    if (gateDimensions.some((key) => typeof gate.gate?.[key] !== "boolean")) fail("Gate is missing required boolean dimensions");
    if (gate.outcome === "keep" && gateDimensions.some((key) => gate.gate[key] !== true)) {
      fail("A keep outcome requires every gate dimension to pass");
    }
    const warningApproved = gate.outcome === "keep-with-warning" && options["approve-warning"] === true;
    const manifest = readJson(manifestPath);
    const updated = { ...manifest, phase: phaseForGate(gate.outcome, warningApproved), updated_at: now() };
    writeJsonAtomic(manifestPath, updated);
    writeJsonAtomic(join(stateDir, "cycles", cycleId, "result.json"), {
      cycle_id: cycleId,
      recorded_at: now(),
      warning_approved: warningApproved,
      gate,
    });
    logEvent(stateDir, { event: "cycle-recorded", cycle_id: cycleId, phase: updated.phase, gate_outcome: gate.outcome });
    console.log(JSON.stringify({ cycle_id: cycleId, phase: updated.phase, gate_outcome: gate.outcome }, null, 2));
    return;
  }

  if (command === "status") {
    const signals = readdirSync(join(stateDir, "signals")).filter((name) => name.endsWith(".json")).length;
    const patterns = readdirSync(join(stateDir, "wiki", "patterns"))
      .filter((name) => name.endsWith(".json"))
      .map((name) => readJson(join(stateDir, "wiki", "patterns", name)));
    const cycles = readdirSync(join(stateDir, "cycles"))
      .filter((name) => existsSync(join(stateDir, "cycles", name, "manifest.json"))).length;
    console.log(JSON.stringify({
      state_dir: stateDir,
      signals,
      patterns: { total: patterns.length, active: patterns.filter((item) => item.status === "active").length },
      cycles,
    }, null, 2));
    return;
  }

  usage();
}

main();
