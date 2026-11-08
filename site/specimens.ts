export const specimens = [
  {
    id: "kane-bilibili-transcript",
    labels: ["字幕", "Captions"],
    inputName: "raw.json",
    input: '{\n  "from": 1.25,\n  "to": 3.5,\n  "content": "Open the guide."\n}',
    outputName: "transcript.srt",
    output: "1\n00:00:01,250 --> 00:00:03,500\nOpen the guide.",
    captions: ["导出器把已有字幕轨的秒数转成 SRT 时间码，保留原句。", "The exporter converts seconds from an existing track into SRT timestamps and keeps the caption text."],
  },
  {
    id: "kane-url-to-markdown",
    labels: ["网页", "Webpage"],
    inputName: "reader.md",
    input: "# Field notes\n\n[Method](https://example.org)",
    outputName: "field-notes.md",
    output: '---\ntitle: "Field notes"\nsource: "https://example.org/"\n…\n---\n\n# Field notes\n\n[Method](https://example.org)',
    captions: ["保存脚本给正文加上来源元数据，保留原标题和链接。", "The save script adds source metadata and preserves the heading and link."],
  },
  {
    id: "kane-task-retro",
    labels: ["复盘", "Retrospective"],
    inputName: "task-notes.md",
    input: "Goal: update the bilingual catalog.\nResult: both languages shipped.\nRework: a new skill lacked an English label.",
    outputName: "task-retro.md",
    output: "## Finding\nA missing label caused a rebuild.\n\n## Next action\nCheck both labels before committing.\n\n## Verify\nBoth languages ship in one build.",
    captions: ["复盘卡从已知证据提出一个动作，并写清下次怎么验证。", "The retrospective turns task evidence into one action and a check for the next run."],
  },
]
