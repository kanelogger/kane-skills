# kane-youtube-transcript

提供一个 YouTube HTTPS 视频链接或 11 位 ID，获取已有字幕并导出 Markdown、SRT、VTT、TXT 或 JSON。不下载视频、不生成 ASR、不改写字幕。

在 Codex 中输入 `$kane-youtube-transcript` 显式调用。

## 使用

可指定语言优先级、人工/自动类型、格式和输出目录。默认 Markdown，优先视频原语言，同一语言优先人工轨；YouTube 机器翻译须明确请求。只有需要查看或确认语言时才运行 `--list`，无需把它作为每次下载的前置步骤。

```bash
bun '<skill-dir>/scripts/main.ts' '<youtube-url-or-id>' --format srt
```

将占位符替换为实际值；完整参数看 `--help`，交互规则见 [SKILL.md](SKILL.md)。

## 依赖与产物

整个技能目录可独立复制。需要 Bun、`curl` 和 `yt-dlp`；没有 `yt-dlp` 时可通过 `uvx` 隔离运行，首次可能联网安装到工具缓存。有 `npx` 而没有 Bun 时可用 `npx -y bun`。

默认新建 `youtube-transcript/<video-id>/<language-code>-<manual|generated>[-translated]/`，保存 `meta.json`、原始 `transcript-raw.json` 和所选格式的 `transcript.*`。JSON 导出的 `startMs`、`durationMs` 单位为毫秒，`text` 为字幕原文。

已有目录不覆盖，请另选 `--output-dir`。失败时非零退出；写入中断可能留下本次部分文件，需换目录重试。

## 限制与隐私

仅处理 YouTube 提供 JSON3 的字幕，仍受权限、地区、反机器人与限流限制。自动字幕可能识别错误，机器翻译不等于人工翻译。

默认不读取浏览器 Cookie；仅明确授权后使用 `--cookies-from-browser`，临时凭据结束时删除、不进入产物。字幕下载仅 HTTPS，最多 5 次重定向，30 秒超时，拒绝非 JSON 响应。
