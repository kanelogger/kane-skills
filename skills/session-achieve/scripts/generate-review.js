#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const LEVELS = new Set(["已达成", "部分达成", "未达成", "无法判断"]);

function parseArgs(argv = process.argv.slice(2)) {
  const options = { data: null, output: null, force: false, help: false };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--force") {
      options.force = true;
    } else if (arg === "--help" || arg === "-h") {
      options.help = true;
    } else if (arg === "--data" || arg === "--output") {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) {
        throw new Error(`${arg} 缺少参数值。`);
      }
      options[arg.slice(2)] = value;
      index += 1;
    } else if (arg.startsWith("--data=")) {
      options.data = arg.slice("--data=".length);
    } else if (arg.startsWith("--output=")) {
      options.output = arg.slice("--output=".length);
    } else {
      throw new Error(`未知参数：${arg}`);
    }
  }

  return options;
}

function usage() {
  return [
    "用法：",
    "  node scripts/generate-review.js --data review-data.json [--output report.md] [--force]",
    "",
    "未指定 --output 时，报告写入当前工作目录。",
    "默认不覆盖已有文件；--force 允许覆盖指定路径。",
  ].join("\n");
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function formatLocalDate(date = new Date(), compact = false) {
  const day = `${date.getFullYear()}${compact ? "" : "-"}${pad(date.getMonth() + 1)}${compact ? "" : "-"}${pad(date.getDate())}`;
  const time = `${pad(date.getHours())}${compact ? "" : ":"}${pad(date.getMinutes())}${compact ? "" : ":"}${pad(date.getSeconds())}`;
  return `${day}${compact ? "-" : " "}${time}`;
}

function loadData(dataPath) {
  if (!dataPath) {
    throw new Error("必须提供 --data。");
  }

  const resolved = path.resolve(dataPath);
  let content;
  try {
    content = fs.readFileSync(resolved, "utf8");
  } catch (error) {
    throw new Error(`无法读取数据文件 ${resolved}：${error.message}`);
  }

  try {
    return JSON.parse(content);
  } catch (error) {
    throw new Error(`数据文件不是有效 JSON：${error.message}`);
  }
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function validateData(data) {
  const errors = [];

  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return ["顶层数据必须是 JSON 对象。"];
  }

  for (const field of ["scope", "originalGoal", "finalOutcome"]) {
    if (!isNonEmptyString(data[field])) {
      errors.push(`${field} 必须是非空字符串。`);
    }
  }

  if (!data.assessment || typeof data.assessment !== "object" || Array.isArray(data.assessment)) {
    errors.push("assessment 必须是对象。");
  } else {
    if (!LEVELS.has(data.assessment.level)) {
      errors.push("assessment.level 必须是：已达成、部分达成、未达成、无法判断。");
    }
    if (!isNonEmptyString(data.assessment.rationale)) {
      errors.push("assessment.rationale 必须是非空字符串。");
    }
    if (
      data.assessment.rate !== undefined &&
      (typeof data.assessment.rate !== "number" ||
        !Number.isFinite(data.assessment.rate) ||
        data.assessment.rate < 0 ||
        data.assessment.rate > 100)
    ) {
      errors.push("assessment.rate 必须是 0–100 的数字。");
    }
    if (data.assessment.verification !== undefined && !Array.isArray(data.assessment.verification)) {
      errors.push("assessment.verification 必须是数组。");
    }
  }

  if (
    data.turns !== undefined &&
    (!Number.isInteger(data.turns) || data.turns < 0)
  ) {
    errors.push("turns 必须是非负整数。");
  }

  for (const field of [
    "evidence",
    "corrections",
    "explicitConstraints",
    "inferredPreferences",
    "unknowns",
  ]) {
    if (data[field] !== undefined && !Array.isArray(data[field])) {
      errors.push(`${field} 必须是数组。`);
    }
  }

  if (Array.isArray(data.assessment?.verification)) {
    data.assessment.verification.forEach((item, index) => {
      if (!isNonEmptyString(item)) {
        errors.push(`assessment.verification[${index}] 必须是非空字符串。`);
      }
    });
  }

  if (Array.isArray(data.evidence)) {
    data.evidence.forEach((item, index) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        errors.push(`evidence[${index}] 必须是对象。`);
        return;
      }
      for (const field of ["ref", "observation"]) {
        if (!isNonEmptyString(item[field])) {
          errors.push(`evidence[${index}].${field} 必须是非空字符串。`);
        }
      }
    });
  }

  if (Array.isArray(data.corrections)) {
    data.corrections.forEach((item, index) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        errors.push(`corrections[${index}] 必须是对象。`);
        return;
      }
      for (const field of ["ref", "deviation", "instruction", "action"]) {
        if (!isNonEmptyString(item[field])) {
          errors.push(`corrections[${index}].${field} 必须是非空字符串。`);
        }
      }
    });
  }

  if (Array.isArray(data.explicitConstraints)) {
    data.explicitConstraints.forEach((item, index) => {
      const validString = isNonEmptyString(item);
      const validObject =
        item &&
        typeof item === "object" &&
        !Array.isArray(item) &&
        isNonEmptyString(item.title) &&
        isNonEmptyString(item.description);
      if (!validString && !validObject) {
        errors.push(
          `explicitConstraints[${index}] 必须是非空字符串，或包含 title 和 description 的对象。`
        );
      }
    });
  }

  if (Array.isArray(data.inferredPreferences)) {
    data.inferredPreferences.forEach((item, index) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        errors.push(`inferredPreferences[${index}] 必须是对象。`);
        return;
      }
      for (const field of ["title", "description", "confidence"]) {
        if (!isNonEmptyString(item[field])) {
          errors.push(`inferredPreferences[${index}].${field} 必须是非空字符串。`);
        }
      }
      if (
        !Array.isArray(item.evidenceRefs) ||
        item.evidenceRefs.length === 0 ||
        item.evidenceRefs.some((ref) => !isNonEmptyString(ref))
      ) {
        errors.push(
          `inferredPreferences[${index}].evidenceRefs 必须是非空字符串数组。`
        );
      }
    });
  }

  if (Array.isArray(data.unknowns)) {
    data.unknowns.forEach((item, index) => {
      if (!isNonEmptyString(item)) {
        errors.push(`unknowns[${index}] 必须是非空字符串。`);
      }
    });
  }

  if (
    data.summary !== undefined &&
    (!data.summary || typeof data.summary !== "object" || Array.isArray(data.summary))
  ) {
    errors.push("summary 必须是对象。");
  }

  return errors;
}

