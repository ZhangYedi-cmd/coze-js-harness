import type { StatCollector } from '../types';
import { codeQualityCollector } from './package/code-quality';
import { depsCollector } from './package/deps';
import { internalDepsCollector } from './package/internal-deps';
import { locCollector } from './package/loc';
import { testCoverageCollector } from './package/test-coverage';
import { repoDepsCollector } from './repo/repo-deps';
import { repoGraphCollector } from './repo/repo-graph';

export const presetCollectors: StatCollector[] = [
  locCollector,
  codeQualityCollector,
  depsCollector,
  internalDepsCollector,
  testCoverageCollector,
  repoDepsCollector,
  repoGraphCollector,
];

export { locCollector } from './package/loc';
export { codeQualityCollector } from './package/code-quality';
export { depsCollector } from './package/deps';
export { internalDepsCollector } from './package/internal-deps';
export { testCoverageCollector } from './package/test-coverage';
export { repoDepsCollector } from './repo/repo-deps';
export { repoGraphCollector } from './repo/repo-graph';
