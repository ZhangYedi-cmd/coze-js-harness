import type { RushConfigurationProject } from '@rushstack/rush-sdk';

import type {
  PackageCollector,
  PackageStat,
  RepoCollector,
  RepoSnapshot,
  StatCollector,
} from './types';
import { createLogger } from './utils/debug';

const log = createLogger('engine');

// start_aigc
const getLevel = (tags: ReadonlySet<string>): string => {
  for (const tag of tags) {
    if (/^level-\d+$/.test(tag)) {
      return tag;
    }
  }
  return '-';
};

const runPackage = async (
  packageCollectors: PackageCollector[],
  project: RushConfigurationProject,
): Promise<PackageStat> => {
  const collectedAt = new Date().toISOString();
  const stats: Record<string, unknown> = {};
  log('runPackage: %s', project.packageName);

  await Promise.all(
    packageCollectors.map(async collector => {
      try {
        const start = Date.now();
        stats[collector.name] = await collector.collect(project);
        log('runPackage: %s [%s] done in %dms', project.packageName, collector.name, Date.now() - start);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        log('runPackage: %s [%s] error: %s', project.packageName, collector.name, message);
        stats[collector.name] = { error: message };
      }
    }),
  );

  return {
    packageName: project.packageName,
    packagePath: project.projectRelativeFolder,
    level: getLevel(project.tags),
    collectedAt,
    stats,
  };
};

const runRepo = async (
  repoCollectors: RepoCollector[],
  projects: RushConfigurationProject[],
): Promise<Record<string, unknown>> => {
  const repoStats: Record<string, unknown> = {};

  await Promise.all(
    repoCollectors.map(async collector => {
      try {
        const start = Date.now();
        log('runRepo: [%s] start', collector.name);
        repoStats[collector.name] = await collector.collect(projects);
        log('runRepo: [%s] done in %dms', collector.name, Date.now() - start);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        log('runRepo: [%s] error: %s', collector.name, message);
        repoStats[collector.name] = { error: message };
      }
    }),
  );

  return repoStats;
};

export const createLensEngine = (collectors: StatCollector[]) => {
  const packageCollectors = collectors.filter(
    (c): c is PackageCollector => c.scope === 'package',
  );
  const repoCollectors = collectors.filter(
    (c): c is RepoCollector => c.scope === 'repo',
  );
  log(
    'initialized: package collectors=[%s] repo collectors=[%s]',
    packageCollectors.map(c => c.name).join(', '),
    repoCollectors.map(c => c.name).join(', '),
  );

  return {
    run: async (projects: RushConfigurationProject[]): Promise<RepoSnapshot> => {
      const generatedAt = new Date().toISOString();
      log('run: %d packages', projects.length);

      const [packages, repoStats] = await Promise.all([
        Promise.all(projects.map(p => runPackage(packageCollectors, p))),
        runRepo(repoCollectors, projects),
      ]);

      log('run: complete');
      return {
        generatedAt,
        totalPackages: projects.length,
        repoStats,
        packages,
      };
    },
  };
};
// end_aigc
