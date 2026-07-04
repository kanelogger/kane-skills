#!/usr/bin/env bun
/**
 * Session Review Report Generator
 *
 * Usage:
 *   bun run scripts/generate-review.js --data=review-data.json
 *
 * Reads assets/achieved_template.md and generates a populated review report.
 * Expects a JSON data file with the following structure:
 * {
 *   "reportTime": "2024-01-15 14:30:00",
 *   "turns": 12,
 *   "achievementRate": 75,
 *   "originalGoal": "...",
 *   "evaluation": "...",
 *   "errors": [...],
 *   "corrections": [...],
 *   "promptAnalysis": "...",
 *   "missingConstraints": [...],
 *   "implicitConstraints": [...],
 *   "goldenPrompt": "...",
 *   "summary": "..."
 * }
 */

import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    data: null,
    output: `achieved-${new Date().toISOString().slice(0, 19).replace(/[T:]/g, "-")}.md`,
  };

  for (const arg of args) {
    if (arg.startsWith("--data=")) {
      options.data = arg.split("=")[1];
    } else if (arg.startsWith("--output=")) {
      options.output = arg.split("=")[1];
    }
  }

  return options;
}

function loadReviewData(dataPath) {
  if (!dataPath) {
    console.error("Error: --data flag is required. Provide a JSON file with review data.");
    process.exit(1);
  }

  try {
    const content = readFileSync(dataPath, "utf-8");
    return JSON.parse(content);
  } catch (err) {
    console.error(`Error reading or parsing data file: ${err.message}`);
    process.exit(1);
  }
}

function formatErrors(errors) {
  if (!errors || errors.length === 0) {
    return "> 本次对话中未发现明显事实性错误或理解偏差。";
  }

  return errors
    .map((e) => `| ${e.turn} | ${e.type} | ${e.description} | ${e.userResponse} |`)
    .join("\n");
}

function formatCorrections(corrections) {
  if (!corrections || corrections.length === 0) {
    return "> 本次对话中未发现明显偏差。";
  }

  return corrections
    .map(
      (c, i) =>
        `${i + 1}. **轮次 ${c.turn}：**\n   - **偏差描述：** ${c.deviation}\n   - **用户修正指令：** ${c.userInstruction}\n   - **AI 调整动作：** ${c.aiAction}`
    )
    .join("\n\n");
}

function formatList(items) {
  if (!items || items.length === 0) {
    return "> 未提取到相关内容。";
  }

  return items.map((item, i) => `${i + 1}. **${item.title}：** ${item.description}`).join("\n");
}

function fillTemplate(template, data) {
  const now = new Date();

  const replacements = {
    "{YYYY-MM-DD HH:MM:SS}": data.reportTime || now.toISOString().slice(0, 19).replace("T", " "),
    "{N}": String(data.turns || "未知"),
    "[XX]": String(data.achievementRate ?? "待评估"),
    "[一句话总结用户最初的核心目标]": data.originalGoal || "[待确认]",
    "[对比最终产出与初始目标，给出达成度评估]": data.evaluation || "[待确认]",
    "| [N] | [事实错误/理解偏差/幻觉] | [具体描述] | [用户如何纠正] |": formatErrors(data.errors),
    "[AI 产出了什么不符合预期的内容]": data.corrections?.[0]?.deviation || "[待确认]",
    "[用户说了什么来调整]": data.corrections?.[0]?.userInstruction || "[待确认]",
    "[AI 如何修改]": data.corrections?.[0]?.aiAction || "[待确认]",
    "[AI 总结：用户在哪些方面频繁纠偏？]": data.correctionPattern || "[待确认]",
    "[AI 分析用户的初始指令，指出遗漏和模糊点]": data.promptAnalysis || "[待确认]",
    "[具体约束]": data.missingConstraints?.[0]?.description || "[待确认]",
    "[描述]": data.implicitConstraints?.[0]?.description || "[待确认]",
    "[整合了本次复盘所有经验的完美提示词。补全遗漏约束、明确模糊需求、预设用户偏好。]":
      data.goldenPrompt || "[待确认]",
    "[从本次对话中学到的关于用户需求的最重要一点]": data.summary?.keyInsight || "[待确认]",
    "[如果重新开始，应该避免什么]": data.summary?.lesson || "[待确认]",
    "[本次沉淀的黄金提示词适用于哪些类似场景]": data.summary?.reusability || "[待确认]",
    "[用户可在此修正 AI 的理解偏差]": "",
    "[用户可补充自己的验证标准或修正 AI 的评估]": "",
    "[用户可补充 AI 未识别到的错误，或修正错误描述]": "",
    "[用户可补充或修正纠偏记录]": "",
    "[用户可说明真实意图，帮助 AI 更准确理解]": "",
    "[用户可编辑此提示词，使其成为真正可复用的模板]": "",
    "[用户可添加自己的复盘感悟]": "",
  };

  let result = template;
  for (const [placeholder, value] of Object.entries(replacements)) {
    result = result.replaceAll(placeholder, value);
  }

  result = result.replace(/\[待确认\]/g, "_[待确认]_");

  return result;
}

function main() {
  const options = parseArgs();
  const reviewData = loadReviewData(options.data);

  const templatePath = join(import.meta.dir, "..", "assets", "achieved_template.md");
  const template = readFileSync(templatePath, "utf-8");

  const content = fillTemplate(template, reviewData);

  writeFileSync(options.output, content, "utf-8");
  console.log(`Review report generated: ${options.output}`);
}

main();
