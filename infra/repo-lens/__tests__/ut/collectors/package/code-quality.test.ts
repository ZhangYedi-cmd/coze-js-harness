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
import { codeQualityCollector } from '../../../../src/collectors/package/code-quality';

const mockedExecSync = vi.mocked(execSync);
const mockedReadFileSync = vi.mocked(fs.readFileSync);

const createProject = () => ({
  packageName: 'pkg',
  projectFolder: '/repo/pkg',
});

describe('codeQualityCollector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should expose package scope and name metadata', () => {
    expect(codeQualityCollector.scope).toBe('package');
    expect(codeQualityCollector.name).toBe('code-quality');
  });

  it('should count ts-ignore, eslint-disable and any occurrences across source files', () => {
    mockedExecSync.mockReturnValue('src/a.ts\nsrc/b.ts\n' as never);
    mockedReadFileSync.mockImplementation(((file: string) => {
      if (file.endsWith('a.ts')) {
        return '// @ts-ignore foo\nconst x: any = 1;';
      }
      return '/* eslint-disable */\nconst y: any = 2;\n// @ts-ignore bar';
    }) as never);

    const result = codeQualityCollector.collect(createProject() as never);
    expect(result.tsIgnoreCount).toBe(2);
    expect(result.eslintDisableCount).toBe(1);
    expect(result.anyCount).toBe(2);
  });

  it('should compute anyRatio as any count divided by total source lines', () => {
    mockedExecSync.mockReturnValue('src/a.ts\n' as never);
    mockedReadFileSync.mockReturnValue('any\nline2\nline3\nline4' as never);

    const result = codeQualityCollector.collect(createProject() as never);
    expect(result.anyCount).toBe(1);
    expect(result.anyRatio).toBe(0.25);
  });

  it('should return zero anyRatio when there are no source lines', () => {
    mockedExecSync.mockReturnValue('\n' as never);

    const result = codeQualityCollector.collect(createProject() as never);
    expect(result.anyRatio).toBe(0);
    expect(result.anyCount).toBe(0);
  });

  it('should exclude test files when collecting source-level metrics', () => {
    mockedExecSync.mockReturnValue('src/util.ts\nsrc/util.test.ts\nsrc/__tests__/x.ts\n' as never);
    mockedReadFileSync.mockReturnValue('const x: any = 1;\n// @ts-ignore here' as never);

    const result = codeQualityCollector.collect(createProject() as never);
    expect(result.anyCount).toBe(1);
    expect(result.tsIgnoreCount).toBe(1);
  });

  it('should ignore non-ts/tsx files from git ls-files output', () => {
    mockedExecSync.mockReturnValue('src/a.ts\nsrc/b.css\nsrc/c.js\n' as never);
    mockedReadFileSync.mockReturnValue('any' as never);

    const result = codeQualityCollector.collect(createProject() as never);
    expect(result.anyCount).toBe(1);
  });

  it('should skip files that cannot be read', () => {
    mockedExecSync.mockReturnValue('src/a.ts\nsrc/b.ts\n' as never);
    let call = 0;
    mockedReadFileSync.mockImplementation((() => {
      call += 1;
      if (call === 1) {throw new Error('boom');}
      return 'const x: any = 1;';
    }) as never);

    const result = codeQualityCollector.collect(createProject() as never);
    expect(result.anyCount).toBe(1);
  });

  it('should round anyRatio to four decimal places', () => {
    mockedExecSync.mockReturnValue('src/a.ts\n' as never);
    mockedReadFileSync.mockReturnValue('any\n' + Array.from({ length: 6 }, () => 'noop').join('\n') as never);

    const result = codeQualityCollector.collect(createProject() as never);
    // 1 any over 7 source lines => 0.1428...
    expect(result.anyRatio).toBe(0.1429);
  });

  it('should match eslint-disable-line and eslint-disable-next-line variants', () => {
    mockedExecSync.mockReturnValue('src/a.ts\n' as never);
    mockedReadFileSync.mockReturnValue(
      '// eslint-disable-next-line foo\n// eslint-disable-line bar\n/* eslint-disable */',
    );

    const result = codeQualityCollector.collect(createProject() as never);
    expect(result.eslintDisableCount).toBe(3);
  });
});
