import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

import type { PackageCollector } from '../../types';
import { createLogger } from '../../utils/debug';

const log = createLogger('collector:loc');

export interface LocStat {
  sourceLines: number;
  testLines: number;
  totalLines: number;
  sourceFileCount: number;
  testFileCount: number;
  fileCount: number;
}

const SOURCE_EXT = /\.(ts|tsx|js|jsx)$/;
const TEST_PATTERN = /[/\\](__tests__|\.test\.|\.spec\.)/;
const TEST_EXT = /\.(test|spec)\.(ts|tsx|js|jsx)$/;

const getGitTrackedFiles = (cwd: string): string[] => {
  const output = execSync('git ls-files', { cwd, encoding: 'utf-8' });
  return output
    .split('\n')
    .map(f => f.trim())
    .filter(f => f.length > 0 && SOURCE_EXT.test(f))
    .map(f => path.resolve(cwd, f));
};

const countLines = (filePath: string): number => {
  try {
    return fs.readFileSync(filePath, 'utf-8').split('\n').length;
  } catch {
    return 0;
  }
};

export const locCollector: PackageCollector<LocStat> = {
  scope: 'package',
  name: 'loc',
  description: '统计每个 package 的代码行数（仅 git 追踪文件，源码 / 测试 / 总计）',
  collect(project) {
    const files = getGitTrackedFiles(project.projectFolder);
    log('%s: %d tracked source files', project.packageName, files.length);

    let sourceLines = 0;
    let testLines = 0;
    let sourceFileCount = 0;
    let testFileCount = 0;

    for (const file of files) {
      const lines = countLines(file);
      const isTest = TEST_PATTERN.test(file) || TEST_EXT.test(path.basename(file));
      if (isTest) {
        testLines += lines;
        testFileCount++;
      } else {
        sourceLines += lines;
        sourceFileCount++;
      }
    }

    log('%s: src=%d lines/%d files, test=%d lines/%d files', project.packageName, sourceLines, sourceFileCount, testLines, testFileCount);
    return {
      sourceLines,
      testLines,
      totalLines: sourceLines + testLines,
      sourceFileCount,
      testFileCount,
      fileCount: files.length,
    };
  },
};
