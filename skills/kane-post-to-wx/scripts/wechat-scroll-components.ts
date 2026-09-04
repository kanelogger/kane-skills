interface SourceImage {
  alt: string;
  originalPath: string;
  placeholder: string;
}

interface ScrollComponentResult {
  markdown: string;
  images: SourceImage[];
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function swipeHint(label: string, color: string): string {
  return `<section style="margin: 18px 8px 8px; text-align: center; line-height: 1.4;"><span style="display: inline-block; padding: 4px 12px; border: 1px solid ${color}; border-radius: 999px; color: ${color}; background: #f5f9ff; font-size: 13px; font-weight: 600; letter-spacing: 0.5px;">← ${label} →</span></section>`;
}

function promptScroller(code: string, color: string): string {
  return [
    '<section data-wx-component="scroll-prompt" style="margin: 0 8px 20px;">',
    swipeHint("滑动查看完整提示词", color),
    '<section style="overflow-x: auto; overflow-y: hidden; width: 100%; border: 1px solid #e5e7eb; border-radius: 10px; background: #f7f8fa; -webkit-overflow-scrolling: touch;">',
    '<pre style="box-sizing: border-box; display: inline-block; min-width: 100%; width: max-content; margin: 0; padding: 16px 18px; color: #24292f; background: transparent; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 13px; line-height: 1.7; text-align: left; white-space: pre; overflow-wrap: normal; word-break: normal;"><code style="white-space: pre;">',
    escapeHtml(code.replace(/\s+$/, "")),
    '</code></pre>',
    '</section>',
    '</section>',
  ].join("");
}

function imageScroller(placeholder: string, color: string): string {
  return [
    '<section data-wx-component="scroll-image" style="margin: 0 8px 20px;">',
    swipeHint("滑动查看长图", color),
    '<section style="overflow-x: auto; overflow-y: hidden; width: 100%; border-radius: 10px; background: #f7f8fa; white-space: nowrap; -webkit-overflow-scrolling: touch;">',
    '<section style="display: inline-block; width: 180%; min-width: 720px; max-width: none; line-height: 0; vertical-align: top;">',
    placeholder,
    '</section>',
    '</section>',
    '</section>',
  ].join("");
}

export function preprocessWechatScrollComponents(
  markdown: string,
  color = "#0b79ff",
): ScrollComponentResult {
  const images: SourceImage[] = [];
  let result = markdown.replace(
    /^```(?:prompt-scroll|prompt)\s*\r?\n([\s\S]*?)^```\s*$/gim,
    (_match, code: string) => promptScroller(code, color),
  );

  result = result.replace(
    /!\[([^\]]*)\]\(([^)\s]+)(?:\s+["'][^"']*["'])?\)/g,
    (match, alt: string, originalPath: string) => {
      if (!/^(?:长图|long[- ]?image)(?:\s*[:：-].*)?$/i.test(alt.trim())) return match;
      const placeholder = `WECHATSCROLLIMGPH_${images.length + 1}`;
      images.push({ alt, originalPath, placeholder });
      return imageScroller(placeholder, color);
    },
  );

  return { markdown: result, images };
}
