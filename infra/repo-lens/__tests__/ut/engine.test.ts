import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/utils/debug', () => ({
  createLogger: () => vi.fn(),
}));

import { createLensEngine } from '../../src/engine';
import type { PackageCollector, RepoCollector } from '../../src/types';

const createPackageCollector = (
  name: string,
  collect: PackageCollector['collect'] = vi.fn().mockResolvedValue({ ok: true }),
): PackageCollector => ({
  scope: 'package',
  name,
  description: 'pkg collector',
  collect,
});

const createRepoCollector = (
  name: string,
  collect: RepoCollector['collect'] = vi.fn().mockResolvedValue({ ok: true }),
): RepoCollector => ({
  scope: 'repo',
  name,
  description: 'repo collector',
  collect,
});

const createProject = (packageName: string, tags: string[] = []) => ({
  packageName,
  projectRelativeFolder: `packages/${packageName}`,
  tags: new Set(tags),
});

describe('createLensEngine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should expose a callable run function', () => {
    const engine = createLensEngine([]);
    expect(typeof engine.run).toBe('function');
  });

  it('should invoke each package collector for every project', async () => {
    const collectA = vi.fn().mockResolvedValue({ value: 1 });
    const collectB = vi.fn().mockResolvedValue({ value: 2 });
    const engine = createLensEngine([
      createPackageCollector('a', collectA),
      createPackageCollector('b', collectB),
    ]);

    const projects = [createProject('p1'), createProject('p2')];
    const snapshot = await engine.run(projects as never);

    expect(collectA).toHaveBeenCalledTimes(2);
    expect(collectB).toHaveBeenCalledTimes(2);
    expect(snapshot.totalPackages).toBe(2);
    expect(snapshot.packages[0].stats.a).toEqual({ value: 1 });
    expect(snapshot.packages[0].stats.b).toEqual({ value: 2 });
  });

  it('should invoke each repo collector exactly once with all projects', async () => {
    const repoCollect = vi.fn().mockResolvedValue({ tally: 5 });
    const engine = createLensEngine([createRepoCollector('repo-x', repoCollect)]);

    const projects = [createProject('p1'), createProject('p2')];
    const snapshot = await engine.run(projects as never);

    expect(repoCollect).toHaveBeenCalledTimes(1);
    expect(repoCollect).toHaveBeenCalledWith(projects);
    expect(snapshot.repoStats['repo-x']).toEqual({ tally: 5 });
  });

  it('should capture per-collector errors without aborting the run', async () => {
    const failing = vi.fn().mockRejectedValue(new Error('boom'));
    const ok = vi.fn().mockResolvedValue({ ok: true });
    const engine = createLensEngine([
      createPackageCollector('fail', failing),
      createPackageCollector('ok', ok),
    ]);

    const snapshot = await engine.run([createProject('p')] as never);
    expect(snapshot.packages[0].stats.fail).toEqual({ error: 'boom' });
    expect(snapshot.packages[0].stats.ok).toEqual({ ok: true });
  });

  it('should capture repo-level collector errors as CollectorError', async () => {
    const failingRepo = vi.fn().mockRejectedValue(new Error('repo boom'));
    const engine = createLensEngine([createRepoCollector('r', failingRepo)]);

    const snapshot = await engine.run([] as never);
    expect(snapshot.repoStats.r).toEqual({ error: 'repo boom' });
  });

  it('should report the level from project tags matching the level-N pattern', async () => {
    const engine = createLensEngine([createPackageCollector('a')]);
    const snapshot = await engine.run([createProject('p', ['scope:foo', 'level-2', 'other'])] as never);
    expect(snapshot.packages[0].level).toBe('level-2');
  });

  it('should fall back to a dash when no level tag is present', async () => {
    const engine = createLensEngine([createPackageCollector('a')]);
    const snapshot = await engine.run([createProject('p', ['scope:foo'])] as never);
    expect(snapshot.packages[0].level).toBe('-');
  });

  it('should preserve packageName, packagePath and collectedAt for each package', async () => {
    const engine = createLensEngine([createPackageCollector('a')]);
    const snapshot = await engine.run([createProject('p')] as never);
    expect(snapshot.packages[0].packageName).toBe('p');
    expect(snapshot.packages[0].packagePath).toBe('packages/p');
    expect(typeof snapshot.packages[0].collectedAt).toBe('string');
    expect(() => new Date(snapshot.packages[0].collectedAt)).not.toThrow();
  });

  it('should stringify non-Error rejections from package collectors', async () => {
    const failing = vi.fn().mockRejectedValue('plain-string-failure');
    const engine = createLensEngine([createPackageCollector('x', failing)]);
    const snapshot = await engine.run([createProject('p')] as never);
    expect(snapshot.packages[0].stats.x).toEqual({ error: 'plain-string-failure' });
  });

  it('should produce empty stats objects when no collectors are configured', async () => {
    const engine = createLensEngine([]);
    const snapshot = await engine.run([createProject('p')] as never);
    expect(snapshot.packages[0].stats).toEqual({});
    expect(snapshot.repoStats).toEqual({});
    expect(snapshot.totalPackages).toBe(1);
  });
});
