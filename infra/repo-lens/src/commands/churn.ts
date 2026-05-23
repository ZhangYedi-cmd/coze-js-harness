import fs from 'fs/promises';
import path from 'path';

import type { Command } from 'commander';
import { RushConfiguration } from '@rushstack/rush-sdk';
import { logger } from '@coze-infra/rush-logger';

import { createChurnCollector } from '../collectors/package/churn';
import { createLensEngine } from '../engine';
import { formatJson } from '../formatters/json';
import type { ChurnStat } from '../collectors/package/churn';
import type { OutputFormat, RepoSnapshot } from '../types';
import { createLogger } from '../utils/debug';
import { filterProjects } from '../utils/filter';

const log = createLogger('command:churn');

type SortField = 'commits' | 'added' | 'deleted' | 'contributors';

const SORT_KEY_MAP: Record<SortField, keyof ChurnStat> = {
  commits: 'commits',
  added: 'linesAdded',
  deleted: 'linesDeleted',
  contributors: 'contributors',
};

const sortPackages = (snapshot: RepoSnapshot, sortBy: SortField): RepoSnapshot => {
  const sorted = [...snapshot.packages].sort((a, b) => {
    const sa = a.stats.churn as ChurnStat | undefined;
    const sb = b.stats.churn as ChurnStat | undefined;
    const key = SORT_KEY_MAP[sortBy];
    return ((sb?.[key] as number) ?? 0) - ((sa?.[key] as number) ?? 0);
  });
  return { ...snapshot, packages: sorted };
};

const formatChurnTable = (snapshot: RepoSnapshot): string => {
  const lines: string[] = [];
  const COL_PKG = 40;
  const COL_LEVEL = 10;
  const COL_CMT = 10;
  const COL_ADD = 10;
  const COL_DEL = 10;
  const COL_CTR = 12;

  const pad = (s: string | number, w: number) => String(s).padEnd(w);

  lines.push(
    pad('Package', COL_PKG) +
      pad('Level', COL_LEVEL) +
      pad('Commits', COL_CMT) +
      pad('Added', COL_ADD) +
      pad('Deleted', COL_DEL) +
      pad('Contributors', COL_CTR),
  );
  lines.push('-'.repeat(COL_PKG + COL_LEVEL + COL_CMT + COL_ADD + COL_DEL + COL_CTR));

  for (const pkg of snapshot.packages) {
    const s = pkg.stats.churn as ChurnStat | undefined;
    lines.push(
      pad(pkg.packageName, COL_PKG) +
        pad(pkg.level, COL_LEVEL) +
        pad(s ? s.commits : '-', COL_CMT) +
        pad(s ? `+${s.linesAdded}` : '-', COL_ADD) +
        pad(s ? `-${s.linesDeleted}` : '-', COL_DEL) +
        pad(s ? s.contributors : '-', COL_CTR),
    );
  }

  return lines.join('\n');
};

export const registerChurnCommand = (program: Command) => {
  program
    .command('churn')
    .description('统计 package 最近一段时间内的代码变化频率（基于 git commit history）')
    .addHelpText('after', `
--since 格式:
  30d          最近 30 天
  3m           最近 3 个月
  1y           最近 1 年
  2026-01-01   指定起始日期（ISO 格式）

输出字段说明 (--format json):
  packages[].stats.churn
    since          统计起始区间（原始输入值）
    commits        该包目录下的 commit 次数
    linesAdded     累计新增行数
    linesDeleted   累计删除行数
    contributors   去重贡献者人数（基于 git 邮箱）

排序字段 (--sort):
  commits       按提交次数降序（默认，反映整体活跃度）
  added         按新增行数降序（反映功能扩张速度）
  deleted       按删除行数降序（反映重构/清理力度）
  contributors  按贡献者人数降序（反映协作广度）

示例:
  # 查看最近 30 天最活跃的包（默认）
  repo-lens churn --format table

  # 找出近 3 个月行变动最大的包
  repo-lens churn --since 3m --sort added --format json

  # 分析某包及其上游最近的活跃度
  repo-lens churn --to @coze-space/app --since 30d

  # 找出某模块下参与人数最多的包
  repo-lens churn --filter "@coze-space/*" --sort contributors`)
    .option('--since <duration>', '统计时间范围，支持 30d / 3m / 1y 或 ISO 日期', '30d')
    .option('--to <packages...>', '指定包及其所有上游依赖')
    .option('--from <packages...>', '指定包及其所有下游依赖')
    .option('--only <packages...>', '仅指定包本身，不含任何依赖')
    .option('--filter <patterns...>', '按包名 glob 匹配，如 @coze-space/*')
    .option('--sort <field>', '排序字段：commits | added | deleted | contributors', 'commits')
    .option('--format <format>', '输出格式：json | table', 'table')
    .option('--output <file>', '输出到文件（仅 json 格式）')
    .action(async options => {
      const start = Date.now();
      log('since: %s, sort: %s', options.since, options.sort);

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

      const collector = createChurnCollector(options.since as string);
      const engine = createLensEngine([collector]);
      const rawSnapshot = await engine.run(projects);
      log('snapshot ready: %d packages', rawSnapshot.packages.length);

      const snapshot = sortPackages(rawSnapshot, options.sort as SortField);

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
        process.stdout.write(`${formatChurnTable(snapshot)}\n`);
      }

      logger.info(`完成，耗时 ${((Date.now() - start) / 1000).toFixed(2)}s`);
    });
};