function text(value, fallback = "未提供") {
  if (value === undefined || value === null || String(value).trim() === "") {
    return fallback;
  }
  return String(value).trim();
}

function quote(value) {
  return text(value)
    .split("\n")
    .map((line) => `> ${line}`)
    .join("\n");
}

function bulletList(items, emptyMessage) {
  if (!Array.isArray(items) || items.length === 0) {
    return `- ${emptyMessage}`;
  }

  return items
    .map((item) => {
      if (typeof item === "string") {
        return `- ${text(item)}`;
      }
      const title = text(item.title, "未命名");
      return `- **${title}：** ${text(item.description)}`;
    })
    .join("\n");
}

function formatAssessment(assessment) {
  const rate =
    typeof assessment.rate === "number" ? `（${assessment.rate}%）` : "";
  return `**${assessment.level}${rate}**\n\n${text(assessment.rationale)}`;
}

function formatEvidence(items) {
  if (!Array.isArray(items) || items.length === 0) {
    return "> 未发现需要单列的关键证据。";
  }

  return items
    .map((item, index) => {
      const lines = [
        `${index + 1}. **${text(item.ref, "位置未标注")} · ${text(item.type, "证据")}**`,
        `   - **观察：** ${text(item.observation)}`,
      ];
      if (isNonEmptyString(item.response)) {
        lines.push(`   - **响应：** ${text(item.response)}`);
      }
      if (isNonEmptyString(item.resolution)) {
        lines.push(`   - **状态：** ${text(item.resolution)}`);
      }
      return lines.join("\n");
    })
    .join("\n\n");
}

function formatCorrections(items) {
  if (!Array.isArray(items) || items.length === 0) {
    return "> 未发现改变任务方向、约束或验收结果的纠偏。";
  }

  return items
    .map((item, index) =>
      [
        `${index + 1}. **${text(item.ref, "位置未标注")}**`,
        `   - **原偏差：** ${text(item.deviation)}`,
        `   - **新约束：** ${text(item.instruction)}`,
        `   - **调整动作：** ${text(item.action)}`,
        `   - **结果：** ${text(item.result, "尚未验证")}`,
      ].join("\n")
    )
    .join("\n\n");
}

function formatPreferences(items) {
  if (!Array.isArray(items) || items.length === 0) {
    return "> 未发现可可靠推断的长期偏好。";
  }

  return items
    .map((item, index) => {
      const refs =
        Array.isArray(item.evidenceRefs) && item.evidenceRefs.length > 0
          ? item.evidenceRefs.join("、")
          : "未标注";
      return [
        `${index + 1}. **${text(item.title, "未命名偏好")}**`,
        `   - **说明：** ${text(item.description)}`,
        `   - **证据：** ${refs}`,
        `   - **置信度：** ${text(item.confidence, "未评估")}`,
      ].join("\n");
    })
    .join("\n\n");
}

