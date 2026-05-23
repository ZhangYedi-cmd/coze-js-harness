import type { Command } from 'commander';
import { logger } from '@coze-infra/rush-logger';

import { presetCollectors } from '../collectors';


export const registerListCommand = (program: Command) => {
  program
    .command('list')
    .description('列出所有已注册的收集器')
    .action(() => {
      const packageCollectors = presetCollectors.filter(c => c.scope === 'package');
      const repoCollectors = presetCollectors.filter(c => c.scope === 'repo');

      logger.info('Package 级收集器:');
      for (const c of packageCollectors) {
        logger.info(`  ${c.name.padEnd(20)} ${c.description}`);
      }
      logger.info('Repo 级收集器:');
      for (const c of repoCollectors) {
        logger.info(`  ${c.name.padEnd(20)} ${c.description}`);
      }
    });
};
