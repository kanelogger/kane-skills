import assert from "node:assert/strict";
import test from "node:test";

import { renderMarkdownDocument } from "baoyu-md";

import { preprocessWechatScrollComponents } from "./wechat-scroll-components.ts";

test("prompt-scroll fences become a labeled horizontal prompt scroller", () => {
  const result = preprocessWechatScrollComponents("```prompt-scroll\nDo <this> & keep one long line\n```", "#123456");

  assert.match(result.markdown, /滑动查看完整提示词/);
  assert.match(result.markdown, /overflow-x: auto/);
  assert.match(result.markdown, /white-space: pre/);
  assert.match(result.markdown, /Do &lt;this&gt; &amp; keep one long line/);
  assert.match(result.markdown, /#123456/);
});

test("images whose alt starts with 长图 become labeled wide image scrollers", () => {
  const result = preprocessWechatScrollComponents("![长图：完整架构](./images/architecture.png)");

  assert.match(result.markdown, /滑动查看长图/);
  assert.match(result.markdown, /width: 180%/);
  assert.match(result.markdown, /WECHATSCROLLIMGPH_1/);
  assert.deepEqual(result.images, [{
    alt: "长图：完整架构",
    originalPath: "./images/architecture.png",
    placeholder: "WECHATSCROLLIMGPH_1",
  }]);
});

test("ordinary code fences and images are unchanged", () => {
  const markdown = "```ts\nconst value = 1\n```\n\n![普通图片](./image.png)";
  const result = preprocessWechatScrollComponents(markdown);

  assert.equal(result.markdown, markdown);
  assert.deepEqual(result.images, []);
});

test("scroll components survive the WeChat markdown renderer", async () => {
  const source = "```prompt-scroll\nKeep <xml> on one line\n```\n\n![长图：流程](./flow.png)";
  const prepared = preprocessWechatScrollComponents(source);
  const rendered = await renderMarkdownDocument(prepared.markdown, {
    keepTitle: false,
    theme: "default",
  });

  assert.match(rendered.html, /data-wx-component="scroll-prompt"/);
  assert.match(rendered.html, /data-wx-component="scroll-image"/);
  assert.match(rendered.html, /Keep &lt;xml&gt; on one line/);
  assert.match(rendered.html, /WECHATSCROLLIMGPH_1/);
});
