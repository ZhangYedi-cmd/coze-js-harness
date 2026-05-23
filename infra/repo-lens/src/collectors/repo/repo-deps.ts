import type { RepoCollector } from '../../types';
import { createLogger } from '../../utils/debug';

const log = createLogger('collector:repo-deps');

export interface RepoDependency {
  name: string;
  versions: string[];
  usedBy: string[];
}

export interface RepoDependencyStat {
  total: number;
  duplicates: RepoDependency[];
  all: RepoDependency[];
}

const EXTERNAL_DEP_FIELDS = ['dependencies', 'devDependencies', 'peerDependencies'] as const;

export const repoDepsCollector: RepoCollector<RepoDependencyStat> = {
  scope: 'repo',
  name: 'repo-deps',
  description: '汇总全仓外部依赖总览及重复依赖（多版本冲突）检测',
  collect(projects) {
    log('scanning %d projects for external deps', projects.length);
    // name -> Map<version, Set<packageName>>
    const depMap = new Map<string, Map<string, Set<string>>>();

    for (const project of projects) {
      const { packageJson, packageName } = project;

      for (const field of EXTERNAL_DEP_FIELDS) {
        const deps = (packageJson as unknown as Record<string, Record<string, string>>)[field] ?? {};
        for (const [depName, version] of Object.entries(deps)) {
          if (version.startsWith('workspace:')) {
            continue;
          }
          if (!depMap.has(depName)) {
            depMap.set(depName, new Map());
          }
          const versionMap = depMap.get(depName) ?? new Map<string, Set<string>>();
          if (!versionMap.has(version)) {
            versionMap.set(version, new Set());
          }
          versionMap.get(version)?.add(packageName);
          depMap.set(depName, versionMap);
        }
      }
    }

    const all: RepoDependency[] = [];
    for (const [name, versionMap] of depMap.entries()) {
      const versions = [...versionMap.keys()];
      const usedBy = [...new Set([...versionMap.values()].flatMap(s => [...s]))];
      all.push({ name, versions, usedBy });
    }

    all.sort((a, b) => a.name.localeCompare(b.name));
    const duplicates = all.filter(d => d.versions.length > 1);
    log('found %d unique external deps, %d with multiple versions', all.length, duplicates.length);

    return { total: all.length, duplicates, all };
  },
};
