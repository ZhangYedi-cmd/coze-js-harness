import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@coze-infra/fs-enhance', () => ({
  isFileExists: vi.fn(),
  readJsonFile: vi.fn(),
}));

import { isFileExists, readJsonFile } from '@coze-infra/fs-enhance';
import { testCoverageCollector } from '../../../../src/collectors/package/test-coverage';

const mockedIsFileExists = vi.mocked(isFileExists);
const mockedReadJsonFile = vi.mocked(readJsonFile);

const createProject = () => ({
  packageName: 'pkg',
  projectFolder: '/repo/pkg',
});

describe('testCoverageCollector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should expose package scope and name metadata', () => {
    expect(testCoverageCollector.scope).toBe('package');
    expect(testCoverageCollector.name).toBe('test-coverage');
  });

  it('should return a not-exists shape when coverage-summary.json is missing', async () => {
    mockedIsFileExists.mockResolvedValue(false);

    const result = await testCoverageCollector.collect(createProject() as never);
    expect(result).toEqual({
      exists: false,
      lines: null,
      functions: null,
      branches: null,
      statements: null,
    });
    expect(mockedReadJsonFile).not.toHaveBeenCalled();
  });

  it('should return the coverage percentages when the summary file exists', async () => {
    mockedIsFileExists.mockResolvedValue(true);
    mockedReadJsonFile.mockResolvedValue({
      total: {
        lines: { pct: 82.5 },
        functions: { pct: 91.0 },
        branches: { pct: 64.3 },
        statements: { pct: 80.0 },
      },
    } as never);

    const result = await testCoverageCollector.collect(createProject() as never);
    expect(result).toEqual({
      exists: true,
      lines: 82.5,
      functions: 91.0,
      branches: 64.3,
      statements: 80.0,
    });
  });

  it('should fall back to a not-exists shape when reading the summary throws', async () => {
    mockedIsFileExists.mockResolvedValue(true);
    mockedReadJsonFile.mockRejectedValue(new Error('malformed json'));

    const result = await testCoverageCollector.collect(createProject() as never);
    expect(result.exists).toBe(false);
    expect(result.lines).toBeNull();
    expect(result.functions).toBeNull();
    expect(result.branches).toBeNull();
    expect(result.statements).toBeNull();
  });

  it('should resolve the coverage file under the project folder', async () => {
    mockedIsFileExists.mockResolvedValue(false);
    await testCoverageCollector.collect({ projectFolder: '/repo/foo' } as never);
    const arg = mockedIsFileExists.mock.calls[0][0] as string;
    expect(arg).toContain('/repo/foo');
    expect(arg).toContain('coverage/coverage-summary.json');
  });
});
