# @coze-arch/repo-lens 技术设计总结

## 概述

`repo-lens` 是一个面向 AI 的仓库状态快照工具。它读取 `rush.json`，对 monorepo 中的每个 package 运行可扩展的统计收集器，输出结构化 JSON 或表格数据，供 AI Agent 分析整个仓库状态。

**定位**：面向 AI 消费，不是人读 dashboard，是 Agent 的"仓库感知层"。

---

## 架构设计

### 两层收集器体系

```
StatCollector
├── PackageCollector<T>   逐包运行，接收单个 RushConfigurationProject
└── RepoCollector<T>      全局运行一次，接收所有 project 列表
```

设计动机：部分统计（代码行数、依赖数量）是 per-package 的；另一些（重复依赖检测、全仓依赖图）需要所有 package 的上下文才有意义，不能拆成逐包运行。

### 核心数据流

```
rush.json
    ↓ RushConfiguration.loadFromDefaultLocation()
RushConfigurationProject[]
    ↓ filterProjects()          -- Rush 风格包过滤（可选）
filtered projects
    ↓ LensEngine.run()
        ├── Promise.all(packages.map(runPackage))   -- 并发执行 PackageCollectors
        └── Promise.all(repoCollectors.map(run))    -- 并发执行 RepoCollectors
RepoSnapshot
    ↓ formatJson() / formatTable()
stdout / file
```

### 核心类型

```typescript
// 收集器接口，T 为该收集器的输出类型
interface PackageCollector<T = unknown> {
  scope: 'package';
  name: string;
  description: string;
  collect: (project: RushConfigurationProject) => T | Promise<T>;
}

interface RepoCollector<T = unknown> {
  scope: 'repo';
  name: string;
  description: string;
  collect: (projects: RushConfigurationProject[]) => T | Promise<T>;
}

// 输出结构
interface RepoSnapshot {
  generatedAt: string;          // ISO 8601
  totalPackages: number;
  repoStats: Record<string, unknown | CollectorError>;   // RepoCollector 结果
  packages: PackageStat[];
}

interface PackageStat {
  packageName: string;
  packagePath: string;          // 相对于 repo root
  collectedAt: string;
  stats: Record<string, unknown | CollectorError>;       // PackageCollector 结果
}

// 收集器出错时写入 { error: string }，不 crash 整个流程
interface CollectorError {
  error: string;
}
```

---

## 收集器清单

### Package-level

| 名称 | 文件 | 输出字段 |
|------|------|---------|
| `loc` | `collectors/package/loc.ts` | `sourceLines`, `testLines`, `totalLines`, `sourceFileCount`, `testFileCount`, `fileCount` |
| `deps` | `collectors/package/deps.ts` | `dependencies`, `devDependencies`, `total` |
| `internal-deps` | `collectors/package/internal-deps.ts` | `dependencies`, `devDependencies`, `total` |
| `test-coverage` | `collectors/package/test-coverage.ts` | 占位，暂未实现 |

**LOC 计数策略**：使用 `git ls-files` 获取 git 追踪文件，天然排除 `node_modules`、构建产物、gitignore 规则覆盖的文件。只统计 `.ts/.tsx/.js/.jsx` 后缀文件。

测试文件识别规则：路径含 `__tests__/` 或 `.test.`/`.spec.` 则归为测试文件。

**churn 收集器**（通过工厂函数动态创建，用于 `churn` 命令）：

```typescript
createChurnCollector(since: string): PackageCollector<ChurnStat>
```

- `since` 格式：`30d` / `3m` / `1y` / ISO 日期字符串
- 调用 `git log --since="..." --format="COMMIT %ae" --numstat`
- 解析 commit 数、新增行、删除行、去重贡献者邮箱

### Repo-level

| 名称 | 文件 | 输出字段 |
|------|------|---------|
| `repo-deps` | `collectors/repo/repo-deps.ts` | `total`, `duplicates[]`, `all[]` |
| `repo-graph` | `collectors/repo/repo-graph.ts` | `edges[]`, `mostDepended[]` |

`repo-deps`：汇总全仓 `dependencies`/`devDependencies`/`peerDependencies`，跳过 `workspace:*`（内部包），检测多版本冲突。

`repo-graph`：只计入 `workspace:*` 的内部边，输出 `{from, to, type: 'dep'|'devDep'}` 边列表，以及被依赖次数 top 20 排行（高被依赖 = 改动风险最高）。

---

## 包过滤（Rush 语义）

```
filterProjects(projects, { to, from, only, filter })
```

| 选项 | 语义 |
|------|------|
| `--only <pkg>` | 仅该包本身 |
| `--to <pkg>` | 该包 + 所有上游依赖（BFS 遍历 upstream map） |
| `--from <pkg>` | 该包 + 所有下游依赖（BFS 遍历 downstream map） |
| `--filter <glob>` | 包名 glob 匹配，如 `@coze-space/*` |

多个选项取并集。底层用两张邻接表（`upstreamMap` / `downstreamMap`），BFS 求传递闭包。

---

## 命令

### `stat` — 基础快照

默认收集器：`loc`, `deps`, `internal-deps`, `repo-deps`, `repo-graph`（排除 `test-coverage`）。

```
repo-lens stat [--to/--from/--only/--filter] [--collectors <names>] [--format json|table] [--output <file>]
```

### `churn` — 代码变化频率

动态创建 `churn` 收集器，只跑该收集器。支持按 `commits`/`added`/`deleted`/`contributors` 排序。

```
repo-lens churn [--since 30d|3m|1y|ISO] [--sort commits|added|deleted|contributors] [--format json|table]
```

### `cov` — 覆盖率

占位命令，暂未实现。

### `list` — 列出所有可用收集器

分 package-level / repo-level 两组展示。

---

## 可扩展性

添加新收集器只需：

1. 创建文件，实现 `PackageCollector<T>` 或 `RepoCollector<T>` 接口
2. 加入 `collectors/index.ts` 的 `presetCollectors` 数组

无需修改 engine、命令层或格式化层。

---

## 调试

使用 `debug` 包，命名空间前缀 `repo-lens:`：

```bash
DEBUG=repo-lens:* repo-lens stat --format json
```

| 命名空间 | 位置 |
|---------|------|
| `repo-lens:engine` | LensEngine（任务调度、耗时） |
| `repo-lens:filter` | 包过滤（选中数量、选项） |
| `repo-lens:collector:loc` | LOC 文件扫描 |
| `repo-lens:collector:churn` | git log 调用 |
| `repo-lens:collector:repo-deps` | 外部依赖汇总 |
| `repo-lens:collector:repo-graph` | 依赖图构建 |

---

## 构建产物

| 路径 | 说明 |
|------|------|
| `lib/cli.js` | CJS 产物，由 rollup 打包 |
| `bin/main` | Node shebang 入口，`require('../lib/cli.js')` |

构建工具：rollup（通过 `scripts/build.ts`，`tsx` 执行）。

---

## 依赖

| 包 | 用途 |
|----|------|
| `@rushstack/rush-sdk` | 读取 rush.json，获取 project 信息 |
| `commander` | CLI 框架 |
| `debug` | 调试日志 |
| `minimatch` | glob 过滤 |
| `@coze-infra/fs-enhance` | 内部 fs 工具 |
