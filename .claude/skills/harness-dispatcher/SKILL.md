---
name: harness-dispatcher
description: |
  Harness Engineering 调度器。CI 定时触发，全程无人值守自动运行：
  加权随机选取任务 → 从 main 分支创建工作分支 → 按任务 prompt 执行 → 两阶段质量检测
  → 生成报告 → 创建 PR（成功正式 / 失败 Draft）→ 写入运行日志。
agent: general-purpose
allowed-tools: >
  Read, Edit, Write,
  Bash(bash *),
  Bash(git *),
  Bash(node *),
  Bash(npm *),
  Bash(rush *),
  Bash(gh *)
argument-hint: [--task <name>] [--dry-run]
---

# Harness Dispatcher

Harness Engineering 主调度器，全程自动执行，无需用户确认。

## 目录

- [参数解析](#参数解析)
- [流程总览](#流程总览)
- [Phase 0：记录基准分支与执行时间](#phase-0记录基准分支与执行时间)
- [Phase 0.5：Harness PR 负载分析](#phase-05harness-pr-负载分析)
- [Phase 0.6：repo-lens 缓存](#phase-06repo-lens-缓存)
- [Phase 1：选取任务](#phase-1选取任务)
- [Phase 2：创建工作分支](#phase-2创建工作分支)
- [Phase 3：执行任务](#phase-3执行任务)
- [Phase 4：质量检测与自动修复](#phase-4质量检测与自动修复)
- [Phase 5：提交 & 推送变更](#phase-5提交--推送变更)
- [Phase 6：创建 PR](#phase-6创建-pr)
- [Phase 7：生成报告](#phase-7生成报告)
- [Phase 8：收尾](#phase-8收尾)

---

## 参数解析

从 `$ARGUMENTS` 中解析：
- `--task <name>`：强制指定任务名（跳过随机选择，用于调试）
- `--dry-run`：只选任务不执行，打印将运行什么后退出

```
FORCED_TASK = $ARGUMENTS 中 --task 后的值（无则为空）
DRY_RUN     = $ARGUMENTS 中是否包含 --dry-run
```

---

## 流程总览

```
Phase 0    记录基准分支与执行时间
Phase 0.5  分析 open harness PR 分布，计算负载权重
Phase 0.6  预运行 repo-lens 并缓存结果
Phase 1    加权随机选取任务（综合近期运行历史 + 负载分布）
Phase 2    创建工作分支
Phase 3    按任务 prompt 执行
Phase 4    质量检测（quality-check）+ 自动修复循环
Phase 5    提交 & 推送变更
Phase 6    创建 PR（通过→正式，失败→Draft）
Phase 7    生成报告写入 PR Description
Phase 8    生成运行日志 + 提交收尾变更
```

---

## Phase 0：记录基准分支与执行时间

```bash
BASE_BRANCH="main"
EXECUTE_DATE=$(date +%Y-%m-%d)
EXECUTE_TIME=$(date '+%Y-%m-%d %H:%M')
```

记录：
```
BASE_BRANCH=main
EXECUTE_TIME=<执行时间>
```

确保本地 main 与远端同步：
```bash
git fetch origin
git checkout main
git pull origin main
```

---

## Phase 0.5：Harness PR 负载分析

> 通过分析仓库中现有的 open harness PR，动态平衡任务类型：open PR 多的类型降权，少的类型升权，避免重复堆积同类任务。

```bash
PR_LIST_JSON=$(gh pr list --state open --json number,headRefName,title --limit 200 2>/dev/null || echo "[]")
```

若命令失败或输出为空，`PR_LIST_JSON="[]"`，后续所有任务 `open_count=0`，流程不受影响。

解析步骤：
1. 过滤 `headRefName` 字段以 `chore/harness-` 开头的条目
2. 从 `headRefName`（格式：`chore/harness-<task-name>-<date>`）提取 `task_name`
3. 统计各 `task_name` 出现次数，构建映射表 `OPEN_PR_COUNTS`

打印汇总（按 open 数量降序）：
```
📊 Open Harness PR 任务分布（共 N 个）：
  update-deps:        2 个  ⬇ 将降权
  dead-code-cleaner:  1 个
  dep-cleaner:        0 个  ⬆ 未被压低
  ...
```

---

## Phase 0.6：repo-lens 缓存

> 为了避免多个任务重复运行 repo-lens，在此处预先运行并缓存结果。

1. 检查缓存是否有效（1 小时内）：
   ```bash
   CACHE_FILE="/tmp/harness-repo-lens-cache.json"
   CACHE_AGE_LIMIT=3600
   ```

2. 缓存无效则运行并写入：
   ```bash
   /repo-lens > "$CACHE_FILE"
   ```

3. Phase 3 执行任务时，若 prompt 包含 `/repo-lens`，替换为读取缓存：
   ```bash
   cat /tmp/harness-repo-lens-cache.json
   ```

---

## Phase 1：选取任务

读取 `.claude/harness/tasks.md`，解析所有 `<!-- task` ... `-->` 块中的 YAML，提取字段：
`name`、`description`、`prompt`、`weight`、`enabled`

过滤条件：`enabled: true`

**获取近期运行历史**：

```bash
HISTORY_JSON=$(node .claude/skills/harness-dispatcher/parse-history.js)
```

该脚本读取 `docs/harness/` 下所有 Markdown 日志，返回 JSON 数组，每条记录形如：
```json
{ "task": "dep-cleaner", "date": "2026-05-13", "package": "...", "success": true }
```

对每个任务，在 `HISTORY_JSON` 中查找 `task == task.name` 的最新记录作为 `last_run`。

如果 `FORCED_TASK` 非空：直接选取该 `name` 对应的任务（若不存在则报错退出）。

否则执行加权随机：
1. 计算每个任务的调整权重：
   - **基础权重**：`w = task.weight`
   - **近期运行折扣**：若 `last_run.date` 距今 ≤ 7 天，`w = floor(w / 2)`
   - **负载折扣**：`open_count = OPEN_PR_COUNTS[task.name]`；`w = max(1, floor(w / (open_count + 1)))`
   - `adjusted_weight = w`（最低保留 1）
2. 求所有 `adjusted_weight` 之和 `W`
3. 生成 `0 ≤ r < W` 的随机整数，按顺序累加权重，`r` 落入哪个区间则选中对应任务

打印权重分布，便于调试：
```
🎰 任务权重分布：
  update-deps:       原始 6 → 近期折扣后 3 → 负载折扣后 1
  dead-code-cleaner: 原始 10 → 近期折扣后 10 → 负载折扣后 5  ⬅ 最高
```

记录：
```
TASK_NAME=<选中的 name>
TASK_DESCRIPTION=<description>
TASK_PROMPT=<prompt>
```

打印：`🎲 选中任务：$TASK_NAME ($TASK_DESCRIPTION)`

如果 `DRY_RUN=true`，打印后退出：
```
[Dry Run] 任务：$TASK_NAME
[Dry Run] 基准分支：$BASE_BRANCH
[Dry Run] 工作分支：chore/harness-$TASK_NAME-$(date +%Y%m%d)
[Dry Run] Prompt：
$TASK_PROMPT
```

---

## Phase 2：创建工作分支

```bash
DATE=$(date +%Y%m%d)
WORK_BRANCH="chore/harness-${TASK_NAME}-${DATE}"

git checkout -b "$WORK_BRANCH"
```

打印：`🌿 工作分支：$WORK_BRANCH（基于 $BASE_BRANCH）`

---

## Phase 3：执行任务

### 3.1 预处理（repo-lens 缓存替换）

若 `$TASK_PROMPT` 包含 `/repo-lens` 且缓存有效，将 prompt 中的调用替换为读取缓存文件。

### 3.2 执行任务

按照 `$TASK_PROMPT` 中描述的步骤执行。Prompt 可调用任意 skill，完全按其指导运行。

等待执行完成，记录：
- `SKILL_SUCCESS=true`：输出中包含 ✅ 成功标志，或 prompt 步骤全部完成
- `SKILL_SUCCESS=false`：输出中包含 ❌ 失败标志，或步骤中途退出（含 "⚠️ 无候选包，跳过"）
- `SKILL_SUMMARY`：执行过程的摘要段落
- `SELECTED_PACKAGE`：若任务是 Package 粒度，从 SKILL_SUMMARY 提取目标包名

> 若任务 prompt 主动退出（如"无候选包"），`SKILL_SUCCESS=false`，后续仍正常走 Phase 4–8。

---

## Phase 4：质量检测与自动修复

> **此阶段完全自动循环，不向用户发问。只有检测通过才会进入 Phase 5 提交。**

### 初始化

```
CHECK_ITERATION = 0
MAX_CHECK_ITERATIONS = 5
CHECK_STATUS = FAIL
ERROR_FINGERPRINTS = {}
CHECK_FIX_LOG = ""
```

### 检测-修复主循环

```
WHILE CHECK_ITERATION < MAX_CHECK_ITERATIONS:
  CHECK_ITERATION += 1
  打印：[质量检测 #CHECK_ITERATION]

  IF SELECTED_PACKAGE 非空:
    运行 /quality-check $SELECTED_PACKAGE --incremental
  ELSE:
    运行 /quality-check

  从输出提取：
  - CHECK_STATUS（PASS / FAIL）
  - FAILED_STAGE（build / lint / test）
  - ERROR_SUMMARY（错误摘要文本）
  - CHECK_DURATION

  IF CHECK_STATUS == PASS:
    打印：✅ 质量检测通过，进入提交阶段
    BREAK → 进入 Phase 5

  ELSE:
    # 预存失败检测
    IF ERROR_SUMMARY 包含 "pre_existing" 或 "PRE_EXISTING":
      打印：⚠️ 检测到预存失败（base branch 上已存在），标记为 PASS_WITH_PREEXISTING
      CHECK_STATUS = PASS_WITH_PREEXISTING
      BREAK → 进入 Phase 5（创建 Draft PR）

    计算错误指纹 = FAILED_STAGE + ERROR_SUMMARY 前 80 字符
    ERROR_FINGERPRINTS[指纹] += 1

    IF ERROR_FINGERPRINTS[指纹] >= 2:
      打印：⚠️ 同一错误连续出现 2 次，触发断路器，停止自动修复
      BREAK（CHECK_STATUS 保持 FAIL）

    根据 FAILED_STAGE 和 ERROR_SUMMARY 分析并修复（见下方修复策略）
    追加修复记录到 CHECK_FIX_LOG

超过 MAX_CHECK_ITERATIONS → BREAK（CHECK_STATUS 保持 FAIL）
```

### 修复策略

根据 `FAILED_STAGE` 定向修复：

| FAILED_STAGE | 修复方向 |
|---|---|
| `build` | 从 ERROR_SUMMARY 提取文件路径和行号，修复 TypeScript 编译错误、缺失 import 等 |
| `lint` | 从 ERROR_SUMMARY 提取规则和位置，修复代码风格问题或为无法修复的规则添加 disable 注释 |
| `test` | 从 ERROR_SUMMARY 提取失败用例，修复测试代码或源码逻辑 |

每次修复后打印：`🔧 [#CHECK_ITERATION] 修复：<简短描述>`

### 循环结束后判定最终状态

```
OVERALL_SUCCESS = (SKILL_SUCCESS == true) && (CHECK_STATUS == PASS)
PREEXISTING_FAILURE = (CHECK_STATUS == PASS_WITH_PREEXISTING)
```

- `CHECK_STATUS == PASS` → Phase 5 正常提交，Phase 6 创建正式 PR
- `CHECK_STATUS == PASS_WITH_PREEXISTING` → Phase 5 正常提交，Phase 6 创建 Draft PR（标注预存失败）
- `CHECK_STATUS == FAIL` → Phase 5 仍提交，Phase 6 创建 Draft PR 供人工介入

---

## Phase 5：提交 & 推送变更

```bash
git add -A
```

检查是否有变更（`git status --porcelain`）：
- 有变更：
  ```bash
  git commit -m "chore(harness): [$TASK_NAME] $TASK_DESCRIPTION"
  ```
- 无变更：打印 `⚠️ 无文件变更，跳过 commit`（仍继续后续流程以生成日志）

```bash
git push -u origin "$WORK_BRANCH"
```

---

## Phase 6：创建 PR

使用 `gh pr create` 命令（`GITHUB_TOKEN` 已在 CI 环境中注入）。

**正式 PR**（`OVERALL_SUCCESS=true`）：
```bash
gh pr create \
  --title "chore(harness): [$TASK_NAME] $TASK_DESCRIPTION" \
  --body "<Phase 7 的报告内容>" \
  --base main \
  --head "$WORK_BRANCH"
```

**预存失败 Draft PR**（`PREEXISTING_FAILURE=true`）：
```bash
gh pr create \
  --draft \
  --title "[Draft] chore(harness): [$TASK_NAME] 预存失败 - $TASK_DESCRIPTION" \
  --body "<Phase 7 的报告内容，包含预存失败说明>" \
  --base main \
  --head "$WORK_BRANCH"
```

**失败 Draft PR**（`OVERALL_SUCCESS=false`）：
```bash
gh pr create \
  --draft \
  --title "[Draft] chore(harness): [$TASK_NAME] FAILED - $TASK_DESCRIPTION" \
  --body "<Phase 7 的报告内容>" \
  --base main \
  --head "$WORK_BRANCH"
```

从输出中提取 `PR_URL`。

---

## Phase 7：生成报告

报告作为 PR Description 写入（在 Phase 6 的 `--body` 中使用）：

```markdown
## Harness Engineering Report

**任务**：$TASK_DESCRIPTION
**执行时间**：$EXECUTE_TIME
**基准分支**：`$BASE_BRANCH`
**状态**：✅ 成功 / ❌ 失败

### 执行摘要

$SKILL_SUMMARY

### 质量检测

- 检测轮次：$CHECK_ITERATION 轮
- 最终状态：✅ 通过 / ❌ 失败

（失败时追加）
### 失败详情

- **失败阶段**：$FAILED_STAGE
- **错误摘要**：
  ```
  $ERROR_SUMMARY
  ```

---
🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

---

## Phase 8：收尾

### 8.1 生成运行日志

日志文件路径：`docs/harness/$EXECUTE_DATE-$TASK_NAME.md`
（若同名文件已存在，追加 `-2`、`-3` 后缀）

用 Write 工具生成：

````markdown
---
task: $TASK_NAME
date: $EXECUTE_DATE
package: $SELECTED_PACKAGE
success: true|false
pr: $PR_URL
quality_check_rounds: $CHECK_ITERATION
---

# Harness Run: $TASK_NAME — $EXECUTE_DATE

| 字段 | 值 |
|---|---|
| 任务 | $TASK_NAME |
| 描述 | $TASK_DESCRIPTION |
| 目标包 | $SELECTED_PACKAGE |
| 基准分支 | $BASE_BRANCH |
| 工作分支 | $WORK_BRANCH |
| 执行时间 | $EXECUTE_TIME |
| 最终状态 | ✅ 成功 / ❌ 失败 |
| PR | [$PR_URL]($PR_URL) |

## 执行摘要

$SKILL_SUMMARY

## 质量检测结果

- 检测轮次：$CHECK_ITERATION 轮
- 最终状态：✅ 通过 / ❌ 失败

（有修复记录时追加）
## 质量检测修复记录

$CHECK_FIX_LOG

（仅失败时追加）
## 失败详情

**失败阶段**：$FAILED_STAGE
**错误摘要**：

```
$ERROR_SUMMARY
```

---
🤖 Generated by Harness Engineering
````

### 8.2 提交运行日志

日志文件提交到**工作分支**（随 PR 一起提交，确保可追溯）：

```bash
git add docs/harness/
git commit -m "docs(harness): [$TASK_NAME] run log $EXECUTE_DATE"
git push origin "$WORK_BRANCH"
```

打印最终结果：
```
✅ Harness Engineering 完成
   任务：$TASK_NAME
   PR：$PR_URL
   日志：docs/harness/$EXECUTE_DATE-$TASK_NAME.md
   状态：成功 / 失败
```
