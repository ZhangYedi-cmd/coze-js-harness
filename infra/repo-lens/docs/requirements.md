# repo-lens 需求文档

## 一、定位与目标

`@coze-arch/repo-lens` 是一个面向 **AI 可读** 的仓库状态 CLI 工具。

核心目标：给 AI（skills / agents）提供一个"上帝视角"，让其能洞察整个仓库的代码现状，从而做出更准确的分析与决策。

统计维度分为两个层次：

- **Package 级别**：对每个 package 单独运行收集器，如代码行数、依赖列表、测试覆盖率等
- **Repo 级别**：跨所有 package 的全局洞察，如全仓外部依赖总览、重复依赖检测、依赖版本冲突等；这类统计无法归属于某个单一 package，需要汇总整体数据后才能得出结论

两个层次的收集器使用统一的插件接口，输出合并到同一份快照中，AI 消费时无需关心数据来源层次。

定位区别于 `package-audit`：
- `package-audit` 是**规则检查**（pass/fail），面向 CI 门禁
- `repo-lens` 是**状态快照**（结构化统计数据），面向 AI 分析与决策

---

## 二、CLI 设计

### 包名与入口

```
package name: @coze-arch/repo-lens
bin:          repo-lens
```

### 子命令

#### `repo-lens scan`

扫描所有（或指定）package，输出统计结果。

包过滤规则与 Rush 对齐，支持以下选项（可组合使用）：

| 参数 | 含义 | 对应 Rush 语义 |
|------|------|----------------|
| `--to <pkg>` | 指定包及其所有上游依赖（它依赖的包） | `rush build --to` |
| `--from <pkg>` | 指定包及其所有下游依赖（依赖它的包） | `rush build --from` |
| `--only <pkg>` | 仅指定包本身，不含任何依赖 | `rush build --only` |
| `--filter <glob>` | 按包名 glob 匹配，如 `@coze/*` | `rush build --filter` |

以上参数均可多次指定，取并集；不传任何过滤参数时扫描全部包。

```bash
# 扫描全部包
repo-lens scan

# 仅扫描指定包本身
repo-lens scan --only @coze/api

# 扫描该包及其所有上游依赖
repo-lens scan --to @coze/chat-sdk

# 扫描该包及所有依赖它的包（下游）
repo-lens scan --from @coze/api

# 按 glob 匹配包名
repo-lens scan --filter "@coze/*"

# 多个过滤条件取并集
repo-lens scan --only @coze/api --filter "@coze/*"

# 选择特定收集器
repo-lens scan --collectors loc,deps,internal-deps

# 指定输出格式（默认 table，AI 场景用 json）
repo-lens scan --format json

# 输出到文件
repo-lens scan --format json --output ./repo-snapshot.json
```

#### `repo-lens list`

列出所有已注册的收集器及其说明。

```bash
repo-lens list
```

---

## 三、核心架构

### 3.1 收集器接口（Collector）

收集器分为两种作用域，通过 `scope` 字段区分：

```typescript
/** Package 级别收集器：针对单个 package 运行 */
export interface PackageCollector<T = unknown> {
  scope: 'package';
  name: string;
  description: string;
  collect(project: RushConfigurationProject): Promise<T>;
}

/** Repo 级别收集器：接收全部 package 列表，产出全局洞察 */
export interface RepoCollector<T = unknown> {
  scope: 'repo';
  name: string;
  description: string;
  collect(projects: RushConfigurationProject[]): Promise<T>;
}

export type StatCollector<T = unknown> = PackageCollector<T> | RepoCollector<T>;
```

### 3.2 引擎（LensEngine）

```typescript
class LensEngine {
  constructor(collectors: StatCollector[]) {}

  /** 运行所有收集器，返回完整的仓库快照 */
  async run(projects: RushConfigurationProject[]): Promise<RepoSnapshot>
}
```

引擎内部执行逻辑：
1. 将 collectors 按 scope 分组
2. Package 收集器：对每个 project 并发运行，结果挂到 `PackageStat.stats`
3. Repo 收集器：以全部 projects 为参数运行一次，结果挂到 `RepoSnapshot.repoStats`

### 3.3 数据结构

```typescript
/** 单个包的统计快照 */
export interface PackageStat {
  packageName: string;
  packagePath: string;
  collectedAt: string; // ISO 时间戳
  stats: Record<string, unknown>; // key = collector.name，value = collect() 返回值
}

/** 整个仓库的快照 */
export interface RepoSnapshot {
  generatedAt: string;
  totalPackages: number;
  /** Repo 级别收集器的输出，key = collector.name */
  repoStats: Record<string, unknown>;
  /** Package 级别收集器的输出，每个 package 一条 */
  packages: PackageStat[];
}
```

