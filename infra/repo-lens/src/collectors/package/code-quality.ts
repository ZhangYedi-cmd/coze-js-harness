import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

import type { PackageCollector } from '../../types';
import { createLogger } from '../../utils/debug';

const log = createLogger('collector:code-quality');

export interface CodeQualityStat {
  tsIgnoreCount: number;
  eslintDisableCount: number;
  anyCount: number;
  anyRatio: number;
}

const SOURCE_EXT = /\.(ts|tsx)$/;
const TEST_PATTERN = /[/\\](__tests__|\.test\.|\.spec\.)/;
const TEST_EXT = /\.(test|spec)\.(ts|tsx)$/;

// start_aigc
const TS_IGNORE_RE = /\/\/\s*@ts-ignore/g;
const ESLINT_DISABLE_RE = /\/[/*]\s*eslint-disable(?:-next-line|-line)?(?:\s|$|\*\/)/g;
const ANY_TYPE_RE = /\bany\b/g;

const getGitTrackedSourceFiles = (cwd: string): string[] => {
  const output = execSync('git ls-files', { cwd, encoding: 'utf-8' });
  return output
    .split('\n')
    .map(f => f.trim())
    .filter(f => f.length > 0 && SOURCE_EXT.test(f))
    .filter(f => !TEST_PATTERN.test(f) && !TEST_EXT.test(path.basename(f)))
    .map(f => path.resolve(cwd, f));
};

const countMatches = (content: string, re: RegExp): number => {
  const matches = content.match(re);
  return matches ? matches.length : 0;
};

export const codeQualityCollector: PackageCollector<CodeQualityStat> = {
  scope: 'package',
  name: 'code-quality',
  description: '统计 @ts-ignore、eslint-disable、any 类型出现次数及 any/代码行比例（仅源码文件）',
  collect(project) {
    const files = getGitTrackedSourceFiles(project.projectFolder);
    log('%s: %d tracked source files', project.packageName, files.length);

    let tsIgnoreCount = 0;
    let eslintDisableCount = 0;
    let anyCount = 0;
    let totalSourceLines = 0;

    for (const file of files) {
      let content: string;
      try {
        content = fs.readFileSync(file, 'utf-8');
      } catch {
        continue;
      }

      totalSourceLines += content.split('\n').length;
      tsIgnoreCount += countMatches(content, TS_IGNORE_RE);
      eslintDisableCount += countMatches(content, ESLINT_DISABLE_RE);
      anyCount += countMatches(content, ANY_TYPE_RE);
    }

    const anyRatio = totalSourceLines > 0
      ? Math.round((anyCount / totalSourceLines) * 10000) / 10000
      : 0;

    log(
      '%s: ts-ignore=%d, eslint-disable=%d, any=%d, anyRatio=%s',
      project.packageName,
      tsIgnoreCount,
      eslintDisableCount,
      anyCount,
      anyRatio,
    );

    return { tsIgnoreCount, eslintDisableCount, anyCount, anyRatio };
  },
};
// end_aigc
