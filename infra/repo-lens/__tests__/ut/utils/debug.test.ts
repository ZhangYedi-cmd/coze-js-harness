import { describe, it, expect, vi } from 'vitest';

vi.mock('debug', () => {
  const factory = vi.fn((namespace: string) => {
    const fn = vi.fn() as unknown as Record<string, unknown> & ((...args: unknown[]) => void);
    fn.namespace = namespace;
    return fn;
  });
  return { default: factory };
});

import createDebug from 'debug';
import { createLogger } from '../../../src/utils/debug';

describe('createLogger', () => {
  it('should create a debug logger with the repo-lens module prefix', () => {
    const logger = createLogger('engine');
    expect(createDebug).toHaveBeenCalledWith('repo-lens:engine');
    expect((logger as unknown as { namespace: string }).namespace).toBe('repo-lens:engine');
  });

  it('should pass through arbitrary module names verbatim after the prefix', () => {
    createLogger('collector:loc');
    expect(createDebug).toHaveBeenCalledWith('repo-lens:collector:loc');
  });

  it('should return a callable logger function', () => {
    const logger = createLogger('filter');
    expect(typeof logger).toBe('function');
  });
});
