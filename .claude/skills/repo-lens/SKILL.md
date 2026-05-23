---
name: repo-lens
description: |
  仓库包评分器。调用 infra/repo-lens CLI 对仓库所有 package 采集结构化快照，
  输出推荐包列表（JSON），供 harness 执行层 skill 选包使用。
  底层工具：node infra/repo-lens/src/cli.js（无需 build，直接跑源码）。
agent: general-purpose
allowed-tools: >
  Read,
  Bash(bash *),
  Bash(node *),
  Bash(jq *)
argument-hint: [--top <n>] [--task <task-name>]
---

# repo-lens

调用 `infra/repo-lens` CLI 采集仓库快照，输出适合 harness 调度的候选包推荐列表。

## 参数解析

从 `$ARGUMENTS` 中解析：
- `--top <n>`：只输出评分最高的 N 个包（默认 10）
- `--task <task-name>`：针对特定任务类型调整筛选维度（见下方各任务策略）

```
TOP_N       = $ARGUMENTS 中 --top 后的值（默认 10）
TASK_NAME   = $ARGUMENTS 中 --task 后的值（无则为空）
```

---

## Phase 1：采集快照

运行 `stat` + `churn` 两个命令，将结果写入临时文件供后续分析：

```bash
# 基础快照：代码行数、依赖数量、代码质量指标（any / eslint-disable / ts-ignore）
node infra/repo-lens/src/cli.js stat --format json --output /tmp/repo-lens-stat.json

# 变化度：近 30 天各包 commit 次数（用于计算近期活跃度折扣）
node infra/repo-lens/src/cli.js churn --since 30d --format json --output /tmp/repo-lens-churn.json
```

---

## Phase 2：计算候选包评分

读取两个快照文件，对每个包计算综合评分：

**基础分（来自 stat）**
- `loc`：源码行数越大 → 优化收益越高 → `loc_score = sourceLines / 1000`（上限 10）
- `internal-deps.total`：被内部依赖数越少 → 改动影响面越小 → `dep_score = max(0, 5 - internalDepsTotal)`

**活跃度折扣（来自 churn）**
- 近 30 天 commit 次数越少 → 改动风险越低 → `churn_score = max(0, 5 - commits)`

**综合评分**
```
score = loc_score + dep_score + churn_score
```

---

## Phase 3：按任务类型调整筛选维度

不同任务关注的指标不同，当 `TASK_NAME` 非空时，在综合评分基础上额外加权：

| TASK_NAME | 额外权重逻辑 |
|---|---|
| `optimize-any-types` | 优先 `anyCount` 高的包（`+anyCount / 10`） |
| `fix-eslint-disable` | 优先 `eslintDisableCount` 高的包（`+eslintDisableCount * 2`） |
| `fix-ts-expect-error` | 优先 `tsIgnoreCount` 高的包（`+tsIgnoreCount * 3`） |
| `add-tests` | 优先 `test-coverage.lines` 低的包（`+max(0, 60 - lines)`），无覆盖率数据的包视为 0% |
| `dep-cleaner` | 优先 `deps.total` 高且 `internal-deps.total` 低的包 |
| `dead-code-cleaner` | 优先 `loc` 高且近期 churn 低的包（默认综合评分即可） |

若 `TASK_NAME` 为空，使用默认综合评分排序。

---

## Phase 4：输出结果

按调整后的评分降序排列，取前 `TOP_N` 个，输出 JSON 到 stdout：

```json
[
  {
    "packageName": "@coze/api",
    "projectFolder": "packages/coze-js",
    "score": 14.2,
    "sourceLines": 8500,
    "internalDeps": 1,
    "recentCommits": 2,
    "anyCount": 23,
    "eslintDisableCount": 5,
    "tsIgnoreCount": 0,
    "testCoverageLines": null
  }
]
```

打印：`🔍 repo-lens 完成，共分析 N 个包，输出 TOP_N 个推荐`

---

## 直接查阅用法（非 harness 场景）

```bash
# 终端直接查看全仓 table 格式快照
node infra/repo-lens/src/cli.js stat

# 查找 any 类型密度最高的包
node infra/repo-lens/src/cli.js stat --format json --output /tmp/snap.json
jq '[.packages[] | {pkg:.packageName, anyRatio:.stats["code-quality"].anyRatio}] | sort_by(-.anyRatio) | .[:10]' /tmp/snap.json

# 查看近期变动最活跃的包
node infra/repo-lens/src/cli.js churn --since 30d

# 只看指定包
node infra/repo-lens/src/cli.js stat --only @coze/api
```
