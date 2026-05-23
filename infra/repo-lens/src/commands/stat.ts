import fs from 'fs/promises';
import path from 'path';

import type { Command } from 'commander';
import { RushConfiguration } from '@rushstack/rush-sdk';
import { logger } from '@coze-infra/rush-logger';

import { presetCollectors } from '../collectors';
import { testCoverageCollector } from '../collectors/package/test-coverage';
import { createLensEngine } from '../engine';
import { formatJson } from '../formatters/json';
import { formatTable } from '../formatters/table';
import type { OutputFormat, StatCollector } from '../types';
import { createLogger } from '../utils/debug';
import { filterProjects } from '../utils/filter';

const log = createLogger('command:stat');

const defaultCollectors = presetCollectors.filter(
  c => c.name !== testCoverageCollector.name,
);

export const registerStatCommand = (program: Command) => {
  program
    .command('stat')
    .description('统计 monorepo 中 package 的基础信息（代码行数、依赖等）')
    .addHelpText('after', `
包过滤（Rush 语义，可组合，取并集）:
  --only   仅该包本身，不含任何依赖关系
  --to     该包 + 它依赖的所有上游包（适合分析某包的完整依赖树）
  --from   该包 + 所有依赖它的下游包（适合评估改动影响范围）
  --filter 按包名 glob，如 "@coze-space/*"（适合按团队/模块过滤）

输出字段说明 (--format json):
  packages[].stats.loc
    sourceLines      源码行数（src/ 下，git 追踪文件）
    testLines        测试行数（__tests__/ 下）
    totalLines       合计行数
    sourceFileCount  源码文件数
    testFileCount    测试文件数
  packages[].stats.deps
    dependencies     运行时依赖包名列表
    devDependencies  开发依赖包名列表
    total            依赖总数
  packages[].stats.internal-deps
    dependencies     运行时内部依赖（workspace:* 的包）
    devDependencies  开发时内部依赖
    total            内部依赖总数
  packages[].stats.code-quality（仅 .ts/.tsx 源码文件，不含测试文件）
    tsIgnoreCount    @ts-ignore 指令总次数
    eslintDisableCount eslint-disable / eslint-disable-next-line / eslint-disable-line 指令总次数
    anyCount         any 关键字出现总次数（含类型注解、断言、泛型等场景）
    anyRatio         anyCount / 源码总行数（保留 4 位小数）
  repoStats.repo-deps
    total            全仓唯一外部依赖数
    duplicates       存在多版本的依赖列表（潜在冲突）
  repoStats.repo-graph
    edges            内部依赖边列表 [{from, to, type}]
    mostDepended     被依赖次数最多的包排行（改动风险最高）

示例:
  # 扫描全仓，输出 JSON 文件
  repo-lens stat --format json --output repo-snapshot.json

  # 只看某个包本身
  repo-lens stat --only @coze-space/app

  # 查看某包的完整上游依赖树
  repo-lens stat --to @coze-space/app --format json

  # 评估改动 @coze-arch/ui-kit 的影响范围
  repo-lens stat --from @coze-arch/ui-kit

  # 只统计代码行数，跳过其他收集器（更快）
  repo-lens stat --filter "@coze-infra/*" --collectors loc`)
    .option('--to <packages...>', '指定包及其所有上游依赖')
    .option('--from <packages...>', '指定包及其所有下游依赖')
    .option('--only <packages...>', '仅指定包本身，不含任何依赖')
    .option('--filter <patterns...>', '按包名 glob 匹配，如 @coze-space/*')
    .option(
      '--collectors <names>',
      '选择收集器（逗号分隔），默认全部',
    )
    .option('--format <format>', '输出格式：json | table', 'table')
    .option('--output <file>', '输出到文件（仅 json 格式）')
    .action(async options => {
      const start = Date.now();
      const rushConfig = RushConfiguration.loadFromDefaultLocation();
      let projects = [...rushConfig.projects];
      log('total projects in repo: %d', projects.length);

      projects = filterProjects(projects, {
        to: options.to,
        from: options.from,
        only: options.only,
        filter: options.filter,
      });
      log('projects after filter: %d', projects.length);

      let collectors: StatCollector[] = defaultCollectors;
      if (options.collectors) {
        const names = (options.collectors as string).split(',').map(s => s.trim());
        collectors = defaultCollectors.filter(c => names.includes(c.name));
        if (collectors.length === 0) {
          logger.error(`没有找到匹配的收集器: ${options.collectors}`);
          process.exit(1);
        }
      }
      log('collectors: [%s]', collectors.map(c => c.name).join(', '));

      const engine = createLensEngine(collectors);
      const snapshot = await engine.run(projects);
      log('snapshot ready: %d packages', snapshot.packages.length);

      const format = options.format as OutputFormat;

      if (format === 'json') {
        const output = formatJson(snapshot);
        if (options.output) {
          const outputPath = path.resolve(process.cwd(), options.output);
          await fs.writeFile(outputPath, output, 'utf-8');
          logger.success(`快照已写入: ${outputPath}`);
        } else {
          process.stdout.write(`${output}\n`);
        }
      } else {
        process.stdout.write(`${formatTable(snapshot)}\n`);
      }

      logger.info(`完成，耗时 ${((Date.now() - start) / 1000).toFixed(2)}s`);
    });
};
