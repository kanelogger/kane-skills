import assert from "node:assert/strict";
import test from "node:test";

import { applyWechatRenderStyle } from "./md-to-wechat.ts";
import { resolveRenderStyle } from "./wechat-extend-config.ts";

test("applyWechatRenderStyle applies paragraph and line spacing", () => {
  const html = '<section class="container" style="line-height: 1.5;"><p class="p" style="margin: 1em;">正文</p></section>';
  const style = resolveRenderStyle({}, { lineHeight: "1.9", paragraphSpacing: "1.2em 6px" });
  const result = applyWechatRenderStyle(html, style);

  assert.match(result, /line-height: 1\.9;/);
  assert.match(result, /margin: 1\.2em 6px;/);
});

test("applyWechatRenderStyle applies heading and blockquote presets", () => {
  const html = '<h2 class="h2" style="background: blue; color: white;">标题</h2><blockquote style="background: white; border: 0;">引用</blockquote>';
  const style = resolveRenderStyle({}, {
    color: "#123456",
    headingStyle: "underline",
    blockquoteStyle: "border",
  });
  const result = applyWechatRenderStyle(html, style);

  assert.match(result, /border-bottom: 2px solid #123456;/);
  assert.match(result, /color: #123456;/);
  assert.match(result, /border-left: 4px solid #123456;/);
  assert.match(result, /background: transparent;/);
});
