import type { RepoCollector } from '../../types';
import { createLogger } from '../../utils/debug';

const log = createLogger('collector:repo-graph');

export interface RepoGraphEdge {
  from: string;
  to: string;
  type: 'dep' | 'devDep';
}

export interface RepoGraphStat {
  edges: RepoGraphEdge[];
  mostDepended: Array<{ packageName: string; count: number }>;
}

export const repoGraphCollector: RepoCollector<RepoGraphStat> = {
  scope: 'repo',
  name: 'repo-graph',
  description: '构建内部包依赖有向图，并统计被依赖次数排行（影响面最广的包）',
  collect(projects) {
    log('building dependency graph for %d projects', projects.length);
    const packageNames = new Set(projects.map(p => p.packageName));
    const edges: RepoGraphEdge[] = [];
    const dependedCount = new Map<string, number>();

    for (const project of projects) {
      const { packageJson, packageName } = project;

      const deps = (packageJson as unknown as Record<string, Record<string, string>>).dependencies ?? {};
      const devDeps = (packageJson as unknown as Record<string, Record<string, string>>).devDependencies ?? {};

      for (const [depName, version] of Object.entries(deps)) {
        if (!version.startsWith('workspace:') || !packageNames.has(depName)) {
          continue;
        }
        edges.push({ from: packageName, to: depName, type: 'dep' });
        dependedCount.set(depName, (dependedCount.get(depName) ?? 0) + 1);
      }

      for (const [depName, version] of Object.entries(devDeps)) {
        if (!version.startsWith('workspace:') || !packageNames.has(depName)) {
          continue;
        }
        edges.push({ from: packageName, to: depName, type: 'devDep' });
        dependedCount.set(depName, (dependedCount.get(depName) ?? 0) + 1);
      }
    }

    const mostDepended = [...dependedCount.entries()]
      .map(([packageName, count]) => ({ packageName, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);

    log('graph: %d edges, top depended: %s', edges.length, mostDepended[0]?.packageName ?? 'none');
    return { edges, mostDepended };
  },
};
