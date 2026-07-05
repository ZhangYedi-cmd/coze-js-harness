/* eslint-disable security/detect-object-injection */

declare const uni: unknown;
declare const chrome: { runtime?: { id?: string } };

export function safeJsonParse(jsonString: string, defaultValue: unknown = '') {
  try {
    return JSON.parse(jsonString);
  } catch (error) {
    return defaultValue;
  }
}

export function sleep(ms: number) {
  return new Promise(resolve => {
    setTimeout(resolve, ms);
  });
}

export function isUniApp() {
  return typeof uni !== 'undefined';
}

export function isBrowser() {
  return typeof window !== 'undefined';
}

export function isPlainObject(obj: unknown): boolean {
  if (typeof obj !== 'object' || obj === null) {
    return false;
  }

  const proto = Object.getPrototypeOf(obj);
  if (proto === null) {
    return true;
  }

  let baseProto = proto;
  while (Object.getPrototypeOf(baseProto) !== null) {
    baseProto = Object.getPrototypeOf(baseProto);
  }

  return proto === baseProto;
}

export function mergeConfig<T extends object>(
  ...objects: Array<T | Partial<T> | undefined>
): T {
  return (objects as Array<Record<string, unknown> | undefined>).reduce(
    (result: Record<string, unknown>, obj) => {
      if (obj === undefined) {
        return result || {};
      }
      for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
          const value = obj[key];
          if (isPlainObject(value) && !Array.isArray(value)) {
            result[key] = mergeConfig<Record<string, unknown>>(
              (result[key] as Record<string, unknown>) || {},
              value as Record<string, unknown>,
            );
          } else {
            result[key] = value;
          }
        }
      }
      return result;
    },
    {},
  ) as T;
}

export function isPersonalAccessToken(token?: string) {
  return !!token?.startsWith('pat_');
}

export function buildWebsocketUrl<T extends object>(path: string, params?: T) {
  const queryString = Object.entries(
    (params || {}) as Record<string, string | number | boolean | undefined | null>,
  )
    .filter(
      ([_, value]) => value !== undefined && value !== null && value !== '',
    )
    .map(([key, value]) => `${key}=${value}`)
    .join('&');
  return `${path}${queryString ? `?${queryString}` : ''}`;
}

export const isBrowserExtension = (): boolean =>
  typeof chrome !== 'undefined' && !!chrome.runtime && !!chrome.runtime.id;
