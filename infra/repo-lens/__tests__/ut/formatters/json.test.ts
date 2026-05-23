import { describe, it, expect } from 'vitest';

import { formatJson } from '../../../src/formatters/json';
import type { RepoSnapshot } from '../../../src/types';

const buildSnapshot = (): RepoSnapshot => ({
  generatedAt: '2026-05-14T10:00:00.000Z',
  totalPackages: 1,
  repoStats: { 'repo-x': { value: 1 } },
  packages: [
    {
      packageName: 'p',
      packagePath: 'packages/p',
      level: 'level-2',
      collectedAt: '2026-05-14T10:00:01.000Z',
      stats: { a: { ok: true } },
    },
  ],
});

describe('formatJson', () => {
  it('should produce a pretty-printed JSON string with two-space indentation', () => {
    const out = formatJson(buildSnapshot());
    expect(out).toContain('\n  ');
    expect(out.startsWith('{')).toBe(true);
  });

  it('should round-trip back into the original snapshot via JSON.parse', () => {
    const snapshot = buildSnapshot();
    const parsed = JSON.parse(formatJson(snapshot));
    expect(parsed).toEqual(snapshot);
  });

  it('should preserve repoStats and packages structures verbatim', () => {
    const snapshot = buildSnapshot();
    const parsed = JSON.parse(formatJson(snapshot));
    expect(parsed.repoStats['repo-x']).toEqual({ value: 1 });
    expect(parsed.packages[0].stats.a).toEqual({ ok: true });
  });
});
