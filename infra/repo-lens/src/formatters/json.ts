import type { RepoSnapshot } from '../types';

export const formatJson = (snapshot: RepoSnapshot): string =>
  JSON.stringify(snapshot, null, 2);
