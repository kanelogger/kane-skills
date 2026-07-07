# prompt-optimizer

Compile vague, raw, or under-specified requirements into copy-ready prompts.

## Use When

- The user asks to optimize or write a prompt.
- The task needs a reusable prompt for another model or agent.
- The requirements are complex enough to need explicit context, constraints, success criteria, and output contract.

## Output

- Simple tasks: a Markdown prompt using `assets/simple-prompt.md`.
- Complex tasks: a structured XML prompt using `assets/complex-prompt.xml`.
- The final prompt is saved as a file instead of only being pasted into chat.

## Public Notes

This skill is self-contained. It should not depend on local registry state, adapted mirrors, or private project paths.

