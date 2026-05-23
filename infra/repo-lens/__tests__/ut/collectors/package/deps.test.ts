import { describe, it, expect } from 'vitest';

import { depsCollector } from '../../../../src/collectors/package/deps';

interface FakeProject {
  packageJson: {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
    peerDependencies?: Record<string, string>;
  };
}

const createProject = (pkgJson: FakeProject['packageJson']): FakeProject => ({
  packageJson: pkgJson,
});

describe('depsCollector', () => {
  it('should expose package scope and name metadata', () => {
    expect(depsCollector.scope).toBe('package');
    expect(depsCollector.name).toBe('deps');
  });

  it('should return all dependency lists and the total count', () => {
    const project = createProject({
      dependencies: { a: '1.0.0', b: '1.0.0' },
      devDependencies: { c: '1.0.0' },
      peerDependencies: { d: '1.0.0' },
    });
    const result = depsCollector.collect(project as never);
    expect(result).toEqual({
      dependencies: ['a', 'b'],
      devDependencies: ['c'],
      peerDependencies: ['d'],
      total: 4,
    });
  });

  it('should return empty arrays and total 0 when no dependency fields exist', () => {
    const project = createProject({});
    const result = depsCollector.collect(project as never);
    expect(result).toEqual({
      dependencies: [],
      devDependencies: [],
      peerDependencies: [],
      total: 0,
    });
  });

  it('should count dependency entries without deduplication across fields', () => {
    const project = createProject({
      dependencies: { shared: '1.0.0' },
      devDependencies: { shared: '1.0.0' },
    });
    const result = depsCollector.collect(project as never);
    expect(result.total).toBe(2);
  });

  it('should treat missing optional fields as empty arrays', () => {
    const project = createProject({ dependencies: { a: '1.0.0' } });
    const result = depsCollector.collect(project as never);
    expect(result.dependencies).toEqual(['a']);
    expect(result.devDependencies).toEqual([]);
    expect(result.peerDependencies).toEqual([]);
    expect(result.total).toBe(1);
  });
});
