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
- Check for sensitive information before every commit. Suspected secrets, credentials, private keys, or environment files require explicit user approval for the reviewed content under the sensitive-information gate below.
- Never commit build output or other likely generated artifacts.
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

#### Sensitive-Information Gate (Required Before Commit)

`git status` lists paths and states, not file contents. Never treat a clean-looking status list or diff summary as a sensitive-information check.

- Inspect the candidate tracked changes and untracked file contents before staging, then check the exact staged diff and full staged versions of added or modified files (for example, `git show :path/to/file`). The index may differ from the working tree. Include staged changes that existed before this workflow; exclude unrelated unstaged files from this commit's approval scope.
- Look for API keys, access/refresh tokens, passwords, login/account credentials, private keys, connection strings with credentials, and sensitive personal account information. Check suspicious filenames such as `.env`, `.env.*`, credential files, and key files as well as values embedded in code, configuration, documentation, fixtures, and URLs. A variable name alone or an obvious placeholder is not evidence of a real secret; unresolved cases remain suspected findings.
- Use an available local secret scanner with redacted output to supplement inspection. Do not install tools or upload contents to an external service just to scan. A missing scanner does not waive inspection; if any candidate content cannot be inspected, report that gap and require approval as an unresolved finding. Do not claim that a scan proves the absence of secrets.
- When there are no findings or inspection gaps, continue without an extra confirmation. Otherwise, finish reviewing the candidate and present only file paths, line numbers when available, finding types, and the risk of storing the data in Git history and publishing it to the push destination. Never echo sensitive values in the question, commit message, or final report. Attribute the confirmation requirement to this section and link this `SKILL.md`.
- Ask one direct question in the user's language, for example: “本次待提交内容中发现疑似敏感信息：<路径、行号和类型，不含原值>。提交会将其写入 Git 历史，并在推送时发布到远端。是否仍要提交这些内容并继续本次推送？” If the request is commit-only, omit the push wording and do not expand its scope.
- An explicit yes authorizes the reviewed candidate and requested publication scope. A prior generic “commit/push everything” instruction is not approval of newly discovered findings; reuse prior approval only if it already covers the same findings, content, and destination. If the user declines, cancel the commit/push workflow. If no answer or an ambiguous answer is received, pause without committing or pushing. Preserve the working tree and index; do not silently remove findings, unstage files, or create a partial commit.
- Immediately before `git commit`, verify that the staged content still matches the inspected candidate. If it changed, repeat the check; request approval again only for findings or publication scope not covered by existing approval.

### 3. Determine the Commit Message Language

Choose the natural language for the commit description and body in this order:

1. An explicit language requested by the user for the current commit.
2. A repository-specific commit convention documented in files such as `CONTRIBUTING.md`.
3. The dominant natural language in the latest 20 non-merge commits, inspected with `git log -20 --no-merges --format='%s%n%b'`. Use it only when at least 60% of commits containing natural-language text use the same language; ignore Conventional Commit keywords, code identifiers, paths, hashes, and other language-neutral text.
4. The language used by the user in the current request or conversation.
5. English when none of the above provides a reliable signal.

Do not choose the output language from the language of this skill's prompt. Keep Conventional Commit `type` values, `scope`, and the `BREAKING CHANGE:` keyword in their standard form; write the human-readable description, body, and breaking-change explanation in the selected language. Preserve technical names in their established spelling.

### 4. Generate the Commit Message

Generate the message strictly from `git diff --cached`, using this exact prompt. Replace the placeholder with the complete staged diff, masking any sensitive values in the prompt only; preserve the actual staged content. Never reproduce credentials in the generated message, even after the user approves their inclusion in the commit.

```text
你是一位严格遵守 Conventional Commits 1.0.0 规范的提交信息写手。
请根据下面的 git diff 输出，生成一条 commit message，要求：

<target_language>
{按语言选择规则确定的语言}
</target_language>

1. 第一行格式：type(scope): description
   - type 只能从 feat/fix/docs/refactor/perf/test/chore 中选择
   - description 必须使用 target_language，不超过 50 个字符
   - 英文使用祈使句（如 "add" 而非 "added"）；中文使用简洁的动宾短语（如“添加”“修复”“更新”）
2. 空一行，使用 target_language 说明"为什么"做这个改动（动机、约束、权衡），不要复述 diff 里的代码内容（那是 What，diff 自己已经写了）
3. 若存在破坏性变更，正文后加 footer: BREAKING CHANGE: <使用 target_language 的说明>
4. type、scope 和 BREAKING CHANGE: 关键字保持 Conventional Commits 规范形式，其余自然语言内容使用 target_language；技术名称可保留原文
5. 严格基于 diff 内容，不虚构 diff 中不存在的信息
6. 只输出 commit message 本身，不要任何解释

<diff>
{粘贴 git diff --cached 的输出}
</diff>
```

Use only rationale inferable from the changed tests, documentation, behavior, or configuration. Do not invent issue numbers, user impact, performance claims, or intent. If the diff provides no evidence for why the change exists, stop before committing and report that the required body cannot be written without violating the no-invention rule.

Validate the result before committing:

- Header matches `^(feat|fix|docs|refactor|perf|test|chore)\([^)]+\): .+`.
- Description uses the selected language, follows its stated phrasing rule, and is at most 50 characters.
- Body follows one blank line, uses the selected language, and explains why without unsupported claims.
- A breaking footer appears only when the staged diff demonstrates a breaking change.

### 5. Commit

Proceed only after the sensitive-information gate passes or the user explicitly approves its reviewed findings. A refusal cancels this workflow; a pending answer blocks this step and push.

Pass the subject and body as separate message arguments so the shell does not open an editor:

```sh
git commit -m "type(scope): description" -m "Why this change is needed."
```

Add a third `-m` argument for a `BREAKING CHANGE:` footer when required. Preserve repository hooks; never add `--no-verify` without explicit user authorization.

If a hook fails, report the failure and leave the commit uncreated. Fix it only when the fix is within the user's task scope.

### 6. Verify and Push

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
