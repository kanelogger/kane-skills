# request-refactor-plan

Turn an under-specified refactor request into a small-commit refactor plan that can be filed as a GitHub issue.

## Use When

- The user wants to plan a refactor before implementation.
- The refactor needs to be split into safe, reviewable increments.
- The deliverable should be a concrete issue/RFC rather than immediate code changes.

## Output

A refactor plan with:

```text
problem statement
scope and non-goals
risk map
ordered tiny commits
validation plan
GitHub issue body
```

## Install

```bash
./bin/hk-skill install https://github.com/kanelogger/kane-skills --subpath skills/request-refactor-plan
```

## Public Notes

This skill plans refactors. It should not start editing code unless the user separately asks for implementation.
