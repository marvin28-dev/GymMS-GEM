import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          include: ['tests/unit/**/*.test.mjs'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'api',
          include: ['tests/api/**/*.test.mjs'],
          environment: 'node',
          globalSetup: ['tests/api/setup/global.mjs'],
          setupFiles: ['tests/api/setup/env.mjs'],
          testTimeout: 30000,
          hookTimeout: 60000,
        },
      },
    ],
  },
});
