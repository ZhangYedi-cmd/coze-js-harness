# CLI Tool Template

这是一个基于最佳实践的 CLI 工具脚手架模板，遵循 `.agents/rules/cli-development.md` 中定义的开发规范。

## 使用方法

### 1. 创建新的 CLI 项目

```bash
# 使用 Rush 的 init-project 命令
rush init-project --template cli-tool

# 按照提示输入信息：
# - Package name: @coze-arch/my-cli
# - Description: My awesome CLI tool
# - Author: your.email@example.com
# - Team: your-team
# - Subspace: apps (⭐ CLI 工具应该放在 apps 目录)
# - Level: 3 (或其他)

# 创建后需要手动配置（见下方说明）
```

**⭐ 重要**: CLI 工具应该放在 `apps/` 目录下，而不是 `packages/` 目录。

- ✅ `apps/my-cli/` - CLI 工具（对外发布的应用）
- ❌ `packages/my-cli/` - 库（被其他包导入的依赖）

### 2. 模板变量

创建项目时，以下变量会被替换：

- `@coze-arch/repo-lens`: 包名称（如 `@coze-arch/my-cli`）
- `repo lens`: 项目描述
- `your.email@example.com`: 作者信息
- ``: 项目目录名（从 packageName 提取）

**注意**: 创建项目后，需要手动配置：
1. **修改 CLI 命令名称**（默认为 `cli-tool`）：
   - 在 `package.json` 的 `bin` 字段中修改命令名
   - 在 `package.json` 的 `cozePublishConfig.bin` 中修改命令名
   - 在 `src/index.ts` 中修改 `program.name()`

2. **配置发布设置**（如果需要发布）：
   - 在 `rush.json` 中设置 `"shouldPublish": true`
   - 根据目标仓库配置 `publishConfig` 和 `.npmrc`

### 3. 项目结构

```
your-cli/
├── bin/                          # 可执行文件（构建后生成）
├── src/                          # 源代码
│   ├── cli.js                    # ⭐ 本地开发入口
│   ├── index.ts                  # 主程序入口
│   ├── commands/                 # 命令处理器
│   │   └── example.ts            # 示例命令
│   ├── utils/                    # 工具函数
│   └── types.ts                  # 类型定义
├── __tests__/                    # 测试
│   ├── ut/                       # 单元测试
│   └── e2e/                      # E2E 测试
├── scripts/                      # 自动化脚本
│   ├── build.ts                  # 构建脚本
│   ├── prebuild.ts              # 预构建
│   ├── e2e.sh                   # E2E 测试
│   └── test-coverage.sh         # 覆盖率测试
├── docs/                         # 文档
│   ├── README.md                # 文档索引
│   ├── requirements.md          # 需求文档
│   ├── technical-design.md      # 技术设计
│   ├── how-to-dev.md           # 开发指南
│   └── dev_log.md              # 开发日志
├── config/                       # 配置
│   └── rush-project.json        # Rush 项目配置
├── package.json                  # 包配置
├── rollup.config.cjs            # Rollup 打包配置
├── tsconfig.json                # TypeScript 配置
├── vitest.config.ts             # 单测配置
├── vitest.e2e.config.ts         # E2E 测试配置
└── README.md                     # 项目说明
```

## 核心特性

### ⭐ 1. 本地源码运行

无需构建即可运行：

```bash
# 直接运行源码
node apps/your-cli/src/cli.js [command]

# 或添加执行权限后
chmod +x apps/your-cli/src/cli.js
./apps/your-cli/src/cli.js [command]
```

### ⭐ 2. 完整的文档

在 `docs/` 目录中包含：
- **requirements.md**: 需求分析和用户故事
- **technical-design.md**: 技术架构和设计决策
- **how-to-dev.md**: 开发指南和最佳实践
- **dev_log.md**: 开发过程记录

### ⭐ 3. 测试覆盖

- **单元测试** (`__tests__/ut/`): 测试单个函数和模块
- **E2E 测试** (`__tests__/e2e/`): 测试完整的命令链路

### ⭐ 4. 自动化脚本

- `pnpm build`: 使用 Rollup 打包
- `pnpm test`: 运行单元测试
- `pnpm test:e2e`: 运行 E2E 测试
- `pnpm test:cov`: 生成覆盖率报告
- `pnpm test:all`: 运行所有测试

## 开发流程

### 1. 初始设置

```bash
# 安装依赖
rush update

# 使 CLI 可执行
chmod +x apps/your-cli/src/cli.js
```

### 2. 添加新命令

1. 在 `src/commands/` 创建新文件：

```typescript
// src/commands/my-command.ts
import { Command } from 'commander';

export const registerCommand = (program: Command) => {
  program
    .command('my-command')
    .description('My command description')
    .option('--option <value>', 'Option description')
    .action(async (options) => {
      console.log('Command executed!');
    });
};
```

2. 在 `src/index.ts` 中注册：

```typescript
import { registerCommand as registerMyCommand } from './commands/my-command';

const commands = [
  registerExampleCommand,
  registerMyCommand, // 添加这里
];
```

3. 添加测试：

```typescript
// __tests__/e2e/my-command.test.ts
import { describe, it, expect } from 'vitest';
import { execSync } from 'child_process';
import path from 'path';

describe('E2E: my-command', () => {
  const cliPath = path.resolve(__dirname, '../../src/cli.js');

  it('should execute successfully', () => {
    const output = execSync(`node ${cliPath} my-command`, {
      encoding: 'utf-8',
    });
    expect(output).toContain('Command executed!');
  });
});
```

### 3. 本地测试

