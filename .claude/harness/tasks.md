# Harness Task Registry

每个任务用 HTML comment 块声明，调度器（harness-dispatcher）解析此文件选取任务。

字段说明：
- `name`：任务唯一标识，用于分支名、PR 标题、日志文件名
- `description`：一句话说明，面向人类读者
- `prompt`：调度器直接交给 AI 执行的指令，可调用任意 skill
- `weight`：选中概率权重（越大越容易被选中）；运行时会叠加历史折扣和负载折扣
- `enabled`：false 时不参与选取

---

<!-- task
name: dead-code-cleaner
description: 找出候选包，删除无任何引用的死代码文件
prompt: |
  1. 运行 /repo-lens，获取仓库候选包推荐列表（按评分从高到低）
  2. 运行 node .claude/skills/harness-dispatcher/parse-history.js，排除近 30 天已被 dead-code-cleaner 处理过的包
  3. 从剩余候选中选取推荐分最高的包（优先选 packages/ 下的包）
  4. 在选中的包目录下，检查是否存在 knip 配置（knip.json / knip.config.ts），不存在则生成临时配置
  5. 运行 npx knip --include files 收集所有未被引用的文件列表
  6. 对每个候选文件做二次判断：排除 test fixture、.d.ts 声明文件、动态路径拼接引用的文件
  7. 批量删除确认无引用的文件
  8. 对每个删除的文件所在包运行 rush build && rush lint 验证；失败则逐文件回滚找出误删项
  9. 输出删除文件数量、验证结果
weight: 10
enabled: true
-->

