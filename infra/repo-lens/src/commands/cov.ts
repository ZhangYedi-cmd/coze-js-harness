import fs from 'fs/promises';
import path from 'path';
import { spawn } from 'child_process';

import type { Command } from 'commander';
import { RushConfiguration } from '@rushstack/rush-sdk';
import { logger } from '@coze-infra/rush-logger';

import type { OutputFormat, PackageStat, RepoSnapshot } from '../types';
import { createLogger } from '../utils/debug';
import { filterProjects } from '../utils/filter';

const log = createLogger('command:cov');

const safeJsonParse = <T>(raw: string): T | null => {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
};

interface CoverageSummaryTotal {
  lines: { pct: number };
  functions: { pct: number };
  branches: { pct: number };
  statements: { pct: number };
}

interface CoverageSummary {
  total: CoverageSummaryTotal;
}

interface CovResult {
  packageName: string;
  packagePath: string;
  level: string;
  lines: number | null;
  functions: number | null;
  branches: number | null;
  statements: number | null;
  exists: boolean;
}

const hasCovScript = (project: { packageJson: { scripts?: Record<string, string> } }): boolean =>
  Boolean(project.packageJson.scripts?.['test:cov']);

const getLevel = (tags: ReadonlySet<string>): string => {
  for (const tag of tags) {
    if (/^level-\d+$/.test(tag)) {
      return tag;
    }
  }
  return '-';
};

// start_aigc
const runRushCov = (packageNames: string[], parallelism: string): Promise<void> =>
  new Promise((resolve, reject) => {
    const args = ['test:cov'];
    for (const name of packageNames) {
      args.push('-o', name);
    }
    if (parallelism !== 'auto') {
      args.push('-p', parallelism);
    }
    // --verbose: stream each package's output in real time
    args.push('--verbose');

    const child = spawn('rush', args, { stdio: 'inherit', shell: false });

    child.on('error', err => reject(new Error(`Failed to spawn rush: ${err.message}`)));
    child.on('close', code => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`rush test:cov exited with code ${code}`));
      }
    });
  });

const readCoverage = async (projectFolder: string): Promise<CoverageSummaryTotal | null> => {
  const summaryPath = path.resolve(projectFolder, 'coverage/coverage-summary.json');
  try {
    const raw = await fs.readFile(summaryPath, 'utf-8');
    const parsed = safeJsonParse<CoverageSummary>(raw);
    return parsed?.total ?? null;
  } catch {
    return null;
  }
};

type SortField = 'lines' | 'statements' | 'functions' | 'branches';

const pct = (n: number | null): string => (n === null ? '-' : `${n.toFixed(1)}%`);

const sortResults = (results: CovResult[], sortBy: SortField): CovResult[] =>
  [...results].sort((a, b) => {
    const va = a[sortBy] ?? -Infinity;
    const vb = b[sortBy] ?? -Infinity;
    return vb - va;
  });

const formatCovTable = (results: CovResult[]): string => {
  const pad = (s: string | number, w: number) => String(s).padEnd(w);
  const COL_PKG = 45;
  const COL_LEVEL = 10;
  const COL_LINES = 10;
  const COL_STMTS = 10;
  const COL_FUNCS = 10;
  const COL_BRANCH = 10;

  const lines: string[] = [];
  lines.push(
    pad('Package', COL_PKG) +
      pad('Level', COL_LEVEL) +
      pad('Lines', COL_LINES) +
      pad('Stmts', COL_STMTS) +
      pad('Funcs', COL_FUNCS) +
      pad('Branches', COL_BRANCH),
  );
  lines.push('-'.repeat(COL_PKG + COL_LEVEL + COL_LINES + COL_STMTS + COL_FUNCS + COL_BRANCH));

  for (const r of results) {
    lines.push(
      pad(r.packageName, COL_PKG) +
        pad(r.level, COL_LEVEL) +
        pad(pct(r.lines), COL_LINES) +
        pad(pct(r.statements), COL_STMTS) +
        pad(pct(r.functions), COL_FUNCS) +
        pad(pct(r.branches), COL_BRANCH),
    );
  }

  return lines.join('\n');
};

const buildSnapshot = (results: CovResult[]): RepoSnapshot => {
  const packages: PackageStat[] = results.map(r => ({
    packageName: r.packageName,
    packagePath: r.packagePath,
    level: r.level,
    collectedAt: new Date().toISOString(),
    stats: {
      'test-coverage': {
        exists: r.exists,
        lines: r.lines,
        statements: r.statements,
        functions: r.functions,
        branches: r.branches,
      },
    },
  }));
  return {
    generatedAt: new Date().toISOString(),
    totalPackages: results.length,
    repoStats: {},
    packages,
  };
};
// end_aigc

