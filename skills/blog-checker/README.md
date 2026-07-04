# blog-checker

Review Chinese technical blog posts for argument quality, structure, technical accuracy, evidence, and publish-readiness.

## Use When

- The user asks to review, inspect, or evaluate a Chinese technical article or blog draft.
- The goal is diagnostic feedback rather than rewriting the whole article.
- The review should identify concrete problems, risk level, and revision priorities.

## Output

A structured review using the bundled report template and review dimensions:

```text
assets/report-template.md
references/review-dimensions.md
```

## Install

```bash
./bin/hk-skill install https://github.com/kanelogger/kane-skills --subpath skills/blog-checker
```

## Public Notes

The skill is intended for technical writing. It is not a general copywriting or fiction critique skill.
