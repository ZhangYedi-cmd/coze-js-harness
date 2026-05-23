# @coze-arch/repo-lens

面向 AI 的 monorepo 状态快照工具。读取 `rush.json`，对每个 package 并发运行收集器，输出结构化 JSON 供 AI 分析整个仓库状态；也可用 `--format table` 直接在终端查阅。

## 快速使用

```bash
# 本地开发（无需 build，直接跑源码）
node infra/repo-lens/src/cli.js [command] [options]

# 安装后
repo-lens [command] [options]
```

## 命令速查

| 命令 | 用途 |
|------|------|
| `stat` | 基础快照：代码行数、依赖数量、内部依赖关系、代码质量指标 |
| `churn` | 变化度：基于 git history 的 commit 数 / 行变动 / 贡献者 |
| `cov` | 覆盖率：运行 `test:cov` 并汇总各包的单测覆盖率 |
| `list` | 列出所有已注册收集器 |

---

## `stat` — 基础快照

**适合场景**：
- 接手一个陌生模块，想快速了解它有多少代码、依赖了哪些包、内部耦合有多深
- 做代码质量治理前，先用 `anyRatio` / `tsIgnoreCount` 找出最需要改进的包
- 想知道改动某个底层包（如 `@coze/api`）会波及哪些包，评估影响面

扫描仓库，输出每个包的代码行数、依赖、代码质量等基础指标。

```bash
# 全仓扫描，输出到终端（table 格式）
node infra/repo-lens/src/cli.js stat

# 输出 JSON 文件，供 AI 分析
node infra/repo-lens/src/cli.js stat --format json --output repo-snapshot.json

# 只看某个包本身
node infra/repo-lens/src/cli.js stat --only @coze/api

# 查看某包的完整上游依赖树（该包依赖的所有包）
node infra/repo-lens/src/cli.js stat --to @coze/chat-sdk --format json

# 评估改动 @coze/api 的影响范围（所有依赖它的包）
node infra/repo-lens/src/cli.js stat --from @coze/api

# 按 glob 过滤，只看某模块
node infra/repo-lens/src/cli.js stat --filter "@coze/*"

# 只跑指定收集器（更快）
node infra/repo-lens/src/cli.js stat --filter "@coze/*" --collectors loc,code-quality
```

### table 输出示例

```
=== Repo Stats ===
External deps: 42 unique  |  Duplicates: 2
Duplicate deps (multiple versions):
  zod: ^4.1.12, ^3.24.2
Most depended: @coze/api (4), @coze/realtime-api (2)

=== Package Stats ===
Package                                 Level     LOC     Deps  InternalDeps  ts-ignore eslint-dis any   any/line
-----------------------------------------------------------------------------------------------------------------
@coze/api                               level-1   8500    21    0             0         2          5     0.0006
@coze/realtime-api                      level-2   3200    18    1             0         1          3     0.0009
@coze/chat-sdk                          level-2   2100    15    1             0         0          0     0.0000
@coze/taro-api                          level-3   450     12    1             0         0          0     0.0000
```

### JSON 输出结构

```json
{
  "generatedAt": "2026-05-11T10:00:00.000Z",
  "totalPackages": 42,
  "repoStats": {
    "repo-deps": {
      "total": 42,
      "duplicates": [
        {
          "name": "zod",
          "versions": ["^4.1.12", "^3.24.2"],
          "usedBy": ["@coze/api", "@coze/realtime-api"]
        }
      ],
      "all": [...]
    },
    "repo-graph": {
      "edges": [
        { "from": "@coze/chat-sdk", "to": "@coze/api", "type": "dep" }
      ],
      "mostDepended": [
        { "packageName": "@coze/api", "count": 4 },
        { "packageName": "@coze/realtime-api", "count": 2 }
      ]
    }
  },
  "packages": [
    {
      "packageName": "@coze-arch/repo-lens",
      "packagePath": "infra/repo-lens",
      "level": "level-1",
      "collectedAt": "2026-05-11T10:00:01.000Z",
      "stats": {
        "loc": {
          "sourceLines": 1636,
          "testLines": 0,
          "totalLines": 1636,
          "sourceFileCount": 26,
          "testFileCount": 0,
          "fileCount": 26
        },
        "code-quality": {
          "tsIgnoreCount": 0,
          "eslintDisableCount": 1,
          "anyCount": 6,
          "anyRatio": 0.0037
        },
        "deps": {
          "dependencies": ["@coze-arch/cli-logger", "commander", "..."],
          "devDependencies": ["vitest", "rollup", "..."],
          "peerDependencies": [],
          "total": 17
        },
        "internal-deps": {
          "dependencies": [],
          "devDependencies": ["..."],
          "total": 7
        },
        "test-coverage": {
          "exists": false,
          "lines": null,
          "functions": null,
          "branches": null,
          "statements": null
        }
      }
    }
  ]
}
```