export const registerCovCommand = (program: Command) => {
  program
    .command('cov')
    .description('运行 test:cov 并统计每个 package 的单测覆盖率')
    .addHelpText('after', `
说明:
  仅处理 package.json 中含 "test:cov" 脚本的包。
  使用 rush test:cov -o <pkg> ... --verbose 并发执行，输出直接透传到终端。
  任意包测试失败则立即退出，不展示覆盖率结果。

输出字段 (--format json):
  packages[].stats.test-coverage
    lines        行覆盖率 (%)
    statements   语句覆盖率 (%)
    functions    函数覆盖率 (%)
    branches     分支覆盖率 (%)
    exists       是否找到 coverage-summary.json

示例:
  # 扫描全仓（仅有 test:cov 脚本的包）
  repo-lens cov

  # 只测指定包
  repo-lens cov --only @coze-space/app

  # 测指定模块，结果写到文件
  repo-lens cov --filter "@coze-infra/*" --format json --output cov.json

  # 控制并发数
  repo-lens cov --parallelism 4

排序字段 (--sort):
  lines       按行覆盖率降序（默认，覆盖率最高排最前）
  statements  按语句覆盖率降序
  functions   按函数覆盖率降序
  branches    按分支覆盖率降序`)
    .option('--to <packages...>', '指定包及其所有上游依赖')
    .option('--from <packages...>', '指定包及其所有下游依赖')
    .option('--only <packages...>', '仅指定包本身，不含任何依赖')
    .option('--filter <patterns...>', '按包名 glob 匹配，如 @coze-space/*')
    .option('-p, --parallelism <count>', '传给 rush -p 的并发数', 'auto')
    .option('--sort <field>', '排序字段：lines | statements | functions | branches（降序，覆盖率最高的包排最前）', 'lines')
    .option('--format <format>', '输出格式：json | table', 'table')
    .option('--output <file>', '输出到文件（仅 json 格式）')
    .action(async options => {
      const start = Date.now();
      log('parallelism: %s, sort: %s, format: %s', options.parallelism, options.sort, options.format);

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

      // only packages that actually define test:cov
      const testableProjects = projects.filter(p =>
        hasCovScript(p as unknown as { packageJson: { scripts?: Record<string, string> } }),
      );
      log('testable packages: %d', testableProjects.length);

      if (testableProjects.length === 0) {
        logger.error('没有找到包含 test:cov 脚本的包（检查过滤条件或 package.json）');
        process.exit(1);
      }

      const names = testableProjects.map(p => p.packageName);
      log('testable package names: %o', names);
      logger.info(`准备测试 ${names.length} 个包：`);
      for (const n of names) {
        logger.debug(`  ${n}`);
      }

      try {
        await runRushCov(names, options.parallelism as string);
        log('rush test:cov complete');
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        log('rush test:cov failed: %s', msg);
        logger.error(`测试失败，终止覆盖率统计：${msg}`);
        process.exit(1);
      }

      logger.info('读取覆盖率产物...');

      const results: CovResult[] = await Promise.all(
        testableProjects.map(async p => {
          const cov = await readCoverage(p.projectFolder);
          log('%s: coverage exists=%s', p.packageName, cov !== null);
          return {
            packageName: p.packageName,
            packagePath: p.projectRelativeFolder,
            level: getLevel(p.tags),
            lines: cov?.lines.pct ?? null,
            functions: cov?.functions.pct ?? null,
            branches: cov?.branches.pct ?? null,
            statements: cov?.statements.pct ?? null,
            exists: cov !== null,
          };
        }),
      );
      log('coverage artifacts read for %d packages', results.length);

      const sorted = sortResults(results, options.sort as SortField);
      const format = options.format as OutputFormat;

      if (format === 'json') {
        const snapshot = buildSnapshot(sorted);
        const output = JSON.stringify(snapshot, null, 2);
        if (options.output) {
          const outputPath = path.resolve(process.cwd(), options.output as string);
          await fs.writeFile(outputPath, output, 'utf-8');
          logger.success(`覆盖率快照已写入: ${outputPath}`);
        } else {
          process.stdout.write(`${output}\n`);
        }
      } else {
        logger.info('=== 覆盖率汇总 ===');
        process.stdout.write(`${formatCovTable(sorted)}\n`);

        const missing = sorted.filter(r => !r.exists);
        if (missing.length > 0) {
          logger.warning('以下包未找到 coverage/coverage-summary.json（可能无源码或 vitest 配置了其他路径）：');
          for (const r of missing) {
            logger.warning(`  ${r.packageName}`);
          }
        }
      }

      logger.info(`完成，耗时 ${((Date.now() - start) / 1000).toFixed(2)}s`);
    });
};
