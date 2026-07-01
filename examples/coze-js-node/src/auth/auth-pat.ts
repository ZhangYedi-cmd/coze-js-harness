/**
 * How to use personal access token to init Coze client.
 */

import { CozeAPI } from '@coze/api';

import { streamingChat } from '../utils';
import config from '../config/config.default.js';
import { botId } from '../client';

// 'en' for https://api.coze.com, 'cn' for https://api.coze.cn
const key = (process.env.COZE_ENV || 'en') as keyof typeof config;

// Retrieve the API key (Personal Access Token) from the configuration based on the current environment
const apiKey = config[key].auth.pat.COZE_API_KEY;

// The default base URL is https://api.coze.com
const baseURL = config[key].COZE_BASE_URL;

// Initialize a new Coze API client using the base URL and API key (Personal Access Token)
const client = new CozeAPI({
  baseURL,
  token: apiKey,
});

// Example of how to use the client
streamingChat({
  client,
  botId,
  query: 'give me a joke',
}).catch(console.error);
