# concept-fable

Create high-density Chinese explanatory fables that hide an advanced concept inside a three-stage story, then reveal and map the theory.

## Use When

- The user asks for a concept fable, 三段式寓言, or story-based concept explanation.
- The topic is a field or domain where a real advanced concept can be extracted and taught indirectly.
- The final answer should include the story, concept reveal, theory mapping, misleading intuition, boundaries, controversy, confidence, and reading directions.

## Output

A Chinese Markdown response, defaulting to smart non-specialist readers and 1500–2500 Chinese characters in total. User-specified audience and length override these defaults. The response uses:

```text
# 寓言正文
# Concept Reveal
# 理论映射解析
# 误导性直觉
# 适用边界与争议
# 置信度与依据
# 延伸阅读方向
```

The confidence section includes verification sources actually consulted, or an explicit `未进行外部检索` disclosure.

## Usage

```text
用 $concept-fable 写一篇分布式系统领域的三段式概念寓言，面向非专业读者，全文 2000 字。
```

[`SKILL.md`](SKILL.md) is the authoritative, self-contained source for this workflow. Maintain its inputs, story requirements, verification rules, and output contract here; no prompt-library copy is required.

## Public Notes

This skill is self-contained and does not require bundled scripts or private examples.
