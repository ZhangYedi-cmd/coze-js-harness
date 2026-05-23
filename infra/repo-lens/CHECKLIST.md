# CLI 项目设置检查清单

使用此清单确保新创建的 CLI 项目配置正确。

## 项目创建后

- [ ] ⭐ 确认项目位置
  - [ ] 项目位于 `apps/` 目录（而非 `packages/`）
  - [ ] CLI 工具是对外发布的应用

- [ ] 修改 CLI 命令名称（默认为 `cli-tool`）
  - [ ] 更新 `package.json` 中的 `bin` 字段
  - [ ] 更新 `package.json` 中的 `cozePublishConfig.bin` 字段
  - [ ] 更新 `src/index.ts` 中的 `program.name()`

- [ ] 添加执行权限
  ```bash
  chmod +x src/cli.js
  ```

- [ ] 运行 rush update
  ```bash
  rush update
  ```

## 文档完善

- [ ] 填写 `docs/requirements.md`
  - [ ] 项目目标
  - [ ] 用户故事
  - [ ] 功能需求

- [ ] 完善 `docs/technical-design.md`
  - [ ] 系统架构
  - [ ] 技术选型
  - [ ] 核心模块设计

- [ ] 更新 `docs/how-to-dev.md`
  - [ ] 开发环境设置
  - [ ] 调试方法
  - [ ] 开发流程

- [ ] 维护 `docs/dev_log.md`
  - [ ] 记录开发过程
  - [ ] 记录关键决策
  - [ ] 记录问题和解决方案

## 代码实现

- [ ] 移除或修改示例命令 (`src/commands/example.ts`)
- [ ] 实现实际的命令功能
- [ ] 添加必要的工具函数 (`src/utils/`)
- [ ] 定义类型 (`src/types.ts`)

## 测试

- [ ] 编写单元测试 (`__tests__/ut/`)
  - [ ] 工具函数测试
  - [ ] 核心逻辑测试
  - [ ] 目标: >80% 覆盖率

- [ ] 编写 E2E 测试 (`__tests__/e2e/`)
  - [ ] 主要命令测试
  - [ ] 错误处理测试
  - [ ] 边界情况测试

- [ ] 运行所有测试
  ```bash
  pnpm test:all
  ```

## 构建和发布

- [ ] 构建成功
  ```bash
  pnpm build
  ```

- [ ] 测试构建产物
  ```bash
  node lib/cli.js [command]
  ```

- [ ] ⭐ 发布配置检查（如果需要发布）
  - [ ] `rush.json` 中设置 `"shouldPublish": true`
  - [ ] `package.json` 的 `files` 字段正确配置
    - [ ] 包含 `lib`, `bin`, `README.md`
    - [ ] ⭐ 排除 `!**/*.tsbuildinfo`
    - [ ] ⭐ 排除 `!**/*.map`
    - [ ] 不包含 `src/` 目录
  - [ ] `cozePublishConfig` 正确配置
    - [ ] `bin` 指向 `bin/main`
    - [ ] `main` 指向 `./lib/index.js`
    - [ ] `types` 指向 `./lib/index.d.ts`
  - [ ] `publishConfig` 设置正确的 registry
  - [ ] `.npmrc` 创建（如果是 npm registry）

- [ ] 验证发布内容
  ```bash
  npm pack --dry-run
  ```

- [ ] 更新 `README.md`
  - [ ] 使用示例
  - [ ] API 文档
  - [ ] 贡献指南

## 代码质量

- [ ] ESLint 通过
  ```bash
  pnpm lint
  ```

- [ ] 遵循函数式编程规范
  - [ ] 使用纯函数
  - [ ] 避免 class
  - [ ] 不可变数据

- [ ] 代码审查
  - [ ] 清晰的命名
  - [ ] 充分的注释
  - [ ] 合理的抽象

## Git 工作流

- [ ] 创建 feature 分支
- [ ] 提交代码（遵循 commit 规范）
- [ ] 创建 MR
- [ ] Code Review
- [ ] 合并到主分支

## 最佳实践检查

参考 `.agents/rules/cli-development.md`：

- [ ] ✅ 本地源码运行支持
- [ ] ✅ 完整的文档
- [ ] ✅ E2E 测试覆盖
- [ ] ✅ 清晰的入口架构
- [ ] ✅ 合理的代码分层
- [ ] ✅ 充分的单元测试
- [ ] ✅ 脚本自动化
- [ ] ✅ Rollup 打包配置

---

## 快速验证

一键验证项目基本功能：

```bash
# 1. 本地运行
./src/cli.js --help

# 2. 运行测试
pnpm test
pnpm test:e2e

# 3. 构建
pnpm build

# 4. Lint
pnpm lint
```

如果以上命令都成功，说明项目基本配置正确！
