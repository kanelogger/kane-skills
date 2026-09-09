import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const script = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "wechat-ego-browser.ts"), "utf8");

test("ego-browser publishing uses isolated task spaces and explicit login handoff", () => {
  assert.match(script, /useOrCreateTaskSpace/);
  assert.match(script, /handOffTaskSpace/);
  assert.match(script, /takeOverTaskSpace/);
  assert.match(script, /completeTaskSpace/);
});

test("ego-browser publishing verifies content and saved draft state", () => {
  assert.match(script, /Article verification failed/);
  assert.match(script, /Draft save did not complete/);
  assert.match(script, /appmsgid/);
  assert.match(script, /uploadFile/);
  assert.match(script, /result\.stdout.*result\.stderr/s);
});

test("ego-browser publishing fails on unknown CLI options", () => {
  assert.match(script, /Unknown option/);
});

test("resumed publishing keeps the requested task-space id", () => {
  assert.match(script, /const taskSpaceId = task\?\.id \?\? payload\.taskSpace/);
  assert.match(script, /handOffTaskSpace\(taskSpaceId\)/);
  assert.match(script, /taskSpaceId, appmsgid/);
});

test("browser publishing avoids stale editor tabs and retries form races", () => {
  assert.match(script, /chooseEditorTab\(previousTabs\)/);
  assert.match(script, /const fresh = candidates\.filter/);
  assert.match(script, /findExistingEditorTab/);
  assert.match(script, /for \(let attempt = 0; attempt < 5; attempt\+\+\)/);
});

test("task-space cleanup tolerates helpers without a returned task object", () => {
  assert.match(script, /const taskId = task\?\.id \?\?/);
});
