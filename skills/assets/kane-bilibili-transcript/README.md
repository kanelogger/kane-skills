# kane-bilibili-transcript

用 B 站普通视频链接、`b23.tv` 短链、BV 号或 av 号导出已有字幕。默认取 P1，优先人工轨，导出带时间轴的 Markdown。

## 使用

请 Agent 使用 `kane-bilibili-transcript`，或复制技能目录后用 Bun 运行。以下命令导出 P2 的 SRT。

```bash
bun '<skill-dir>/scripts/main.ts' 'https://www.bilibili.com/video/<BV>/?p=2' --format srt
```

用 `--list` 查看轨道，用 `--languages zh-Hans,zh,en-US` 按顺序匹配语言代码。精确代码优先，`zh` 也可匹配 `ai-zh`。其它参数见 `--help`。

字幕包默认写入 `bilibili-transcript/<BV>/p<分P>/<语言>-<类型>/`，包含 `meta.json`、B 站原始字幕 `transcript-raw.json` 和 `transcript.<md|srt|vtt|txt|json>`。JSON 导出的 `startMs` 和 `durationMs` 使用毫秒。可用 `--output-dir` 指定新目录。

遇到登录限制时，使用 ego lite 或 browser-skill 复用 B 站会话。凭据留在浏览器。[浏览器登录流程](references/browser-login.md)

字幕获取流程参考 [SubBatch 源码](https://github.com/itchaox/SubBatch/blob/main/background.js)。交付结构沿用本仓库的 YouTube 字幕技能。
