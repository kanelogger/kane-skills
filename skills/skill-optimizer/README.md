# skill-optimizer

Audit, evaluate, and improve Agent Skills through intent diagnosis, eval design, mutation policy, and self-training protocols.

## Use When

- The user wants to optimize a Skill, improve `SKILL.md`, stress-test behavior, tune trigger descriptions, or design eval plans.
- The target artifact is an Agent Skill rather than an ordinary prompt, blog post, or code module.
- The work needs a repeatable workflow with checkpoints, deterministic scripts, and human-auditable gates.

## Output

Depending on the route, the skill can produce:

```text
audit reports
eval plans
description trigger evals
mutation proposals
self-training workspace plans
final optimization reports
```

Bundled scripts support deterministic checks, eval generation, gate decisions, checkpoints, restore, and iteration.

## Install

```bash
./bin/hk-skill install https://github.com/kanelogger/kane-skills --subpath skills/skill-optimizer
```

## Public Notes

Generated runtime directories such as `logs/`, `runs/`, `checkpoints/`, and restore backups should be created in a working directory, not committed into this public package.
