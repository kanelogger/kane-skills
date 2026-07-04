# skill-evaluator

Build a runtime evaluation system for Agent Skills, including test cases, scoring rules, baselines, runs, and analysis reports.

## Use When

- The user asks to evaluate a skill, 给这个 Skill 建测评, run regression tests, or compare model behavior on one skill.
- The target skill needs objective gates beyond a casual read-through.
- The output should support CI-style regression review or repeatable manual evaluation.

## Output

Evaluation artifacts based on bundled dimensions and templates:

```text
references/evaluation-dimensions.md
references/templates/eval-plan-template.md
references/templates/scoring-config-template.yaml
references/templates/test-case-template.yaml
references/templates/report-structure.md
```

## Install

```bash
./bin/hk-skill install https://github.com/kanelogger/kane-skills --subpath skills/skill-evaluator
```

## Public Notes

This skill evaluates runtime behavior. Use `skill-optimizer` when the goal is to rewrite or improve the skill itself.
