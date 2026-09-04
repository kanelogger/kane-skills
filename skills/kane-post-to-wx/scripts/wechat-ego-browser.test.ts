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
