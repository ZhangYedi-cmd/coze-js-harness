import type { PackageCollector } from '../../types';

export interface InternalDepsStat {
  dependencies: string[];
  devDependencies: string[];
  total: number;
}

const pickWorkspace = (deps: Record<string, string> = {}): string[] =>
  Object.entries(deps)
    .filter(([, version]) => version.startsWith('workspace:'))
    .map(([name]) => name);

export const internalDepsCollector: PackageCollector<InternalDepsStat> = {
  scope: 'package',
  name: 'internal-deps',
  description: '从依赖中筛选 workspace:* 的内部包，描述包间依赖关系',
  collect(project) {
    const { packageJson } = project;

    const dependencies = pickWorkspace(packageJson.dependencies as Record<string, string>);
    const devDependencies = pickWorkspace(packageJson.devDependencies as Record<string, string>);

    return {
      dependencies,
      devDependencies,
      total: dependencies.length + devDependencies.length,
    };
  },
};
