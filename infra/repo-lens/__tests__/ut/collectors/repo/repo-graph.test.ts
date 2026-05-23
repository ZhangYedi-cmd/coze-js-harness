import { describe, it, expect, vi } from 'vitest';

vi.mock('../../../../src/utils/debug', () => ({
  createLogger: () => vi.fn(),
}));

import { repoGraphCollector } from '../../../../src/collectors/repo/repo-graph';

interface FakeProject {
  packageName: string;
  packageJson: {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };
}

const createProject = (
  packageName: string,
  pkgJson: FakeProject['packageJson'] = {},
): FakeProject => ({ packageName, packageJson: pkgJson });

describe('repoGraphCollector', () => {
  it('should expose repo scope and name metadata', () => {
    expect(repoGraphCollector.scope).toBe('repo');
    expect(repoGraphCollector.name).toBe('repo-graph');
  });

  it('should only emit edges for workspace-protocol deps that point to known packages', () => {
    const projects = [
      createProject('a', {
        dependencies: {
          b: 'workspace:*',
          'external-pkg': '^1.0.0',
          'unknown-ws': 'workspace:*',
        },
      }),
      createProject('b'),
    ];
    const result = repoGraphCollector.collect(projects as never);
    expect(result.edges).toEqual([{ from: 'a', to: 'b', type: 'dep' }]);
  });

  it('should tag devDependency edges with type "devDep"', () => {
    const projects = [
      createProject('a', { devDependencies: { b: 'workspace:*' } }),
      createProject('b'),
    ];
    const result = repoGraphCollector.collect(projects as never);
    expect(result.edges).toEqual([{ from: 'a', to: 'b', type: 'devDep' }]);
  });

  it('should rank packages by inbound edge count in mostDepended', () => {
    const projects = [
      createProject('a', { dependencies: { z: 'workspace:*' } }),
      createProject('b', { dependencies: { z: 'workspace:*' } }),
      createProject('c', { dependencies: { z: 'workspace:*', y: 'workspace:*' } }),
      createProject('z'),
      createProject('y'),
    ];
    const result = repoGraphCollector.collect(projects as never);
    expect(result.mostDepended[0]).toEqual({ packageName: 'z', count: 3 });
    expect(result.mostDepended[1]).toEqual({ packageName: 'y', count: 1 });
  });

  it('should cap mostDepended at the top 20 packages', () => {
    const projects = Array.from({ length: 25 }, (_, i) => createProject('target' + i));
    projects.push(
      createProject(
        'consumer',
        { dependencies: Object.fromEntries(projects.map(p => [p.packageName, 'workspace:*'])) },
      ),
    );
    const result = repoGraphCollector.collect(projects as never);
    expect(result.mostDepended).toHaveLength(20);
  });

  it('should return empty results for a project list with no internal edges', () => {
    const projects = [
      createProject('a', { dependencies: { external: '^1.0.0' } }),
    ];
    const result = repoGraphCollector.collect(projects as never);
    expect(result.edges).toEqual([]);
    expect(result.mostDepended).toEqual([]);
  });

  it('should count both dep and devDep edges towards mostDepended', () => {
    const projects = [
      createProject('a', { dependencies: { shared: 'workspace:*' } }),
      createProject('b', { devDependencies: { shared: 'workspace:*' } }),
      createProject('shared'),
    ];
    const result = repoGraphCollector.collect(projects as never);
    expect(result.mostDepended[0]).toEqual({ packageName: 'shared', count: 2 });
  });
});
