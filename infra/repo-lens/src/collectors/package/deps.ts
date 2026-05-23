import type { PackageCollector } from '../../types';

export interface DepsStat {
  dependencies: string[];
  devDependencies: string[];
  peerDependencies: string[];
  total: number;
}

export const depsCollector: PackageCollector<DepsStat> = {
  scope: 'package',
  name: 'deps',
  description: '读取 package.json 中全量依赖列表',
  collect(project) {
    const { packageJson } = project;

    const dependencies = Object.keys(packageJson.dependencies ?? {});
    const devDependencies = Object.keys(packageJson.devDependencies ?? {});
    const peerDependencies = Object.keys(packageJson.peerDependencies ?? {});

    return {
      dependencies,
      devDependencies,
      peerDependencies,
      total: dependencies.length + devDependencies.length + peerDependencies.length,
    };
  },
};