---

## 四、内置收集器

### 4.1 `loc` — 代码行数

统计每个 package 的代码行数。

```typescript
interface LocStat {
  sourceLines: number;   // src/ 下 .ts/.tsx 文件总行数
  testLines: number;     // __tests__/ 下文件总行数
  totalLines: number;    // 全部文件总行数
  fileCount: number;     // 文件总数
}
```

实现要点：
- 用 `fast-glob` 扫描文件
- 排除 `node_modules`、`lib`、`dist`、`.gitignore` 中的路径
- 区分 source / test 文件

---

### 4.2 `deps` — 全量依赖列表

读取 `package.json` 中所有依赖。

```typescript
interface DepsStat {
  dependencies: string[];         // dependencies 的包名列表
  devDependencies: string[];      // devDependencies 的包名列表
  peerDependencies: string[];     // peerDependencies 的包名列表
  total: number;                  // 三者合计数量
}
```

---

### 4.3 `internal-deps` — 内部依赖列表

从所有依赖中筛选 `workspace:*` 的包，代表仓库内部依赖关系。

```typescript
interface InternalDepsStat {
  dependencies: string[];    // 运行时内部依赖
  devDependencies: string[]; // 开发时内部依赖
  total: number;
}
```

实现要点：
- 读取 `package.json` 后，过滤 version 为 `workspace:*` 的项
- 这是构建 package 依赖图的基础数据

---

### 4.4 `test-coverage` — 单测覆盖率

读取 vitest 生成的 coverage JSON，提取覆盖率摘要。

```typescript
interface TestCoverageStat {
  exists: boolean;           // 是否有 coverage 报告
  lines: number | null;      // 行覆盖率 (0-100)
  functions: number | null;  // 函数覆盖率 (0-100)
  branches: number | null;   // 分支覆盖率 (0-100)
  statements: number | null; // 语句覆盖率 (0-100)
}
```

实现要点：
- 读取 `coverage/coverage-summary.json`（vitest --coverage 默认产物）
- 文件不存在时 `exists: false`，覆盖率字段为 `null`
- 不主动触发测试，只读取已有产物

---

## 五、Repo 级别内置收集器

### 5.1 `repo-deps` — 全仓外部依赖总览

汇总整个仓库所有 package 使用的外部依赖及其版本分布。

```typescript
interface RepoDependency {
  name: string;           // 依赖包名
  versions: string[];     // 仓库中出现的所有版本声明
  usedBy: string[];       // 引用该依赖的 package 列表
}

interface RepoDependencyStat {
  total: number;                       // 唯一外部依赖总数
  duplicates: RepoDependency[];        // 存在多个版本的依赖（重复依赖）
  all: RepoDependency[];               // 全量列表
}
```

实现要点：
- 合并所有 package 的 `dependencies` + `devDependencies`，排除 `workspace:*`
- `duplicates` 筛选 `versions.length > 1` 的条目，帮助 AI 识别版本冲突风险

---

### 5.2 `repo-graph` — 内部依赖图

描述仓库内部 package 之间的依赖关系，构建有向图数据。

```typescript
interface RepoGraphStat {
  edges: Array<{
    from: string;  // 依赖方
    to: string;    // 被依赖方
    type: 'dep' | 'devDep';
  }>;
  /** 被依赖次数最多的 package（影响面最广） */
  mostDepended: Array<{ packageName: string; count: number }>;
}
```

实现要点：
- 基于各 package 的 `internal-deps` 数据构建边列表
- `mostDepended` 对 AI 决策有价值：改动这些包风险最高

---

## 六、扩展机制

### 6.1 注册自定义收集器

`LensEngine` 构造函数接受收集器数组，所有内置收集器通过 `presetCollectors` 导出：

```typescript
import { LensEngine, presetCollectors } from '@coze-arch/repo-lens';

// 使用全部内置收集器（包含 package 级和 repo 级）
const engine = new LensEngine(presetCollectors);

// 追加自定义收集器（任意 scope 均可）
const engine = new LensEngine([
  ...presetCollectors,
  myPackageCollector,  // scope: 'package'
  myRepoCollector,     // scope: 'repo'
]);

// 只用部分收集器
const engine = new LensEngine([locCollector, repoDepsCollector]);
```

### 6.2 新增收集器的步骤

**Package 级**：
1. 在 `src/collectors/package/` 下新建文件，实现 `PackageCollector<T>` 接口（`scope: 'package'`）
2. 加入 `presetCollectors`，自动生效

