---
name: git-commit-push
description: Safely publish the current task's local Git changes by staging only related files, generating a Conventional Commits 1.0.0 message from the staged diff, committing, and pushing the current branch. Use when the user asks to commit, submit, publish, or push completed work, or explicitly requests git add, git commit, and git push as one workflow.
---

# Git Commit Push

Publish one coherent task as one auditable commit. Treat the staged diff as the exact commit boundary.

## Guardrails

- Preserve pre-existing and unrelated changes. Never discard, overwrite, restore, stash, or include them.
- Stage explicit paths only. Never use `git add .`, `git add -A`, `git add --all`, or a broad glob.
- Do not amend, rebase, force-push, bypass hooks, or change branches unless the user explicitly requests it.
- Never commit secrets, credentials, private keys, environment files, build output, or other likely generated artifacts. Stop and report the paths when detected.
- Stop before committing if the intended file set is ambiguous or the staged diff contains unrelated changes.
- Stop before pushing when the branch, remote, or upstream cannot be determined safely.

## Workflow

### 1. Establish Repository State

Run:

```sh
git status --short --branch
git diff --name-status
git diff
git diff --cached --name-status
git diff --cached
```

Identify the files created or modified for the current task from the conversation and actual diff. Account for both tracked and untracked files. Because `git diff` omits untracked contents, inspect each candidate untracked file directly before staging it. If the repository already contains staged changes, include them only when they belong to the current task; otherwise stop rather than altering another commit boundary.

### 2. Stage the Task Boundary

Stage only the confirmed paths:

```sh
git add -- path/to/file path/to/other-file
```

Use `git add -p -- path/to/file` when a file mixes related and unrelated hunks. Do not stage deletions unless the task requires them and the diff confirms their scope.

Review the exact commit candidate:

```sh
git diff --cached --name-status
git diff --cached --stat
git diff --cached
```

Require a non-empty staged diff. Confirm every staged path and hunk belongs to one coherent task.

### 3. Generate the Commit Message

Generate the message strictly from `git diff --cached`, using this exact prompt. Replace the placeholder with the complete staged diff:

```text
你是一位严格遵守 Conventional Commits 1.0.0 规范的提交信息写手。
请根据下面的 git diff 输出，生成一条 commit message，要求：

1. 第一行格式：type(scope): description
   - type 只能从 feat/fix/docs/refactor/perf/test/chore 中选择
   - description 用祈使句（如 "add" 而非 "added"），不超过 50 个字符
2. 空一行，正文说明"为什么"做这个改动（动机、约束、权衡），不要复述 diff 里的代码内容（那是 What，diff 自己已经写了）
3. 若存在破坏性变更，正文后加 footer: BREAKING CHANGE: <说明>
4. 严格基于 diff 内容，不虚构 diff 中不存在的信息
5. 只输出 commit message 本身，不要任何解释

<diff>
{粘贴 git diff --cached 的输出}
</diff>
```

Use only rationale inferable from the changed tests, documentation, behavior, or configuration. Do not invent issue numbers, user impact, performance claims, or intent. If the diff provides no evidence for why the change exists, stop before committing and report that the required body cannot be written without violating the no-invention rule.

Validate the result before committing:

- Header matches `^(feat|fix|docs|refactor|perf|test|chore)\([^)]+\): .+`.
- Description is imperative and at most 50 characters.
- Body follows one blank line and explains why without unsupported claims.
- A breaking footer appears only when the staged diff demonstrates a breaking change.

### 4. Commit

Pass the subject and body as separate message arguments so the shell does not open an editor:

```sh
git commit -m "type(scope): description" -m "Why this change is needed."
```

Add a third `-m` argument for a `BREAKING CHANGE:` footer when required. Preserve repository hooks; never add `--no-verify` without explicit user authorization.

If a hook fails, report the failure and leave the commit uncreated. Fix it only when the fix is within the user's task scope.

### 5. Verify and Push

After committing, run:

```sh
git status --short --branch
git log -1 --format=fuller
git show --format=fuller --stat --patch HEAD
git branch --show-current
git rev-parse --abbrev-ref --symbolic-full-name '@{upstream}'
```

Confirm `HEAD` contains the intended staged diff. A dirty worktree is acceptable only when remaining changes are unrelated and preserved.

Push the current branch to its configured upstream:

```sh
git push
```

When no upstream exists, inspect `git remote -v`. Use `git push -u <remote> <branch>` only when one destination is clearly implied by repository state or the user; otherwise stop for direction. Never use `--force` or `--force-with-lease` unless explicitly requested.

Verify the push result with `git status --short --branch`. Report the commit hash, subject, pushed branch and remote, committed paths, verification result, and any preserved unrelated changes.
