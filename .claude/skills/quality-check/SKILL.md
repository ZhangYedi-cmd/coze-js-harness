---
name: quality-check
description: |
  两阶段质量门禁。检测本次改动是否引入构建/测试/lint 错误。
  Phase 1（增量快速，~45s）：只跑受影响的 package。
  Phase 2（全量深度，10-30min）：rush build + test:cov + lint 全跑。
  输出结构化结果供 harness-dispatcher 自动修复循环使用。
agent: general-purpose
allowed-tools: >
  Read,
  Bash(bash *),
  Bash(git *),
  Bash(node *),
  Bash(rush *)
argument-hint: [<package-path>] [--incremental]
---

# quality-check

两阶段质量门禁，被 harness-dispatcher 的修复循环调用。

## 参数解析

从 `$ARGUMENTS` 中解析：
- 第一个非 flag 参数：目标包路径（如 `packages/coze-js`），用于增量检测
- `--incremental`：只运行 Phase 1 增量检测，跳过 Phase 2 全量检测

```
TARGET_PACKAGE = $ARGUMENTS 中第一个非 flag 参数（无则为空）
INCREMENTAL_ONLY = $ARGUMENTS 中是否包含 --incremental
```

---

## Phase 1：增量快速检测

### 确定变动文件列表

```bash
CHANGED_FILES=$(git diff --name-only HEAD 2>/dev/null)
```

若 `TARGET_PACKAGE` 非空，则只关注该包路径下的变动文件。

### 运行增量检测

```bash
node infra/rush-x/bin/run increment --action build \
  -f "$CHANGED_FILES" -s ' '

node infra/rush-x/bin/run increment --action lint \
  -f "$CHANGED_FILES" -s ' '

node infra/rush-x/bin/run increment --action test:cov \
  -f "$CHANGED_FILES" -s ' '
```

任意步骤失败则记录：
- `FAILED_STAGE`：`build` / `lint` / `test`
- `ERROR_SUMMARY`：失败命令的 stderr 输出（截取关键行）

若全部通过且 `INCREMENTAL_ONLY=true`，输出结果后退出。

---

## Phase 2：全量深度检测

仅在 Phase 1 通过且未指定 `--incremental` 时运行。

```bash
node common/scripts/install-run-rush.js install
node common/scripts/install-run-rush.js build --verbose
node common/scripts/install-run-rush.js test:cov --verbose
node common/scripts/install-run-rush.js lint --verbose
```

任意步骤失败则更新 `FAILED_STAGE` 和 `ERROR_SUMMARY`。

---

## Phase 3：预存失败检测

对于检测到的错误，判断是否在 base branch（`main`）上已存在：

```bash
git stash
node common/scripts/install-run-rush.js <failed_command> 2>&1 | head -50
git stash pop
```

若 base branch 上同一命令也失败，标记 `IS_PRE_EXISTING=true`，在输出中注明 `PRE_EXISTING`。

---

## Phase 4：输出结果

输出结构化结果（供 harness-dispatcher 解析）：

```
=== quality-check result ===
phase1: PASS|FAIL
phase2: PASS|FAIL|SKIPPED
pre_existing: true|false
failed_stage: build|lint|test|none
error_summary: |
  <具体错误信息，含文件路径和行号，供调度器定向修复使用>
duration: <秒数>
```

打印：`✅ 质量检测通过` 或 `❌ 质量检测失败：$FAILED_STAGE`
