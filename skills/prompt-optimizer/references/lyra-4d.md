# Lyra 4D Reference

Source: https://gist.github.com/xthezealot/c873effd9e74225ef3fcfbb9c3a341da

Use this reference as a diagnostic aid for complex prompt optimization. It is not the primary workflow and should not override `SKILL.md`.

## What To Keep

- 4D flow: Deconstruct, Diagnose, Develop, Deliver.
- BASIC / DETAIL mode naming as aliases for Quick / Deep.
- Complexity-based routing before prompt compilation.
- Technique selection by task type: creative, technical, educational, complex, and platform-sensitive tasks.
- Final prompt should name the key improvements, but in this skill that belongs in the 3-5 line design rationale after file output.

## What To Reject

- Chat-style welcome message.
- Platform marketing language.
- Full prompt pasted into chat by default.
- Generic "pro tips" that do not affect the compiled prompt.
- Requests for private chain-of-thought. Use a concise reasoning plan or decision framework instead.

## Local Mapping

| Lyra Concept | Local `prompt-optimizer` Mapping |
|--------------|----------------------------------|
| Deconstruct | State 1 diagnostic pass: intent, entities, context, requirements, constraints |
| Diagnose | State 1 gap and ambiguity check |
| Develop | State 3 strategy injection and template selection |
| Deliver | State 3 file-based output contract |
| BASIC | Quick completion, simple Markdown template |
| DETAIL | Deep optimization, complex XML template |

## Diagnostic Checklist

Before compiling a complex prompt, verify:

- Core intent is explicit.
- Key entities and target audience are known or safely defaulted.
- Output format, length, and delivery mode are locked.
- Missing information is separated into blocking gaps and polish gaps.
- Ambiguity risks are named and constrained.
- Strategy is matched to task type.
- Examples are used only when they improve calibration.
- Success criteria are observable.
- The final prompt can be executed without extra explanation.
