import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'e2e',
    include: ['__tests__/e2e/**/*.test.ts'],
    testTimeout: 60000, // E2E tests may take longer
  },
});
