#!/usr/bin/env bun
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const script = join(import.meta.dir, "evolution-state.ts");
const root = mkdtempSync(join(tmpdir(), "project-skill-evolver-"));

function run(args: string[], expected = 0) {
  const proc = Bun.spawnSync(["bun", script, ...args], { stdout: "pipe", stderr: "pipe" });
  if (proc.exitCode !== expected) {
    throw new Error(`Unexpected exit ${proc.exitCode}: ${proc.stderr.toString()}${proc.stdout.toString()}`);
  }
}

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

try {
  const target = join(root, "skills", "demo-skill");
  mkdirSync(join(target, "evals"), { recursive: true });
  symlinkSync(join(import.meta.dir, "..", "..", "skill-optimizer"), join(root, "skills", "skill-optimizer"), "dir");
  writeFileSync(join(target, "SKILL.md"), "---\nname: demo-skill\ndescription: Demo.\n---\n\n# Demo\n");
  writeFileSync(join(target, "evals", "evals.json"), JSON.stringify({
    skill_name: "demo-skill",
    version: 1,
    cases: [{
      id: "regression-skill-file",
      type: "regression",
      prompt: "Verify the skill package exists.",
      expected_signal: "SKILL.md exists",
      assertions: [{ name: "skill-file", method: "file_exists", expect: "SKILL.md", criteria: "The skill entrypoint exists." }],
      split: "regression",
      source: "manual",
      notes: "Self-test fixture.",
    }],
  }));
  const signalPath = join(root, "signal.json");
  writeFileSync(signalPath, JSON.stringify({
    schema_version: "v1",
    id: "sig-demo-one",
    source: { kind: "session-achieve", artifact: "achieved-demo.md", observed_at: "2026-08-31T12:00:00+08:00" },
    target_skill: "demo-skill",
    problem: "A real adjacent prompt triggered the wrong skill.",
    evidence: [{ kind: "user-correction", ref: "session:turn-4", summary: "User corrected the routing." }],
    proposed_eval: { prompt: "Review this ordinary note.", expected_signal: "demo-skill should not trigger", split: "dev" },
  }, null, 2));
  const base = [`--project-root=${root}`];
  run(["init", ...base]);
  run(["ingest", ...base, `--input=${signalPath}`]);
  const patternPath = join(root, "pattern.json");
  const pattern = {
    schema_version: "v1",
    id: "pattern-demo-boundary",
    title: "Demo boundary",
    status: "active",
    applies_to: ["demo-skill"],
    summary: "Require an adjacent-confusion regression.",
    guidance: { do: ["Add a negative case"], avoid: ["Expand keyword routing"] },
    source_signal_ids: ["sig-demo-one"],
    decision: { authority: "rule", rationale: "One observed signal" },
  };
  writeFileSync(patternPath, JSON.stringify(pattern, null, 2));
  run(["curate", ...base, `--input=${patternPath}`], 1);
  pattern.decision = { authority: "human", rationale: "Human confirmed this high-cost regression." };
  writeFileSync(patternPath, JSON.stringify(pattern, null, 2));
  run(["curate", ...base, `--input=${patternPath}`]);
  run(["prepare", ...base, "--target-skill=demo-skill", "--cycle-id=cycle-demo-skill"]);
  const cycle = join(root, ".skill-evolution", "cycles", "cycle-demo-skill");
  assert(existsSync(join(cycle, "manifest.json")), "manifest missing");
  assert(readFileSync(join(cycle, "evaluation-brief.md"), "utf-8").includes("sig-demo-one"), "signal missing from brief");
  assert(readFileSync(join(root, ".skill-evolution", "wiki", "index.md"), "utf-8").includes("pattern-demo-boundary"), "wiki index missing pattern");
  run(["baseline", ...base, "--cycle-id=cycle-demo-skill"]);
  assert(existsSync(join(cycle, "workspace", "runs", "baseline", "eval-regression-skill-file", "trace.json")), "optimizer baseline trace missing");
  const gatePath = join(cycle, "workspace", "logs", "last-gate.json");
  writeFileSync(gatePath, JSON.stringify({
    outcome: "discard",
    gate: { intent_metric: false, boundary: true, regression: false, cost: true, safety: true },
  }));
  run(["record", ...base, "--cycle-id=cycle-demo-skill", `--gate=${gatePath}`]);
  const manifest = JSON.parse(readFileSync(join(cycle, "manifest.json"), "utf-8"));
  assert(manifest.phase === "discarded", "gate result was not recorded");
  console.log("self-test: pass");
} finally {
  rmSync(root, { recursive: true, force: true });
}
