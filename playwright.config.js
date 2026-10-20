// @ts-check
import { defineConfig, devices } from '@playwright/test';
import ports from './tests/e2e/support/ports.cjs';

const { API_URL, WEB_PORT, WEB_ORIGIN } = ports;

// The browser tests drive the real app: the backend on the gem_test database
// (fake email and uploads, nothing leaves the machine) and the Vite dev server
// pointed at it. Each test makes its own gym, so tests can run side by side.
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['list'], ['html', { open: 'never' }]],
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: WEB_ORIGIN,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
  ],
  webServer: [
    {
      command: 'node tests/e2e/support/backend.cjs',
      url: `${API_URL}/auth/check-code/e2e-ready`,
      timeout: 120_000,
      reuseExistingServer: false,
    },
    {
      command: `node node_modules/vite/bin/vite.js --port ${WEB_PORT} --strictPort`,
      cwd: 'gem-frontend',
      url: WEB_ORIGIN,
      env: { VITE_API_URL: API_URL },
      timeout: 120_000,
      reuseExistingServer: false,
    },
  ],
});