---

## `churn` — 变化度分析

**适合场景**：
- 做 code review 或排查线上问题前，先看最近哪些包改动最频繁，帮助缩小排查范围
- 评估某次重构的涟漪效应：`--from <pkg>` 看哪些下游包在同期也有大量变动
- 临近发版，快速了解本周期内变动最集中的区域

基于 git history，统计各包在指定时间段内的活跃度。

```bash
# 默认：最近 30 天，按 commit 次数降序
node infra/repo-lens/src/cli.js churn

# 最近 3 个月，按行变动排序
node infra/repo-lens/src/cli.js churn --since 3m --sort added

# 分析某包及其上游的活跃度
node infra/repo-lens/src/cli.js churn --to @coze-space/app --since 30d

# 找出某模块下参与人数最多的包
node infra/repo-lens/src/cli.js churn --filter "@coze-space/*" --sort contributors

# 输出 JSON
node infra/repo-lens/src/cli.js churn --since 3m --format json --output churn.json
```

**`--since` 格式**：`30d`（天）/ `3m`（月）/ `1y`（年）/ `2026-01-01`（ISO 日期）

**`--sort` 字段**：`commits`（默认）/ `added`（新增行）/ `deleted`（删除行）/ `contributors`（贡献者数）

### table 输出示例

```
Package                                 Level     Commits   Added     Deleted   Contributors
--------------------------------------------------------------------------------------------
@coze/api                               level-1   11        +64       -10       4
@coze/realtime-api                      level-2   9         +740      -17       2
@coze/chat-sdk                          level-2   4         +6        -6        1
@coze/taro-api                          level-3   2         +207      -1        1
@coze/uniapp-api                        level-3   0         +0        -0        0
```

---

## `cov` — 单测覆盖率

**适合场景**：
- 想横向比较各包的测试覆盖率，找出覆盖率最低的包，确定补测优先级
- 提 MR 前，对本次改动涉及的包运行覆盖率检查，确保没有明显退化
- 定期生成覆盖率快照，跟踪整个模块的测试质量趋势

触发 `rush test:cov` 并汇总各包覆盖率产物（`coverage/coverage-summary.json`）。**只处理 `package.json` 中包含 `test:cov` 脚本的包。**

```bash
# 全仓（仅有 test:cov 脚本的包）
node infra/repo-lens/src/cli.js cov

# 只测指定包
node infra/repo-lens/src/cli.js cov --only @coze/api

# 测指定模块，结果写文件
node infra/repo-lens/src/cli.js cov --filter "@coze/*" --format json --output cov.json

# 控制并发数
node infra/repo-lens/src/cli.js cov --parallelism 4
```

**`--sort` 字段**：`lines`（默认）/ `statements` / `functions` / `branches`（均为降序）

---

## `list` — 列出收集器

```bash
node infra/repo-lens/src/cli.js list
```

输出当前所有已注册的收集器：

```
Package 级收集器:
  loc                  统计每个 package 的代码行数（仅 git 追踪文件，源码 / 测试 / 总计）
  code-quality         统计 @ts-ignore、eslint-disable、any 类型出现次数及 any/代码行比例（仅源码文件）
  deps                 读取 package.json 中全量依赖列表
  internal-deps        从依赖中筛选 workspace:* 的内部包，描述包间依赖关系
  test-coverage        读取 vitest coverage 产物，提取覆盖率摘要（不主动触发测试）
Repo 级收集器:
  repo-deps            汇总全仓外部依赖总览及重复依赖（多版本冲突）检测
  repo-graph           构建内部包依赖有向图，并统计被依赖次数排行（影响面最广的包）
```

---

## 包过滤规则

所有命令支持相同的过滤参数，与 Rush 语义对齐，**多个参数取并集**：

| 参数 | 含义 |
|------|------|
| `--only <pkg>` | 仅该包本身，不含任何依赖 |
| `--to <pkg>` | 该包 + 它所依赖的所有上游包（适合分析完整依赖树） |
| `--from <pkg>` | 该包 + 所有依赖它的下游包（适合评估改动影响范围） |
| `--filter <glob>` | 按包名 glob 匹配，如 `@coze-space/*` |

不传任何过滤参数时扫描全部包。

---

## 数据指标说明

### Package 级（每个包都有）

**`loc` — 代码行数**
- `sourceLines` / `sourceFileCount`：源码行数（`.ts/.tsx/.js/.jsx`，排除测试文件，仅 git 追踪文件）
- `testLines` / `testFileCount`：测试文件行数（`__tests__/`、`.test.*`、`.spec.*`）
- `totalLines`：合计

