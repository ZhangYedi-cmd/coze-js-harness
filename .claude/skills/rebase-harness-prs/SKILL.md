---
name: rebase-harness-prs
description: |
  维护所有 open harness PR 的 rebase 状态。
  列出所有 chore/harness-* 分支的 open PR，逐个执行 git rebase origin/main，
  有冲突则跳过并记录，成功则 force-push 更新分支，保持随时可合入。
agent: general-purpose
allowed-tools: >
  Bash(bash *),
  Bash(git *),
  Bash(gh *)
argument-hint: ""
---

# rebase-harness-prs

对所有 open harness PR 执行 rebase，由 GitHub Actions `harness.yml` 定时自动触发。

## 前置条件

- `GITHUB_TOKEN` / `GH_TOKEN` 已在环境变量中设置（用于 `gh` 命令和 `git push`）
- Git 用户已配置（`user.name` 和 `user.email`）
- 当前工作目录为仓库根目录

---

## Phase 1：列出所有 open harness PR

```bash
gh pr list --state open --json number,headRefName,title --limit 100 \
  --jq '.[] | select(.headRefName | startswith("chore/harness-"))'
```

若无 open harness PR，打印 `✅ 无 open harness PR，无需 rebase` 后退出。

记录：`PR_LIST`（number、headRefName、title 列表）

---

## Phase 2：逐个 rebase

对 `PR_LIST` 中的每个 PR：

```bash
git fetch origin
git checkout <headRefName>
git rebase origin/main
```

**有冲突时**：
```bash
git rebase --abort
```
记录该 PR 为 `CONFLICT`，继续处理下一个。

**无冲突时**：
```bash
git push --force-with-lease origin <headRefName>
```
记录该 PR 为 `SUCCESS`。

---

## Phase 3：输出报告

```
=== rebase-harness-prs report ===
处理 PR 总数：N
✅ 成功 rebase：n 个
  - PR #<number>: <title>
⚠️ rebase 冲突（跳过）：n 个
  - PR #<number>: <title>（需人工介入）
```

打印：`✅ rebase 完成` 或 `⚠️ 部分 PR 存在冲突，需人工处理`
