import { defineConfig } from '@coze-infra/vitest-config';

export default defineConfig({
  dirname: __dirname,
  preset: 'node',
  test: {
    include: ['__tests__/ut/**/*.test.ts'],
  },
});
