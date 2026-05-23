#!/usr/bin/env node

import { Command } from 'commander';

import { registerStatCommand } from './commands/stat';
import { registerChurnCommand } from './commands/churn';
import { registerCovCommand } from './commands/cov';
import { registerListCommand } from './commands/list';

const main = () => {
  const program = new Command();

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const packageJson = require('../package.json') as { version: string };

  program
    .name('repo-lens')
    .description('面向 AI 的仓库状态快照工具 — 读取 rush.json，对每个 package 运行统计收集器，输出结构化 JSON 供 AI 分析整个仓库状态。')
    .version(packageJson.version)
    .addHelpText('after', `
命令速查:
  stat    基础快照：代码行数、依赖数量、内部依赖关系、全仓依赖图
  churn   变化度：基于 git history 的 commit 数 / 行变动 / 贡献者
  cov     覆盖率：读取 vitest coverage 产物（暂未实现）
  list    列出所有可用收集器

AI 典型用法:
  # 获取整个仓库的结构化快照（推荐写入文件供后续分析）
  repo-lens stat --format json --output repo-snapshot.json

  # 分析某个包及其依赖的近期活跃度
  repo-lens churn --to @coze-space/app --since 30d --format json

  # 定位变更最频繁的包（高风险区域）
  repo-lens churn --filter "@coze-space/*" --sort added --format json

调试: 设置 DEBUG=repo-lens:* 可查看详细执行日志`);

  registerStatCommand(program);
  registerChurnCommand(program);
  registerCovCommand(program);
  registerListCommand(program);

  process.on('uncaughtException', error => {
    console.error('Error:', error.message);
    process.exit(1);
  });

  process.on('unhandledRejection', reason => {
    console.error('Error:', reason);
    process.exit(1);
  });

  program.parse(process.argv);
};

main();

export { createLensEngine } from './engine';
export { presetCollectors } from './collectors';
export type { StatCollector, PackageCollector, RepoCollector, RepoSnapshot, PackageStat } from './types';
