import path from 'path';

import { isFileExists, readJsonFile } from '@coze-infra/fs-enhance';

import type { PackageCollector } from '../../types';

export interface TestCoverageStat {
  exists: boolean;
  lines: number | null;
  functions: number | null;
  branches: number | null;
  statements: number | null;
}

interface CoverageSummary {
  total: {
    lines: { pct: number };
    functions: { pct: number };
    branches: { pct: number };
    statements: { pct: number };
  };
}

export const testCoverageCollector: PackageCollector<TestCoverageStat> = {
  scope: 'package',
  name: 'test-coverage',
  description: '读取 vitest coverage 产物，提取覆盖率摘要（不主动触发测试）',
  async collect(project) {
    const coveragePath = path.resolve(
      project.projectFolder,
      'coverage/coverage-summary.json',
    );

    if (!(await isFileExists(coveragePath))) {
      return { exists: false, lines: null, functions: null, branches: null, statements: null };
    }

    try {
      const summary = await readJsonFile<CoverageSummary>(coveragePath);
      const { total } = summary;
      return {
        exists: true,
        lines: total.lines.pct,
        functions: total.functions.pct,
        branches: total.branches.pct,
        statements: total.statements.pct,
      };
    } catch {
      return { exists: false, lines: null, functions: null, branches: null, statements: null };
    }
  },
};