function formatReusablePrompt(data) {
  if (!isNonEmptyString(data.reusablePrompt)) {
    return `> 不生成：${text(data.reusablePromptReason, "本次任务的复用价值或证据不足。")}`;
  }

  const reason = isNonEmptyString(data.reusablePromptReason)
    ? `\n\n**生成理由：** ${text(data.reusablePromptReason)}`
    : "";
  return `${quote(data.reusablePrompt)}${reason}`;
}

function formatSummary(summary) {
  if (!summary || typeof summary !== "object" || Array.isArray(summary)) {
    return "- **关键发现：** 未提供\n- **主要教训：** 未提供\n- **适用范围：** 未提供";
  }

  return [
    `- **关键发现：** ${text(summary.keyInsight)}`,
    `- **主要教训：** ${text(summary.lesson)}`,
    `- **适用范围：** ${text(summary.reusability)}`,
  ].join("\n");
}

function fillTemplate(template, data, now = new Date()) {
  const validationErrors = validateData(data);
  if (validationErrors.length > 0) {
    throw new Error(`复盘数据校验失败：\n- ${validationErrors.join("\n- ")}`);
  }

  const replacements = {
    REPORT_TIME: text(data.reportTime, formatLocalDate(now)),
    SCOPE: text(data.scope),
    STATUS: text(data.status, "未说明"),
    TURNS: data.turns === undefined ? "未知" : String(data.turns),
    ORIGINAL_GOAL: quote(data.originalGoal),
    FINAL_OUTCOME: quote(data.finalOutcome),
    ASSESSMENT: formatAssessment(data.assessment),
    VERIFICATION: bulletList(data.assessment.verification, "未提供独立验证证据。"),
    EVIDENCE: formatEvidence(data.evidence),
    CORRECTIONS: formatCorrections(data.corrections),
    EXPLICIT_CONSTRAINTS: bulletList(data.explicitConstraints, "未发现额外明确约束。"),
    INFERRED_PREFERENCES: formatPreferences(data.inferredPreferences),
    UNKNOWNS: bulletList(data.unknowns, "无。"),
    REUSABLE_PROMPT: formatReusablePrompt(data),
    SUMMARY: formatSummary(data.summary),
  };

  let result = template;
  for (const [token, value] of Object.entries(replacements)) {
    result = result.replaceAll(`{{${token}}}`, value);
  }

  const unresolved = Object.keys(replacements)
    .map((token) => `{{${token}}}`)
    .filter((token) => result.includes(token));
  if (unresolved.length > 0) {
    throw new Error(`模板包含未解析占位符：${unresolved.join("、")}`);
  }

  return `${result.trimEnd()}\n`;
}

function availableOutputPath(requestedPath, now, force = false) {
  const initial = path.resolve(
    requestedPath || `achieved-${formatLocalDate(now, true)}.md`
  );

  if (force || !fs.existsSync(initial)) {
    return initial;
  }

  const directory = path.dirname(initial);
  const extension = path.extname(initial);
  const base = path.basename(initial, extension);
  let suffix = 2;
  let candidate;
  do {
    candidate = path.join(directory, `${base}-${suffix}${extension}`);
    suffix += 1;
  } while (fs.existsSync(candidate));
  return candidate;
}

function generateReport({ data, output, force = false, now = new Date() }) {
  const templatePath = path.join(__dirname, "..", "assets", "achieved_template.md");
  const template = fs.readFileSync(templatePath, "utf8");
  const content = fillTemplate(template, data, now);
  const outputPath = availableOutputPath(output, now, force);

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, content, { encoding: "utf8", flag: force ? "w" : "wx" });
  return outputPath;
}

function main() {
  try {
    const options = parseArgs();
    if (options.help) {
      console.log(usage());
      return;
    }
    const data = loadData(options.data);
    const outputPath = generateReport({
      data,
      output: options.output,
      force: options.force,
    });
    console.log(`复盘报告已生成：${outputPath}`);
  } catch (error) {
    console.error(error.message);
    console.error("");
    console.error(usage());
    process.exitCode = 1;
  }
}

module.exports = {
  availableOutputPath,
  fillTemplate,
  formatLocalDate,
  generateReport,
  parseArgs,
  validateData,
};

if (require.main === module) {
  main();
}