**Repo 级**：
1. 在 `src/collectors/repo/` 下新建文件，实现 `RepoCollector<T>` 接口（`scope: 'repo'`）
2. 加入 `presetCollectors`，自动生效

两种收集器无需修改引擎或 CLI。

---

## 七、输出格式

### JSON 格式（面向 AI）

```json
{
  "generatedAt": "2026-04-17T10:00:00+08:00",
  "totalPackages": 42,
  "repoStats": {
    "repo-deps": {
      "total": 186,
      "duplicates": [
        {
          "name": "lodash",
          "versions": ["^4.17.21", "~4.17.0"],
          "usedBy": ["@coze/api", "@coze/realtime-api"]
        }
      ],
      "all": []
    },
    "repo-graph": {
      "edges": [
        { "from": "@coze/chat-sdk", "to": "@coze/api", "type": "dep" }
      ],
      "mostDepended": [
        { "packageName": "@coze/api", "count": 4 }
      ]
    }
  },
  "packages": [
    {
      "packageName": "@coze/api",
      "packagePath": "packages/coze-js",
      "collectedAt": "2026-04-17T10:00:01+08:00",
      "stats": {
        "loc": {
          "sourceLines": 8500,
          "testLines": 2100,
          "totalLines": 10600,
          "fileCount": 180
        },
        "deps": {
          "dependencies": ["cross-fetch"],
          "devDependencies": ["vitest"],
          "peerDependencies": [],
          "total": 2
        },
        "internal-deps": {
          "dependencies": [],
          "devDependencies": [],
          "total": 0
        },
        "test-coverage": {
          "exists": true,
          "lines": 78.4,
          "functions": 82.1,
          "branches": 65.3,
          "statements": 78.4
        }
      }
    }
  ]
}
```

### Table 格式（面向人类）

```
=== Repo Stats ===
External deps: 186 unique  |  Duplicates: 3
Most depended: @coze/api (4), @coze/realtime-api (2)

=== Package Stats ===
Package                    LOC     Deps  InternalDeps  Coverage
@coze/api                  8500    21        0          85.2%
@coze/realtime-api         3200    18        1          76.4%
...
```

---

## 八、面向 AI / Skills 的设计约定

1. **JSON 优先**：所有字段使用标准 JSON 类型，无循环引用，方便直接序列化传给 LLM
2. **单文件可消费**：`--output` 产物是一个完整 JSON 文件，AI 读一个文件即可得到全仓状态
3. **增量友好**：`collectedAt` 字段支持判断数据新鲜度，AI 可决定是否重新扫描
4. **错误不中断**：单个收集器失败时，该字段记录 `{ error: string }` 而不是崩溃整个扫描
5. **包过滤**：支持按包名精确匹配或 glob 过滤，AI 可按需缩小扫描范围

---

## 九、目录结构规划

```
infra/repo-lens/
├── src/
│   ├── cli.ts                      # CLI 入口（commander）
│   ├── engine.ts                   # LensEngine
│   ├── types.ts                    # 核心类型（含 PackageCollector / RepoCollector）
│   ├── collectors/
│   │   ├── index.ts                # presetCollectors 汇总导出
│   │   ├── package/                # Package 级收集器
│   │   │   ├── loc.ts
│   │   │   ├── deps.ts
│   │   │   ├── internal-deps.ts
│   │   │   └── test-coverage.ts
│   │   └── repo/                   # Repo 级收集器
│   │       ├── repo-deps.ts
│   │       └── repo-graph.ts
│   ├── formatters/
│   │   ├── json.ts                 # JSON 输出格式
│   │   └── table.ts                # Table 输出格式
│   └── utils/
│       └── rush.ts                 # Rush SDK 工具函数
├── docs/
│   └── requirements.md
└── __tests__/
    └── ut/
```

---

## 十、依赖规划

| 依赖 | 用途 |
|------|------|
| `@rushstack/rush-sdk` | 读取 rush.json，枚举所有 package |
| `commander` | CLI 框架（已有） |
| `fast-glob` | 文件扫描（LOC 收集器） |
| `@coze-infra/fs-enhance` | 文件读取工具（可复用 package-audit 的方式） |

---

## 十一、阶段规划

**Phase 1（当前）**：核心引擎 + 4 个 package 级收集器 + 2 个 repo 级收集器 + JSON/Table 输出 + CLI

**Phase 2（后续按需）**：
- `bundle-size` 收集器（package 级）：读取构建产物大小
- `owner` 收集器（package 级）：读取 OWNERS 文件
- 缓存机制：基于文件 hash 跳过未变更的 package
- Skills 集成：在 `.claude/skills/` 中封装调用脚本，供 AI 按需触发扫描