**`code-quality` — 代码质量信号**（仅 `.ts/.tsx` 源码，不含测试）
- `tsIgnoreCount`：`@ts-ignore` 指令总次数，越高说明类型逃逸越多
- `eslintDisableCount`：`eslint-disable` / `eslint-disable-next-line` / `eslint-disable-line` 总次数
- `anyCount`：`any` 关键字出现次数（含类型注解、断言、泛型等场景）
- `anyRatio`：`anyCount / 源码总行数`（保留 4 位小数），用于跨包横向比较，值越小越好

**`deps` — 全量依赖**
- `dependencies` / `devDependencies` / `peerDependencies`：各字段包名列表
- `total`：三者合计

**`internal-deps` — 内部依赖**（仅 `workspace:*` 的包）
- `dependencies` / `devDependencies`：运行时 / 开发时内部依赖
- `total`：内部依赖总数，反映该包与仓库其他包的耦合度

**`test-coverage` — 单测覆盖率**（读已有 coverage 产物，不触发测试）
- `exists`：是否找到 `coverage/coverage-summary.json`
- `lines` / `statements` / `functions` / `branches`：各维度覆盖率百分比，`null` 表示无数据

### Repo 级（全仓汇总）

**`repo-deps` — 外部依赖总览**
- `total`：全仓唯一外部依赖数量
- `duplicates`：存在多版本的依赖列表（`versions.length > 1`），每条含 `name`、`versions`、`usedBy`，是识别版本冲突风险的核心信号
- `all`：完整依赖列表

**`repo-graph` — 内部依赖图**
- `edges`：内部依赖边列表，每条 `{ from, to, type: 'dep'|'devDep' }`
- `mostDepended`：被依赖次数最多的包排行（前 20），`count` 越高说明改动该包影响面越广、风险越高

---

## 典型 AI 使用场景

```bash
# 获取整个仓库的结构化快照（推荐写入文件供后续分析）
repo-lens stat --format json --output repo-snapshot.json

# 分析某个包及其依赖的近期活跃度
repo-lens churn --to @coze/chat-sdk --since 30d --format json

# 定位变更最频繁的包（高风险区域）
repo-lens churn --filter "@coze/*" --sort added --format json

# 找出 any 类型密度最高的包（类型安全改进候选）
repo-lens stat --format json --output /tmp/snap.json
# 然后用 jq：
# jq '[.packages[] | {pkg:.packageName, anyRatio:.stats["code-quality"].anyRatio}] | sort_by(-.anyRatio) | .[:10]' /tmp/snap.json
```

---

## 扩展：自定义收集器

```typescript
import { createLensEngine, presetCollectors } from '@coze-arch/repo-lens';
import type { PackageCollector } from '@coze-arch/repo-lens';

// 自定义 Package 级收集器
const myCollector: PackageCollector<{ ownerCount: number }> = {
  scope: 'package',
  name: 'owner-count',
  description: '统计 OWNERS 文件中的负责人数量',
  collect(project) {
    // ...
    return { ownerCount: 3 };
  },
};

const engine = createLensEngine([...presetCollectors, myCollector]);
const snapshot = await engine.run(projects);
```

新增收集器步骤：
1. `src/collectors/package/` 下新建文件，实现 `PackageCollector<T>`（`scope: 'package'`）
2. 或在 `src/collectors/repo/` 下实现 `RepoCollector<T>`（`scope: 'repo'`）
3. 加入 `src/collectors/index.ts` 的 `presetCollectors` 数组，自动生效

---

## 开发

```bash
# 单元测试
pnpm test

# 覆盖率报告
pnpm test:cov

# 构建
pnpm build

# 调试（查看详细执行日志）
DEBUG=repo-lens:* node infra/repo-lens/src/cli.js stat --filter "@coze/*"
```

## 目录结构

```
src/
├── cli.js                  # 本地开发入口（sucrase 直跑 TS）
├── index.ts                # CLI 主入口（Commander program）
├── engine.ts               # 引擎：并发调度收集器，聚合 RepoSnapshot
├── types.ts                # 核心类型定义
├── collectors/
│   ├── index.ts            # presetCollectors 汇总导出
│   ├── package/            # Package 级收集器（loc / code-quality / deps / ...）
│   └── repo/               # Repo 级收集器（repo-deps / repo-graph）
├── commands/               # CLI 命令注册（stat / churn / cov / list）
├── formatters/             # 输出格式（json / table）
└── utils/                  # debug logger、包过滤逻辑
```

## 相关文档

- [需求文档](./docs/requirements.md)
- [技术设计](./docs/technical-summary.md)
