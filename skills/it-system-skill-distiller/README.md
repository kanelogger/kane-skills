# it-system-skill-distiller

Distill an existing IT business system, SaaS product, internal tool, or legacy application into an AI-readable skill package.

## Use When

- The user provides requirements, database schema, domain objects, source code, API routes, or legacy system notes.
- The goal is to extract domain semantics, business rules, use-case APIs, schemas, enums, error codes, validation scenarios, and conflict lists.
- The output should become a reusable `distilled/` knowledge package for another agent.

## Output

A structured `distilled/` package validated by bundled scripts:

```text
distilled/
  README.md
  domain/
  api/
  reference/
  validation/
```

Useful scripts:

```text
scripts/init_distilled_package.py
scripts/validate_distilled_package.py
scripts/smoke_agent_run.py
```

## Install

```bash
./bin/hk-skill install https://github.com/kanelogger/kane-skills --subpath skills/it-system-skill-distiller
```

## Public Notes

This public package contains templates, validators, and smoke-test scaffolding only. Do not commit proprietary system exports or client data into the skill package.