<!-- task
name: dep-cleaner
description: 删除 package.json 中未被源码实际引用的冗余依赖
prompt: |
  1. 运行 /repo-lens，获取仓库候选包推荐列表
  2. 运行 node .claude/skills/harness-dispatcher/parse-history.js，排除近 30 天已被 dep-cleaner 处理过的包
  3. 从剩余候选中选取推荐分最高的包
  4. 读取目标包的 package.json，收集 dependencies 和 devDependencies
  5. 静态扫描 src/ 下所有 .ts/.tsx/.js 文件的 import 语句，提取实际引用的包名
  6. 计算差集（声明了但未引用），对每个候选包做二次校验：
     - 排除 peerDependencies
     - 排除构建配置文件中引用的插件（vite.config / rspack.config 等）
     - 排除仅提供类型的 @types/* 包（若对应包存在则保留）
  7. 从 package.json 删除确认冗余的依赖
  8. 运行 node common/scripts/install-run-rush.js update，然后 rush build && rush lint 验证
  9. 验证失败则恢复被删依赖，输出无法删除的原因
weight: 10
enabled: true
-->

<!-- task
name: optimize-any-types
description: 消除 TypeScript any 类型，补充精确类型声明
prompt: |
  1. 运行 /repo-lens，获取仓库候选包推荐列表
  2. 运行 node .claude/skills/harness-dispatcher/parse-history.js，排除近 30 天已被 optimize-any-types 处理过的包
  3. 从剩余候选中选取推荐分最高的包
  4. 用 grep -rn ': any' --include="*.ts" --include="*.tsx" 统计目标包中所有显式 any 的位置和数量
  5. 按文件逐个处理，对每处 any 分析使用上下文：
     - 函数参数：根据调用侧传入的实际类型推断
     - 返回值：根据函数体内 return 语句推断
     - 变量声明：根据赋值右侧推断
  6. 将 any 替换为精确类型；无法确定时改为 unknown 并添加类型守卫
  7. 每处理完一个文件立即运行 npx tsc --noEmit，有错误则原地修复后再继续下一个文件
  8. 全部处理完后运行全量 rush build 验证
  9. 输出：消除 any 数量、剩余无法处理的数量及原因
weight: 8
enabled: true
-->

<!-- task
name: fix-eslint-disable
description: 删除不必要的 eslint-disable 注释，修复根因
prompt: |
  1. 运行 /repo-lens，获取仓库候选包推荐列表
  2. 运行 node .claude/skills/harness-dispatcher/parse-history.js，排除近 30 天已被 fix-eslint-disable 处理过的包
  3. 从剩余候选中选取推荐分最高的包
  4. 扫描目标包所有文件中的 eslint-disable / eslint-disable-next-line 注释
  5. 提取被禁用的规则名，过滤白名单规则（max-lines、max-params、@typescript-eslint/naming-convention 等纯风格规则，直接跳过）
  6. 对剩余规则逐个尝试修复根因：
     - react-hooks/exhaustive-deps：补全依赖数组，标注"需 reviewer 确认 effect 行为"
     - no-explicit-any：参考 optimize-any-types 的处理方式
     - 其他规则：根据错误信息修复根因
  7. 修复完成后删除对应的 disable 注释
  8. 运行 rush lint 验证，有新报错则回滚该文件的修改
  9. 输出：删除注释数、修复规则分布、跳过的白名单规则数；无法修复的注释保留并在 PR 描述中列出
weight: 7
enabled: true
-->

<!-- task
name: fix-ts-expect-error
description: 删除 @ts-expect-error 注释，修复底层类型结构
prompt: |
  1. 运行 /repo-lens，获取仓库候选包推荐列表
  2. 运行 node .claude/skills/harness-dispatcher/parse-history.js，排除近 30 天已被 fix-ts-expect-error 处理过的包
  3. 从剩余候选中选取推荐分最高的包
  4. 扫描目标包中所有 @ts-expect-error 注释
  5. 逐个处理：先移除注释，运行 npx tsc --noEmit 观察实际报错
     - 无报错：注释已失效，直接删除
     - 有报错：分析错误类型
       - 类型不兼容：修改类型声明或在调用侧添加类型收窄
       - 缺少属性：补全接口定义
       - 第三方库类型问题：考虑添加 .d.ts 补丁或升级 @types/* 包
  6. 每处理完一个注释立即 tsc 验证
  7. 全部完成后运行全量 rush build 确认无新增错误
  8. 输出：删除注释数（失效 vs 修复）、无法修复的数量及原因
weight: 7
enabled: true
-->

<!-- task
name: add-tests
description: 为测试覆盖不足的包补充 vitest 单元测试
prompt: |
  1. 运行 /repo-lens，获取仓库候选包推荐列表（优先选测试覆盖率低的包）
  2. 运行 node .claude/skills/harness-dispatcher/parse-history.js，排除近 30 天已被 add-tests 处理过的包
  3. 从剩余候选中选取推荐分最高的包
  4. 检测目标包使用的测试框架（查找 vitest.config.ts 或 package.json 中的 test 脚本），读取现有 setup 文件和测试配置
  5. 运行 rush test:cov（针对该包），找出覆盖率低于 60% 的模块（按行覆盖率排序）
  6. 从覆盖率最低的模块开始，逐个生成 vitest 测试：
     - 读取源码，理解函数签名、参数约束、返回值
     - 生成测试用例：主路径 + 边界条件（空值、越界）+ 异常分支（throw / reject）
     - 外部依赖（网络、文件、时间）一律 vi.mock，不发真实请求
  7. 写入测试文件，运行 rush test 验证全部通过
  8. 重新生成覆盖率报告，确认指标提升
  9. 输出：新增测试文件数、覆盖率变化、跳过的模块及原因
weight: 8
enabled: true
-->

<!-- task
name: update-deps
description: 升级 monorepo 中的非关键外部依赖到最新版本
prompt: |
  1. 在仓库根目录运行 npx npm-check-updates --jsonUpgraded，获取所有可升级依赖列表
  2. 过滤掉以下包（不升级）：react、react-dom、typescript、vite、webpack、rollup 及其插件生态、@microsoft/rush
  3. 按优先级选取 3-5 个候选包（@types/* > eslint-* / prettier > lodash / dayjs > UI 组件库）
  4. 逐包升级：
     a. 修改对应 package.json 的版本号
     b. 运行 node common/scripts/install-run-rush.js update
     c. 运行 rush build && rush lint
     d. 通过则继续下一个；失败且无法快速修复则回退版本，记录失败原因
  5. 若有任何包成功升级，所有变更将由 harness-dispatcher 统一提交 PR
  6. 输出：成功升级的包和版本变化、失败的包及原因（major 版本升级需在 PR 描述里附 changelog 链接）
weight: 6
enabled: true
-->

<!-- task
name: upgrade-rush-pnpm
description: 将 Rush 和 pnpm 升级到 npm 最新稳定版本
prompt: |
  1. 通过 npm view @microsoft/rush version 和 npm view pnpm version 获取最新稳定版本号
  2. 对比当前版本（读取 rush.json 的 rushVersion / pnpmVersion）
  3. 若已是最新则输出"已是最新版本"并停止
  4. 更新以下位置的版本引用：
     - rush.json: rushVersion、pnpmVersion
     - common/config/rush/.pnpmfile.cjs（如存在）
  5. 运行 node common/scripts/install-run-rush.js update --full
  6. 运行 rush build 验证整体构建通过
  7. 输出：版本变化（旧→新）、是否为 major 升级（major 升级需在 PR 描述中附 changelog）
weight: 3
enabled: true
-->

<!-- task
name: doc-sync
description: 检测仓库上下文文档（ARCHITECTURE.md、AGENTS.md、CLAUDE.md 等）与代码实际状态的偏差并更新
prompt: |
  1. 找出仓库中所有 ARCHITECTURE.md、AGENTS.md、CLAUDE.md、README.md 文件
  2. 对每个文档逐段分析：
     - 提到的目录/文件路径是否仍然存在
     - 提到的 package 名称是否与 rush.json 中的项目列表一致
     - 描述的命令是否仍然有效（对照 command-line.json 验证）
     - 描述的依赖关系是否与实际 package.json 一致
  3. 对明确过时的内容（路径不存在、包名已改）直接更新
  4. 对不确定的内容（架构描述、规范说明）标注 TODO 并在 PR 描述里列出，不擅自修改
  5. 运行 markdownlint（若配置存在）验证格式
  6. 输出：更新的文档数、修改段落数、需要人工确认的条目数
weight: 4
enabled: true
-->
