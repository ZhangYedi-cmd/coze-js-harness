import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('child_process', () => ({
  execSync: vi.fn(),
}));

vi.mock('fs', () => ({
  default: {
    readFileSync: vi.fn(),
  },
  readFileSync: vi.fn(),
}));

vi.mock('../../../../src/utils/debug', () => ({
  createLogger: () => vi.fn(),
}));

import fs from 'fs';
import { execSync } from 'child_process';
import { locCollector } from '../../../../src/collectors/package/loc';

const mockedExecSync = vi.mocked(execSync);
const mockedReadFileSync = vi.mocked(fs.readFileSync);

const createProject = (folder = '/repo/pkg') => ({
  packageName: 'pkg',
  projectFolder: folder,
});

describe('locCollector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should expose package scope and name metadata', () => {
    expect(locCollector.scope).toBe('package');
    expect(locCollector.name).toBe('loc');
  });

  it('should classify files in __tests__ directories as test files', () => {
    mockedExecSync.mockReturnValue('src/a.ts\nsrc/__tests__/a.test.ts\n' as never);
    mockedReadFileSync.mockImplementation(((file: string) => {
      if (file.endsWith('a.ts')) {return 'line1\nline2\nline3';}
      return 'tline1\ntline2';
    }) as never);

    const result = locCollector.collect(createProject() as never);
    expect(result.sourceFileCount).toBe(1);
    expect(result.testFileCount).toBe(1);
    expect(result.sourceLines).toBe(3);
    expect(result.testLines).toBe(2);
    expect(result.totalLines).toBe(5);
    expect(result.fileCount).toBe(2);
  });

  it('should classify files ending with .test or .spec as test files', () => {
    mockedExecSync.mockReturnValue('src/util.ts\nsrc/util.test.ts\nsrc/util.spec.ts\n' as never);
    mockedReadFileSync.mockReturnValue('a\nb' as never);

    const result = locCollector.collect(createProject() as never);
    expect(result.sourceFileCount).toBe(1);
    expect(result.testFileCount).toBe(2);
  });

  it('should ignore non-source extensions from git ls-files output', () => {
    mockedExecSync.mockReturnValue('README.md\npackage.json\nsrc/a.ts\n' as never);
    mockedReadFileSync.mockReturnValue('line1\nline2' as never);

    const result = locCollector.collect(createProject() as never);
    expect(result.fileCount).toBe(1);
    expect(result.sourceFileCount).toBe(1);
  });

  it('should support .tsx, .js and .jsx as source extensions', () => {
    mockedExecSync.mockReturnValue('a.ts\nb.tsx\nc.js\nd.jsx\n' as never);
    mockedReadFileSync.mockReturnValue('x' as never);

    const result = locCollector.collect(createProject() as never);
    expect(result.sourceFileCount).toBe(4);
    expect(result.testFileCount).toBe(0);
  });

  it('should treat unreadable files as zero-line files', () => {
    mockedExecSync.mockReturnValue('src/a.ts\n' as never);
    mockedReadFileSync.mockImplementation((() => {
      throw new Error('permission denied');
    }) as never);

    const result = locCollector.collect(createProject() as never);
    expect(result.sourceLines).toBe(0);
    expect(result.sourceFileCount).toBe(1);
  });

  it('should return all zeros when git ls-files yields no source files', () => {
    mockedExecSync.mockReturnValue('\n' as never);

    const result = locCollector.collect(createProject() as never);
    expect(result).toEqual({
      sourceLines: 0,
      testLines: 0,
      totalLines: 0,
      sourceFileCount: 0,
      testFileCount: 0,
      fileCount: 0,
    });
  });

  it('should pass projectFolder as the cwd to git ls-files', () => {
    mockedExecSync.mockReturnValue('' as never);
    locCollector.collect(createProject('/somewhere/else') as never);
    expect(mockedExecSync).toHaveBeenCalledWith('git ls-files', expect.objectContaining({ cwd: '/somewhere/else' }));
  });
});
