import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('child_process', () => ({
  execSync: vi.fn(),
}));

vi.mock('../../../../src/utils/debug', () => ({
  createLogger: () => vi.fn(),
}));

import { execSync } from 'child_process';
import { createChurnCollector } from '../../../../src/collectors/package/churn';

const mockedExecSync = vi.mocked(execSync);

const createProject = () => ({
  packageName: 'pkg',
  projectRelativeFolder: 'packages/pkg',
  rushConfiguration: { rushJsonFolder: '/repo' },
});

describe('createChurnCollector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should describe itself using the requested since window', () => {
    const collector = createChurnCollector('30d');
    expect(collector.description).toContain('30d');
    expect(collector.scope).toBe('package');
    expect(collector.name).toBe('churn');
  });

  it('should translate numeric+unit since values into git-readable durations', () => {
    mockedExecSync.mockReturnValue('' as never);
    const collector = createChurnCollector('7d');
    collector.collect(createProject() as never);
    const cmd = mockedExecSync.mock.calls[0][0] as string;
    expect(cmd).toContain('--since="7 days ago"');
  });

  it('should pass non-pattern since values through to git unchanged', () => {
    mockedExecSync.mockReturnValue('' as never);
    const collector = createChurnCollector('2026-01-01');
    collector.collect(createProject() as never);
    const cmd = mockedExecSync.mock.calls[0][0] as string;
    expect(cmd).toContain('--since="2026-01-01"');
  });

  it('should aggregate commits, contributors and line counts from git log output', () => {
    const log = [
      'COMMIT alice@example.com',
      '10\t2\tsrc/a.ts',
      '3\t1\tsrc/b.ts',
      'COMMIT bob@example.com',
      '5\t0\tsrc/c.ts',
      'COMMIT alice@example.com',
      '1\t1\tsrc/a.ts',
    ].join('\n');
    mockedExecSync.mockReturnValue(log as never);

    const collector = createChurnCollector('30d');
    const result = collector.collect(createProject() as never);
    expect(result.commits).toBe(3);
    expect(result.contributors).toBe(2);
    expect(result.linesAdded).toBe(19);
    expect(result.linesDeleted).toBe(4);
    expect(result.since).toBe('30d');
  });

  it('should ignore binary numstat lines marked with "-\\t-"', () => {
    const log = [
      'COMMIT a@x.com',
      '-\t-\timage.png',
      '4\t2\tsrc/a.ts',
    ].join('\n');
    mockedExecSync.mockReturnValue(log as never);

    const collector = createChurnCollector('30d');
    const result = collector.collect(createProject() as never);
    expect(result.linesAdded).toBe(4);
    expect(result.linesDeleted).toBe(2);
  });

  it('should return a zero stat object when git log throws', () => {
    mockedExecSync.mockImplementation((() => {
      throw new Error('not a git repo');
    }) as never);

    const collector = createChurnCollector('30d');
    const result = collector.collect(createProject() as never);
    expect(result).toEqual({
      since: '30d',
      commits: 0,
      linesAdded: 0,
      linesDeleted: 0,
      contributors: 0,
    });
  });

  it('should return zeros when git log output is empty', () => {
    mockedExecSync.mockReturnValue('' as never);

    const collector = createChurnCollector('30d');
    const result = collector.collect(createProject() as never);
    expect(result.commits).toBe(0);
    expect(result.contributors).toBe(0);
  });

  it('should support months (m) and years (y) unit suffixes', () => {
    mockedExecSync.mockReturnValue('' as never);

    createChurnCollector('2m').collect(createProject() as never);
    expect((mockedExecSync.mock.calls[0][0] as string)).toContain('--since="2 months ago"');

    createChurnCollector('1y').collect(createProject() as never);
    expect((mockedExecSync.mock.calls[1][0] as string)).toContain('--since="1 years ago"');
  });
});
