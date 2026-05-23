import type { RushConfigurationProject } from '@rushstack/rush-sdk';

export interface PackageCollector<T = unknown> {
  scope: 'package';
  name: string;
  description: string;
  collect: (project: RushConfigurationProject) => T | Promise<T>;
}

export interface RepoCollector<T = unknown> {
  scope: 'repo';
  name: string;
  description: string;
  collect: (projects: RushConfigurationProject[]) => T | Promise<T>;
}

export type StatCollector<T = unknown> =
  | PackageCollector<T>
  | RepoCollector<T>;

export interface CollectorError {
  error: string;
}

export interface PackageStat {
  packageName: string;
  packagePath: string;
  level: string;
  collectedAt: string;
  stats: Record<string, unknown | CollectorError>;
}

export interface RepoSnapshot {
  generatedAt: string;
  totalPackages: number;
  repoStats: Record<string, unknown | CollectorError>;
  packages: PackageStat[];
}

export type OutputFormat = 'json' | 'table';

export interface ScanOptions {
  collectors?: string[];
  format: OutputFormat;
  output?: string;
  to?: string[];
  from?: string[];
  only?: string[];
  filter?: string[];
}
