# session-achieve

Review a multi-turn conversation, extract correction patterns, and distill reusable high-quality prompts.

## Use When

- The user asks for 对话复盘, session review, review this session, or 生成复盘报告.
- The conversation contains repeated steering, corrections, workflow preferences, or prompt patterns worth preserving.
- The output should separate what happened from what should be reused next time.

## Output

A session review generated with:

```text
assets/achieved_template.md
references/few_shot_example.md
scripts/generate-review.js
```

## Public Notes

Do not include private transcripts in this repository. Use the skill on user-provided conversation context at runtime.
