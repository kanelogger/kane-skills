# git-commit-push

安全完成一次 `git add`、`git commit`、`git push` 流程：只暂存当前任务相关文件，基于 `git diff --cached` 生成 Conventional Commits 1.0.0 提交信息，提交后验证并推送当前分支。

## Use when

- 完成一个开发任务后，需要提交并推送相关改动。
- 工作区同时存在其他修改，需要严格控制本次提交边界。
- 希望提交信息只依据暂存区 diff，包含规范标题和改动动机。
- 希望提交信息优先遵循用户指定语言，否则根据项目规范、最近提交和当前对话选择语言。

## Safety

- 只使用显式路径暂存，禁止 `git add .`、`git add -A` 和宽泛通配符。
- 提交前复核全部 staged paths 与 hunks，发现无关内容立即停止。
- 默认禁止 amend、跳过 hooks、切换分支和 force push。
- 无法可靠判断上游远端时，推送前停止并请求用户确认。

## Example

`Use $git-commit-push to commit and push the changes from this task.`

## Output

提交哈希、提交标题、推送分支与远端、已提交文件、验证结果，以及保留的无关修改。
