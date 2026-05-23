import createDebug from 'debug';

export const createLogger = (module: string) => createDebug(`repo-lens:${module}`);
