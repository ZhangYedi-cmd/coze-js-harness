import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../src/utils/debug', () => ({
  createLogger: () => vi.fn(),
}));

import { filterProjects } from '../../../src/utils/filter';

interface FakeProject {
  packageName: string;
  packageJson: {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };
}

const createProject = (
  name: string,
  deps: Record<string, string> = {},
  devDeps: Record<string, string> = {},
): FakeProject => ({
  packageName: name,
  packageJson: { dependencies: deps, devDependencies: devDeps },
});

describe('filterProjects', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return all projects when no filter is provided', () => {
    const projects = [createProject('a'), createProject('b'), createProject('c')];
    const result = filterProjects(projects as never, {});
    expect(result.map(p => p.packageName)).toEqual(['a', 'b', 'c']);
  });

  it('should return all projects when filter arrays are empty', () => {
    const projects = [createProject('a'), createProject('b')];
    const result = filterProjects(projects as never, { only: [], to: [], from: [], filter: [] });
    expect(result.map(p => p.packageName)).toEqual(['a', 'b']);
  });

  it('should select only the exact match for --only', () => {
    const projects = [
      createProject('a', { b: 'workspace:*' }),
      createProject('b'),
      createProject('c'),
    ];
    const result = filterProjects(projects as never, { only: ['a'] });
    expect(result.map(p => p.packageName)).toEqual(['a']);
  });

  it('should ignore --only entries that do not match any project', () => {
    const projects = [createProject('a'), createProject('b')];
    const result = filterProjects(projects as never, { only: ['missing'] });
    expect(result).toEqual([]);
  });

  it('should expand --to into the package plus its workspace-internal upstream deps', () => {
    const projects = [
      createProject('a', { b: '^1.0.0', c: '^1.0.0' }),
      createProject('b', { c: '^1.0.0' }),
      createProject('c'),
      createProject('d'),
    ];
    const result = filterProjects(projects as never, { to: ['a'] });
    expect(result.map(p => p.packageName).sort()).toEqual(['a', 'b', 'c']);
  });

  it('should expand --from into the package plus its downstream deps', () => {
    const projects = [
      createProject('a', { b: '^1.0.0' }),
      createProject('b', { c: '^1.0.0' }),
      createProject('c'),
      createProject('d'),
    ];
    const result = filterProjects(projects as never, { from: ['c'] });
    expect(result.map(p => p.packageName).sort()).toEqual(['a', 'b', 'c']);
  });

  it('should consider devDependencies when building the dependency map', () => {
    const projects = [
      createProject('a', {}, { b: '^1.0.0' }),
      createProject('b'),
    ];
    const result = filterProjects(projects as never, { to: ['a'] });
    expect(result.map(p => p.packageName).sort()).toEqual(['a', 'b']);
  });

  it('should skip external dependencies that are not registered as workspace projects', () => {
    const projects = [createProject('a', { 'external-pkg': '^1.0.0' })];
    const result = filterProjects(projects as never, { to: ['a'] });
    expect(result.map(p => p.packageName)).toEqual(['a']);
  });

  it('should support glob patterns via --filter', () => {
    const projects = [
      createProject('@scope/foo'),
      createProject('@scope/bar'),
      createProject('@other/baz'),
    ];
    const result = filterProjects(projects as never, { filter: ['@scope/*'] });
    expect(result.map(p => p.packageName).sort()).toEqual(['@scope/bar', '@scope/foo']);
  });

  it('should merge selections from multiple filter types as a union', () => {
    const projects = [
      createProject('a', { b: '^1.0.0' }),
      createProject('b'),
      createProject('c'),
      createProject('d'),
    ];
    const result = filterProjects(projects as never, {
      only: ['d'],
      to: ['a'],
    });
    expect(result.map(p => p.packageName).sort()).toEqual(['a', 'b', 'd']);
  });

  it('should not include unrelated packages when filters select a subset', () => {
    const projects = [
      createProject('a', { b: '^1.0.0' }),
      createProject('b'),
      createProject('unrelated'),
    ];
    const result = filterProjects(projects as never, { only: ['a'] });
    expect(result.map(p => p.packageName)).toEqual(['a']);
  });

  it('should preserve original input order in the result', () => {
    const projects = [
      createProject('z', { y: '^1.0.0' }),
      createProject('y'),
      createProject('a'),
    ];
    const result = filterProjects(projects as never, { to: ['z'] });
    expect(result.map(p => p.packageName)).toEqual(['z', 'y']);
  });
});
