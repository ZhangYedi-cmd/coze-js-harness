import fetch from 'node-fetch';
import axios, {
  type AxiosResponseHeaders,
  type AxiosRequestConfig,
  type AxiosResponse,
  type AxiosInstance,
  type AxiosStatic,
} from 'axios';

import { isBrowser, isBrowserExtension, isUniApp } from './utils';
import {
  APIError,
  TimeoutError,
  type ErrorRes,
  CozeError,
  APIUserAbortError,
} from './error';
import { COZE_CN_BASE_URL, COZE_COM_BASE_URL } from './constant';

export interface FetchAPIOptions extends AxiosRequestConfig {
  // Custom axios instance
  axiosInstance?: AxiosInstance | unknown;
  // Whether to use streaming mode
  isStreaming?: boolean;
}

interface FetchError {
  isAxiosError?: boolean;
  code?: string;
  message?: string;
  response?: {
    status?: number;
    data?: ErrorRes;
    headers?: AxiosResponseHeaders;
  };
}

const handleError = (error: unknown) => {
  const e = error as FetchError;
  if (e.isAxiosError || (e.code && e.message)) {
    if (
      (e.code === 'ECONNABORTED' && e.message?.includes('timeout')) ||
      e.code === 'ETIMEDOUT'
    ) {
      return new TimeoutError(
        408,
        undefined,
        `Request timed out: ${e.message}`,
        e.response?.headers as AxiosResponseHeaders,
      );
    } else if (e.code === 'ERR_CANCELED') {
      return new APIUserAbortError(e.message);
    } else {
      return APIError.generate(
        e.response?.status || 500,
        e.response?.data as ErrorRes,
        e.message,
        e.response?.headers as AxiosResponseHeaders,
      );
    }
  } else {
    return APIError.generate(
      500,
      undefined,
      `Unexpected error: ${e.message}`,
      undefined,
    );
  }
};

// node-fetch is used for streaming requests
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const adapterFetch = async (options: any): Promise<any> => {
  const response = await fetch(options.url, {
    body: options.data,
    ...options,
  });
  return {
    data: response.body,
    ...response,
  };
};

const isSupportNativeFetch = () => {
  if (isBrowser() || isBrowserExtension() || isUniApp()) {
    return true;
  }
  // native fetch is supported in node 18.0.0 or higher
  const version = process.version.slice(1);
  return compareVersions(version, '18.0.0') >= 0;
};

export async function fetchAPI<ResultType>(
  url: string,
  options: FetchAPIOptions = {},
) {
  const axiosInstance = options.axiosInstance || axios;

  // Add version check for streaming requests
  if (options.isStreaming && isAxiosStatic(axiosInstance)) {
    const axiosVersion = axiosInstance.VERSION || axios.VERSION;
    if (!axiosVersion || compareVersions(axiosVersion, '1.7.1') < 0) {
      throw new CozeError(
        'Streaming requests require axios version 1.7.1 or higher. Please upgrade your axios version.',
      );
    }
  }

  // Check for 4101 authentication error
  // If BaseURL is set to overseas address, provide a warning to try setting it to the domestic address
  const checkError = () => {
    if (url.startsWith(COZE_COM_BASE_URL)) {
      console.warn(`
鉴权失败，如果您是国内用户，请将 baseURL 设置为 ${COZE_CN_BASE_URL} 示例：
new CozeAPI({
  // ...
  baseURL: COZE_CN_BASE_URL
})`);
    }
  };

  const response: AxiosResponse = await (axiosInstance as AxiosInstance)({
    url,
    responseType: options.isStreaming ? 'stream' : 'json',
    adapter: options.isStreaming
      ? isSupportNativeFetch()
        ? 'fetch'
        : adapterFetch
      : undefined,
    ...options,
  }).catch((error: AxiosResponse) => {
    if (error?.status === 401) {
      checkError();
    }
    throw handleError(error);
  });

  return {
    async *stream(): AsyncGenerator<ResultType> {
      try {
        const stream = response.data;
        const reader = stream[Symbol.asyncIterator]
          ? stream[Symbol.asyncIterator]()
          : stream.getReader();
        const decoder = new TextDecoder();
        const fieldValues: Record<string, string> = {};
        let buffer = '';
        while (true) {
          const { done, value } = await (reader.next
            ? reader.next()
            : reader.read());
          if (done) {
            if (buffer) {
              // If the stream ends without a newline, it means an error occurred
              fieldValues.event = 'error';
              fieldValues.data = buffer;
              try {
                const error = JSON.parse(buffer);
                if (error?.code === 4101) {
                  checkError();
                }
              } catch {
                // buffer may not be valid JSON - swallow parse errors intentionally
              }
              yield fieldValues as ResultType;
            }
            break;
          }
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          for (let i = 0; i < lines.length - 1; i++) {
            const line = lines[i];

            const index = line.indexOf(':');
            if (index !== -1) {
              const field = line.substring(0, index).trim();
              const content = line.substring(index + 1).trim();
              fieldValues[field] = content;
              if (field === 'data') {
                yield fieldValues as ResultType;
              }
            }
          }
          buffer = lines[lines.length - 1]; // Keep the last incomplete line in the buffer
        }
      } catch (error) {
        handleError(error);
      }
    },
    json: () => response.data as ResultType,
    response,
  };
}

// Add version comparison utility
function compareVersions(v1: string, v2: string): number {
  const v1Parts = v1.split('.').map(Number);
  const v2Parts = v2.split('.').map(Number);

  for (let i = 0; i < 3; i++) {
    const part1 = v1Parts[i] || 0;
    const part2 = v2Parts[i] || 0;
    if (part1 > part2) {
      return 1;
    }
    if (part1 < part2) {
      return -1;
    }
  }
  return 0;
}

function isAxiosStatic(instance: unknown): instance is AxiosStatic {
  return !!(instance as AxiosStatic)?.Axios;
}
