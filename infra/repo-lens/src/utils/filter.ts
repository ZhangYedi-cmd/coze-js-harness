import type { RushConfigurationProject } from '@rushstack/rush-sdk';
import { minimatch } from 'minimatch';

import { createLogger } from './debug';

const log = createLogger('filter');

export interface FilterOptions {
  to?: string[];
  from?: string[];
  only?: string[];
  filter?: string[];
}

const buildDependencyMap = (projects: RushConfigurationProject[]) => {
  // packageName -> Set of packages it depends on (upstream)
  const upstreamMap = new Map<string, Set<string>>();
  // packageName -> Set of packages that depend on it (downstream)
  const downstreamMap = new Map<string, Set<string>>();
  const packageNames = new Set(projects.map(p => p.packageName));

  for (const project of projects) {
    upstreamMap.set(project.packageName, new Set());
    downstreamMap.set(project.packageName, new Set());
  }

  for (const project of projects) {
    const { packageJson, packageName } = project;
    const allDeps = {
      ...((packageJson as unknown as Record<string, Record<string, string>>).dependencies ?? {}),
      ...((packageJson as unknown as Record<string, Record<string, string>>).devDependencies ?? {}),
    };
    for (const depName of Object.keys(allDeps)) {
      if (!packageNames.has(depName)) {
        continue;
      }
      upstreamMap.get(packageName)?.add(depName);
      downstreamMap.get(depName)?.add(packageName);
    }
  }

  return { upstreamMap, downstreamMap };
};

const collectTransitive = (
  start: string,
  adjacency: Map<string, Set<string>>,
): Set<string> => {
  const result = new Set<string>();
  const queue = [start];
  while (queue.length > 0) {
    const current = queue.shift();
    if (current === undefined || result.has(current)) {
      continue;
    }
    result.add(current);
    for (const next of adjacency.get(current) ?? []) {
      queue.push(next);
    }
  }
  return result;
};

export const filterProjects = (
  projects: RushConfigurationProject[],
  options: FilterOptions,
): RushConfigurationProject[] => {
  const { to, from, only, filter } = options;
  const hasFilter = [to, from, only, filter].some(o => o && o.length > 0);
  if (!hasFilter) {
    log('no filter applied, returning all %d projects', projects.length);
    return projects;
  }
  log('filter options: %o', options);

  const { upstreamMap, downstreamMap } = buildDependencyMap(projects);
  const projectMap = new Map(projects.map(p => [p.packageName, p]));
  const selected = new Set<string>();

  // --only: exact match, no transitive deps
  for (const name of only ?? []) {
    if (projectMap.has(name)) {
      selected.add(name);
    }
  }

  // --to <pkg>: pkg + all its upstream deps (packages it depends on)
  for (const name of to ?? []) {
    for (const pkg of collectTransitive(name, upstreamMap)) {
      selected.add(pkg);
    }
  }

  // --from <pkg>: pkg + all downstream (packages that depend on it)
  for (const name of from ?? []) {
    for (const pkg of collectTransitive(name, downstreamMap)) {
      selected.add(pkg);
    }
  }

  // --filter: glob match on package names
  for (const pattern of filter ?? []) {
    for (const project of projects) {
      if (minimatch(project.packageName, pattern)) {
        selected.add(project.packageName);
      }
    }
  }

  const result = projects.filter(p => selected.has(p.packageName));
  log('filter result: %d/%d projects selected', result.length, projects.length);
  return result;
};