```bash
# 运行命令
node apps/your-cli/src/cli.js my-command --option value

# 运行测试
cd apps/your-cli
pnpm test
pnpm test:e2e
```

### 4. 构建

```bash
# 构建
pnpm build

# 测试构建产物
node lib/cli.js my-command
```

## 编码规范

遵循函数式编程原则：

- ✅ 使用纯函数
- ✅ 避免副作用
- ✅ 使用不可变数据
- ❌ 禁止使用 class
- ❌ 避免可变状态

## 技术栈

- **Commander.js** (`~12.1.0`): CLI 框架
- **TypeScript**: 类型安全
- **Rollup**: 打包工具
- **Vitest** (`~4.0.18`): 测试框架
- **Sucrase**: TypeScript 转译（开发时）
- **TSX**: TypeScript 执行器

## 发布配置

如果你需要将 CLI 工具发布到 npm，需要配置发布相关设置。

### 1. 配置 rush.json

在 `rush.json` 中找到你的项目，添加 `shouldPublish`:

```json
{
  "packageName": "@coze-arch/my-cli",
  "projectFolder": "apps/my-cli",
  "shouldPublish": true,
  "tags": ["level-3"]
}
```

### 2. 验证 files 配置

确保 `package.json` 的 `files` 字段正确配置：

```json
{
  "files": [
    "lib",                    // ✅ 构建输出
    "bin",                    // ✅ CLI 可执行文件
    "README.md",              // ✅ 文档
    "!**/*.tsbuildinfo",      // ⭐ 必须排除
    "!**/*.map"               // ⭐ 必须排除
  ]
}
```

**验证命令**:
```bash
npm pack --dry-run
```

### 3. 配置 cozePublishConfig

确保 `cozePublishConfig` 正确设置：

```json
{
  "cozePublishConfig": {
    "bin": {
      "my-cli": "bin/main"
    },
    "main": "./lib/index.js",
    "types": "./lib/index.d.ts"
  }
}
```

### 4. 选择发布仓库

#### 发布到 npm (npmjs.org)

1. 创建 `.npmrc` 文件：
```
//registry.npmjs.org/:_authToken=${NPM_AUTH_TOKEN}
```

2. 更新 `publishConfig`:
```json
{
  "publishConfig": {
    "access": "public",
    "registry": "https://registry.npmjs.org"
  }
}
```

### 5. 发布命令

```bash
# 只发布当前包
rush pub -o @coze-arch/my-cli

# 发布当前包及其所有依赖者
rush pub -t @coze-arch/my-cli

# 发布当前包及其所有依赖
rush pub --from @coze-arch/my-cli
```

**注意**:
- ⚠️ 永远不要使用 `npm publish` 直接发布
- ✅ 始终使用 `rush pub` 命令
- `rush pub` 会自动运行构建并应用 `cozePublishConfig`

### 发布前检查清单

- [ ] `shouldPublish: true` 在 rush.json 中
- [ ] `files` 字段排除了 `.tsbuildinfo` 和 `.map`
- [ ] `cozePublishConfig` 正确配置
- [ ] 构建成功 (`pnpm build`)
- [ ] 所有测试通过 (`pnpm test:all`)
- [ ] README.md 更新
- [ ] 版本号正确

---

## 参考文档

- [CLI 开发规范](.agents/rules/cli-development.md)
- [包发布配置](.claude/skills/setup-package-publish/SKILL.md)
- [参考实现: apps/coze-init-cli](apps/coze-init-cli)

## 下一步

1. 📝 填写 `docs/requirements.md` - 明确需求和目标
2. 🏗️ 完善 `docs/technical-design.md` - 设计技术架构
3. 💻 实现你的命令 - 替换示例命令
4. ✅ 编写测试 - 确保代码质量
5. 📖 更新 `docs/dev_log.md` - 记录开发过程

## 常见问题

### Q: 如何更改 CLI 命令名称？

A: 需要在三个地方修改：

1. `package.json` 的 `bin` 字段：
```json
{
  "bin": {
    "your-cli-name": "bin/main"
  }
}
```

2. `package.json` 的 `cozePublishConfig.bin` 字段：
```json
{
  "cozePublishConfig": {
    "bin": {
      "your-cli-name": "bin/main"
    }
  }
}
```

3. `src/index.ts` 中的 `program.name()`：
```typescript
program.name('your-cli-name')
```

### Q: 什么是 cozePublishConfig？

A: `cozePublishConfig` 是 Rush 发布时的配置替换机制：

- **开发时**: `package.json` 中 `main` 指向 `src/index.ts`，方便本地开发
- **发布时**: `rush pub` 会用 `cozePublishConfig` 中的配置替换，`main` 指向 `lib/index.js`
- **好处**: 无需维护两份 package.json，开发和发布环境自动切换

### Q: files 字段为什么要排除 .tsbuildinfo 和 .map？

A: 这些是构建过程文件，不应该发布到 npm：

- `*.tsbuildinfo`: TypeScript 增量编译缓存，用户不需要
- `*.map`: Source maps，除非需要生产环境调试，否则会增加包体积

**验证**: 使用 `npm pack --dry-run` 查看哪些文件会被发布。

### Q: 如何添加新的依赖？

A: 按照 Rush monorepo 规范：

1. 编辑 `package.json`，添加依赖
2. 从 repo 根目录运行 `rush update`

### Q: 如何调试 CLI？

A: 使用 Node.js 调试器：

```bash
node --inspect-brk apps/your-cli/src/cli.js [command]
```

或在 VS Code 中配置 launch.json。

## 支持

如有问题，请参考：
- [CLI 开发规范](.agents/rules/cli-development.md)
- [参考实现](apps/coze-init-cli)
