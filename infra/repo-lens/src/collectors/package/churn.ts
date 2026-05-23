import { execSync } from 'child_process';

import type { PackageCollector } from '../../types';
import { createLogger } from '../../utils/debug';

const log = createLogger('collector:churn');

export interface ChurnStat {
  since: string;
  commits: number;
  linesAdded: number;
  linesDeleted: number;
  contributors: number;
}

const parseSince = (since: string): string => {
  const match = since.match(/^(\d+)(d|m|y)$/);
  // 不匹配则直接透传给 git，如 "2026-01-01"
  if (!match) {
    return since;
  }
  const [, n, unit] = match;
  const units: Record<string, string> = { d: 'days', m: 'months', y: 'years' };
  return `${n} ${units[unit]} ago`;
};

export const createChurnCollector = (since: string): PackageCollector<ChurnStat> => {
  const gitSince = parseSince(since);

  return {
    scope: 'package',
    name: 'churn',
    description: `统计最近 ${since} 内的代码变化频率（commits / 行变动 / 贡献者）`,
    collect(project) {
      const repoRoot = project.rushConfiguration.rushJsonFolder;
      const relPath = project.projectRelativeFolder;

      log('%s: git log --since="%s" -- %s', project.packageName, gitSince, relPath);
      let raw: string;
      try {
        raw = execSync(
          `git log --since="${gitSince}" --format="COMMIT %ae" --numstat -- "${relPath}"`,
          { cwd: repoRoot, encoding: 'utf-8' },
        );
      } catch (err) {
        log('%s: git log failed: %s', project.packageName, err instanceof Error ? err.message : String(err));
        return { since, commits: 0, linesAdded: 0, linesDeleted: 0, contributors: 0 };
      }

      const contributors = new Set<string>();
      let commits = 0;
      let linesAdded = 0;
      let linesDeleted = 0;

      for (const line of raw.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed) {
          continue;
        }

        if (trimmed.startsWith('COMMIT ')) {
          commits++;
          contributors.add(trimmed.slice(7).trim());
          continue;
        }

        // numstat 行格式: "<added>\t<deleted>\t<file>"，二进制文件为 "-\t-\t<file>"
        const parts = trimmed.split('\t');
        if (parts.length >= 2 && parts[0] !== '-') {
          linesAdded += parseInt(parts[0], 10) || 0;
          linesDeleted += parseInt(parts[1], 10) || 0;
        }
      }

      log('%s: commits=%d added=%d deleted=%d contributors=%d', project.packageName, commits, linesAdded, linesDeleted, contributors.size);
      return { since, commits, linesAdded, linesDeleted, contributors: contributors.size };
    },
  };
};
