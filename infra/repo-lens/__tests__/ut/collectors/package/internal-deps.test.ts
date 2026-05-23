import { describe, it, expect } from 'vitest';

import { internalDepsCollector } from '../../../../src/collectors/package/internal-deps';

interface FakeProject {
  packageJson: {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };
}

const createProject = (pkgJson: FakeProject['packageJson']): FakeProject => ({
  packageJson: pkgJson,
});

describe('internalDepsCollector', () => {
  it('should expose package scope and name metadata', () => {
    expect(internalDepsCollector.scope).toBe('package');
    expect(internalDepsCollector.name).toBe('internal-deps');
  });

  it('should keep only workspace-prefixed entries from dependencies and devDependencies', () => {
    const project = createProject({
      dependencies: {
        '@scope/internal': 'workspace:*',
        'external-lib': '^1.0.0',
      },
      devDependencies: {
        '@scope/dev-internal': 'workspace:^0.0.1',
        'external-dev': '^2.0.0',
      },
    });
    const result = internalDepsCollector.collect(project as never);
    expect(result.dependencies).toEqual(['@scope/internal']);
    expect(result.devDependencies).toEqual(['@scope/dev-internal']);
    expect(result.total).toBe(2);
  });

  it('should return zero-total when no workspace deps are present', () => {
    const project = createProject({
      dependencies: { 'external-lib': '^1.0.0' },
      devDependencies: { 'external-dev': '^2.0.0' },
    });
    const result = internalDepsCollector.collect(project as never);
    expect(result.dependencies).toEqual([]);
    expect(result.devDependencies).toEqual([]);
    expect(result.total).toBe(0);
  });

  it('should treat missing dependency fields as empty', () => {
    const project = createProject({});
    const result = internalDepsCollector.collect(project as never);
    expect(result).toEqual({ dependencies: [], devDependencies: [], total: 0 });
  });

  it('should not match versions that merely contain the workspace substring', () => {
    const project = createProject({
      dependencies: {
        'workspace-named-pkg': '1.0.0-workspace',
        'real-internal': 'workspace:*',
      },
    });
    const result = internalDepsCollector.collect(project as never);
    expect(result.dependencies).toEqual(['real-internal']);
  });
});
