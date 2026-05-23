import { describe, it, expect, vi } from 'vitest';

vi.mock('../../../../src/utils/debug', () => ({
  createLogger: () => vi.fn(),
}));

import { repoDepsCollector } from '../../../../src/collectors/repo/repo-deps';

interface FakeProject {
  packageName: string;
  packageJson: {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
    peerDependencies?: Record<string, string>;
  };
}

const createProject = (
  packageName: string,
  pkgJson: FakeProject['packageJson'] = {},
): FakeProject => ({ packageName, packageJson: pkgJson });

describe('repoDepsCollector', () => {
  it('should expose repo scope and name metadata', () => {
    expect(repoDepsCollector.scope).toBe('repo');
    expect(repoDepsCollector.name).toBe('repo-deps');
  });

  it('should collect all unique external deps and the usedBy mapping', () => {
    const projects = [
      createProject('a', { dependencies: { foo: '^1.0.0', bar: '^1.0.0' } }),
      createProject('b', { dependencies: { foo: '^1.0.0' } }),
    ];
    const result = repoDepsCollector.collect(projects as never);
    expect(result.total).toBe(2);
    const foo = result.all.find(d => d.name === 'foo');
    expect(foo?.versions).toEqual(['^1.0.0']);
    expect(foo?.usedBy.sort()).toEqual(['a', 'b']);
  });

  it('should detect duplicate deps that have multiple versions', () => {
    const projects = [
      createProject('a', { dependencies: { foo: '^1.0.0' } }),
      createProject('b', { dependencies: { foo: '^2.0.0' } }),
      createProject('c', { dependencies: { bar: '^1.0.0' } }),
    ];
    const result = repoDepsCollector.collect(projects as never);
    expect(result.duplicates).toHaveLength(1);
    expect(result.duplicates[0].name).toBe('foo');
    expect(result.duplicates[0].versions.sort()).toEqual(['^1.0.0', '^2.0.0']);
  });

  it('should exclude workspace-protocol dependencies from the report', () => {
    const projects = [
      createProject('a', {
        dependencies: { '@scope/internal': 'workspace:*', external: '^1.0.0' },
      }),
    ];
    const result = repoDepsCollector.collect(projects as never);
    expect(result.total).toBe(1);
    expect(result.all[0].name).toBe('external');
  });

  it('should scan all three external dependency fields', () => {
    const projects = [
      createProject('a', {
        dependencies: { dep1: '^1.0.0' },
        devDependencies: { dep2: '^1.0.0' },
        peerDependencies: { dep3: '^1.0.0' },
      }),
    ];
    const result = repoDepsCollector.collect(projects as never);
    const names = result.all.map(d => d.name).sort();
    expect(names).toEqual(['dep1', 'dep2', 'dep3']);
  });

  it('should sort entries by dependency name', () => {
    const projects = [
      createProject('a', {
        dependencies: { zebra: '^1.0.0', apple: '^1.0.0', mango: '^1.0.0' },
      }),
    ];
    const result = repoDepsCollector.collect(projects as never);
    expect(result.all.map(d => d.name)).toEqual(['apple', 'mango', 'zebra']);
  });

  it('should return an empty report when no projects are passed', () => {
    const result = repoDepsCollector.collect([] as never);
    expect(result).toEqual({ total: 0, duplicates: [], all: [] });
  });

  it('should deduplicate usedBy entries when the same package appears in multiple version maps', () => {
    const projects = [
      createProject('a', {
        dependencies: { foo: '^1.0.0' },
        devDependencies: { foo: '^2.0.0' },
      }),
    ];
    const result = repoDepsCollector.collect(projects as never);
    const foo = result.all.find(d => d.name === 'foo');
    expect(foo?.usedBy).toEqual(['a']);
    expect(foo?.versions.sort()).toEqual(['^1.0.0', '^2.0.0']);
  });
});
