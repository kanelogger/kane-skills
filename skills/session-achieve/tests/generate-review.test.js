"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");

const {
  availableOutputPath,
  fillTemplate,
  formatLocalDate,
  generateReport,
  parseArgs,
  validateData,
} = require("../scripts/generate-review.js");

const template = fs.readFileSync(
  path.join(__dirname, "..", "assets", "achieved_template.md"),
  "utf8"
);

function validData() {
  return {
    scope: "当前可见会话",
    status: "已完成",
    turns: 6,
    originalGoal: "优化会话复盘技能。",
    finalOutcome: "完成技能重构并通过测试。",
    assessment: {
      level: "部分达成",
      rationale: "核心功能完成，跨平台验证尚未执行。",
      verification: ["Node 测试通过", "跨平台验证未执行"],
    },
    evidence: [
      {
        ref: "用户第 1 轮",
        type: "明确要求",
        observation: "README 必须使用中文。",
        resolution: "已完成",
      },
      {
        ref: "测试输出",
        type: "自动验证",
        observation: "生成器测试全部通过。",
        response: "保留测试结果作为交付证据。",
      },
    ],
    corrections: [
      {
        ref: "用户第 2 轮",
        deviation: "旧模板强制输出百分比。",
        instruction: "结论必须有证据。",
        action: "把百分比改为可选字段。",
        result: "模板不再产生伪精确数字。",
      },
      {
        ref: "契约检查",
        deviation: "target_skill 可写待确认。",
        instruction: "Signal v1 要求明确技能名。",
        action: "无法确定目标时跳过 Signal。",
        result: "与当前契约一致。",
      },
    ],
    explicitConstraints: [
      { title: "语言", description: "README 使用中文。" },
      { title: "证据", description: "未知内容必须明确标注。" },
    ],
    inferredPreferences: [],
    unknowns: ["尚未在 Windows 验证。"],
    reusablePromptReason: "当前任务高度依赖一次性仓库上下文。",
    summary: {
      keyInsight: "强制量化会降低复盘可信度。",
      lesson: "模板字段必须与脚本一一对应。",
      reusability: "适用于其他会话复盘。",
    },
  };
}

test("完整渲染多条证据和纠偏，不遗留占位符", () => {
  const output = fillTemplate(
    template,
    validData(),
    new Date("2026-09-20T06:30:00Z")
  );

  assert.match(output, /用户第 1 轮/);
  assert.match(output, /测试输出/);
  assert.match(output, /用户第 2 轮/);
  assert.match(output, /契约检查/);
  assert.match(output, /不生成：当前任务高度依赖一次性仓库上下文/);
  assert.doesNotMatch(output, /\{\{[A-Z_]+\}\}/);
  assert.equal(output.includes("部分达成（75%）"), false);
  assert.equal(output.includes("\\n"), false);
});

test("存在可靠评分时渲染百分比", () => {
  const data = validData();
  data.assessment.rate = 75;
  data.reusablePrompt = "请完成 {{TASK}}，并验证结果。";
  const output = fillTemplate(template, data);
  assert.equal(output.includes("**部分达成（75%）**"), true);
  assert.equal(output.includes("{{TASK}}"), true);
});

test("拒绝无依据的非法百分比和缺失必填字段", () => {
  const data = validData();
  data.assessment.rate = 125;
  delete data.scope;
  const errors = validateData(data);
  assert.ok(errors.some((item) => item.includes("scope")));
  assert.ok(errors.some((item) => item.includes("0–100")));
});

test("拒绝缺少证据定位的结构化条目", () => {
  const data = validData();
  data.evidence = [null, { observation: "缺少定位" }];
  data.inferredPreferences = [
    { title: "偏好", description: "描述", confidence: "低", evidenceRefs: [] },
  ];
  const errors = validateData(data);
  assert.ok(errors.some((item) => item.includes("evidence[0]")));
  assert.ok(errors.some((item) => item.includes("evidence[1].ref")));
  assert.ok(errors.some((item) => item.includes("evidenceRefs")));
});

test("兼容等号与分离式 CLI 参数", () => {
  assert.deepEqual(parseArgs(["--data=a.json", "--output", "b.md", "--force"]), {
    data: "a.json",
    output: "b.md",
    force: true,
    help: false,
  });
});

test("本地时间格式与文件避让规则稳定", () => {
  const date = new Date(2026, 8, 20, 14, 5, 9);
  assert.equal(formatLocalDate(date), "2026-09-20 14:05:09");
  assert.equal(formatLocalDate(date, true), "20260920-140509");

  const missing = path.join(
    __dirname,
    `definitely-missing-${process.pid}-${Date.now()}.md`
  );
  assert.equal(availableOutputPath(missing, date), missing);
});

test("真实写入报告且不会静默覆盖已有文件", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "session-achieve-"));
  const requested = path.join(directory, "review.md");

  try {
    const first = generateReport({ data: validData(), output: requested });
    const second = generateReport({ data: validData(), output: requested });

    assert.equal(first, requested);
    assert.equal(second, path.join(directory, "review-2.md"));
    assert.match(fs.readFileSync(first, "utf8"), /# 会话复盘报告/);
    assert.match(fs.readFileSync(second, "utf8"), /尚未在 Windows 验证/);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
