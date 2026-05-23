import { describe, it, expect } from 'vitest';

import { formatTable } from '../../../src/formatters/table';
import type { RepoSnapshot } from '../../../src/types';

const buildSnapshot = (overrides: Partial<RepoSnapshot> = {}): RepoSnapshot => ({
  generatedAt: '2026-05-14T10:00:00.000Z',
  totalPackages: 1,
  repoStats: {
    'repo-deps': {
      total: 3,
      duplicates: [{ name: 'foo', versions: ['1.0.0', '2.0.0'], usedBy: ['a', 'b'] }],
      all: [],
    },
    'repo-graph': {
      edges: [],
      mostDepended: [
        { packageName: 'shared', count: 5 },
        { packageName: 'core', count: 3 },
      ],
    },
  },
  packages: [
    {
      packageName: 'pkg-a',
      packagePath: 'packages/a',
      level: 'level-1',
      collectedAt: '2026-05-14T10:00:00.000Z',
      stats: {
        loc: {
          sourceLines: 100,
          testLines: 50,
          totalLines: 150,
          sourceFileCount: 5,
          testFileCount: 2,
          fileCount: 7,
        },
        deps: { dependencies: [], devDependencies: [], peerDependencies: [], total: 4 },
        'internal-deps': { dependencies: [], devDependencies: [], total: 2 },
        'code-quality': { tsIgnoreCount: 1, eslintDisableCount: 2, anyCount: 3, anyRatio: 0.0123 },
      },
    },
  ],
  ...overrides,
});

describe('formatTable', () => {
  it('should include a Repo Stats header section', () => {
    const out = formatTable(buildSnapshot());
    expect(out).toContain('=== Repo Stats ===');
  });

  it('should include the total external dependency count and duplicate count', () => {
    const out = formatTable(buildSnapshot());
    expect(out).toContain('External deps: 3');
    expect(out).toContain('Duplicates: 1');
  });

  it('should list duplicate dependency versions when present', () => {
    const out = formatTable(buildSnapshot());
    expect(out).toContain('foo: 1.0.0, 2.0.0');
  });

  it('should render the top-5 mostDepended packages joined with commas', () => {
    const out = formatTable(buildSnapshot());
    expect(out).toContain('Most depended: shared (5), core (3)');
  });

  it('should include a Package Stats header section', () => {
    const out = formatTable(buildSnapshot());
    expect(out).toContain('=== Package Stats ===');
  });

  it('should render package rows with name, level and key counters', () => {
    const out = formatTable(buildSnapshot());
    expect(out).toContain('pkg-a');
    expect(out).toContain('level-1');
    expect(out).toContain('150'); // totalLines
    expect(out).toContain('0.0123'); // anyRatio formatted with 4 decimals
  });

  it('should render dashes for packages missing collector outputs', () => {
    const snap = buildSnapshot({
      packages: [
        {
          packageName: 'p',
          packagePath: 'packages/p',
          level: '-',
          collectedAt: '2026-05-14T10:00:00.000Z',
          stats: {},
        },
      ],
    });
    const out = formatTable(snap);
    expect(out).toContain('p');
    // Empty stats: each numeric column collapses to '-'
    expect(out.match(/-/g)?.length ?? 0).toBeGreaterThan(5);
  });

  it('should not render the duplicate dep list when repo-deps reports zero duplicates', () => {
    const snap = buildSnapshot({
      repoStats: {
        'repo-deps': { total: 1, duplicates: [], all: [] },
        'repo-graph': { edges: [], mostDepended: [] },
      },
    });
    const out = formatTable(snap);
    expect(out).not.toContain('Duplicate deps (multiple versions):');
  });

  it('should omit the Most depended line when no packages have inbound edges', () => {
    const snap = buildSnapshot({
      repoStats: {
        'repo-deps': { total: 0, duplicates: [], all: [] },
        'repo-graph': { edges: [], mostDepended: [] },
      },
    });
    const out = formatTable(snap);
    expect(out).not.toContain('Most depended:');
  });
});
