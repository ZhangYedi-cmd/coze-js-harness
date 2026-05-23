import type { RepoSnapshot } from '../types';
import type { CodeQualityStat } from '../collectors/package/code-quality';
import type { LocStat } from '../collectors/package/loc';
import type { DepsStat } from '../collectors/package/deps';
import type { InternalDepsStat } from '../collectors/package/internal-deps';
import type { RepoDependencyStat } from '../collectors/repo/repo-deps';
import type { RepoGraphStat } from '../collectors/repo/repo-graph';

const pad = (s: string | number, width: number): string =>
  String(s).padEnd(width);


export const formatTable = (snapshot: RepoSnapshot): string => {
  const lines: string[] = [];

  // Repo-level stats
  const repoDeps = snapshot.repoStats['repo-deps'] as RepoDependencyStat | undefined;
  const repoGraph = snapshot.repoStats['repo-graph'] as RepoGraphStat | undefined;

  lines.push('=== Repo Stats ===');
  if (repoDeps) {
    lines.push(
      `External deps: ${repoDeps.total} unique  |  Duplicates: ${repoDeps.duplicates.length}`,
    );
    if (repoDeps.duplicates.length > 0) {
      lines.push('Duplicate deps (multiple versions):');
      for (const d of repoDeps.duplicates.slice(0, 10)) {
        lines.push(`  ${d.name}: ${d.versions.join(', ')}`);
      }
    }
  }
  if (repoGraph && repoGraph.mostDepended.length > 0) {
    const top = repoGraph.mostDepended
      .slice(0, 5)
      .map(d => `${d.packageName} (${d.count})`)
      .join(', ');
    lines.push(`Most depended: ${top}`);
  }

  lines.push('');
  lines.push('=== Package Stats ===');

  const COL_PKG = 40;
  const COL_LEVEL = 10;
  const COL_LOC = 8;
  const COL_DEPS = 6;
  const COL_IDEPS = 14;
  const COL_TSIGNORE = 10;
  const COL_ESLINT = 10;
  const COL_ANY = 6;
  const COL_ANY_RATIO = 12;

  lines.push(
    pad('Package', COL_PKG) +
      pad('Level', COL_LEVEL) +
      pad('LOC', COL_LOC) +
      pad('Deps', COL_DEPS) +
      pad('InternalDeps', COL_IDEPS) +
      pad('ts-ignore', COL_TSIGNORE) +
      pad('eslint-dis', COL_ESLINT) +
      pad('any', COL_ANY) +
      pad('any/line', COL_ANY_RATIO),
  );
  lines.push('-'.repeat(COL_PKG + COL_LEVEL + COL_LOC + COL_DEPS + COL_IDEPS + COL_TSIGNORE + COL_ESLINT + COL_ANY + COL_ANY_RATIO));

  for (const pkg of snapshot.packages) {
    const loc = pkg.stats.loc as LocStat | undefined;
    const deps = pkg.stats.deps as DepsStat | undefined;
    const internalDeps = pkg.stats['internal-deps'] as InternalDepsStat | undefined;
    const cq = pkg.stats['code-quality'] as CodeQualityStat | undefined;

    lines.push(
      pad(pkg.packageName, COL_PKG) +
        pad(pkg.level, COL_LEVEL) +
        pad(loc ? loc.totalLines : '-', COL_LOC) +
        pad(deps ? deps.total : '-', COL_DEPS) +
        pad(internalDeps ? internalDeps.total : '-', COL_IDEPS) +
        pad(cq ? cq.tsIgnoreCount : '-', COL_TSIGNORE) +
        pad(cq ? cq.eslintDisableCount : '-', COL_ESLINT) +
        pad(cq ? cq.anyCount : '-', COL_ANY) +
        pad(cq ? cq.anyRatio.toFixed(4) : '-', COL_ANY_RATIO),
    );
  }

  return lines.join('\n');
};
