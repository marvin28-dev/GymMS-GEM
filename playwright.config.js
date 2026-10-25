// @ts-check
import { defineConfig, devices } from '@playwright/test';
import ports from './tests/e2e/support/ports.cjs';

const { API_URL, WEB_PORT, WEB_ORIGIN } = ports;

// The app is built and served the way it ships: a page is then a few bundled
// files instead of the dev server's hundreds of modules, which Firefox loads
// slowly when every test opens pages at once (10 to 30 seconds a page). The
// dev server is still there for working on a test: E2E_DEV=1.
const vite = 'node node_modules/vite/bin/vite.js';
const BUILT = 'node_modules/.e2e-build';
const webCommand = process.env.E2E_DEV
  ? `${vite} --port ${WEB_PORT} --strictPort`
  : `${vite} build --outDir ${BUILT} --emptyOutDir --logLevel warn && ${vite} preview --outDir ${BUILT} --port ${WEB_PORT} --strictPort`;

// The browser tests drive the real app: the backend on the gem_test database
// (fake email and uploads, nothing leaves the machine) and the app built to
// talk to it. Each test makes its own gym, so tests can run side by side.
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // Each worker runs a browser. On an 8 GB machine four at once ran it out of
  // memory and Firefox stalled (scripts killed as too slow); E2E_WORKERS overrides.
  workers: process.env.CI ? 1 : Number(process.env.E2E_WORKERS) || 3,
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
    // E2E_BROWSERS=all adds Safari's engine on a desktop, and the phone tests
    // (the ones that say phone) on an iPhone and an Android phone, touch and all
    ...(process.env.E2E_BROWSERS === 'all' ? [
      { name: 'webkit', use: { ...devices['Desktop Safari'] } },
      { name: 'ios-safari', use: { ...devices['iPhone 15'] }, grep: /phone/i },
      { name: 'android-chrome', use: { ...devices['Pixel 7'] }, grep: /phone/i },
    ] : []),
  ],
  webServer: [
    {
      command: 'node tests/e2e/support/backend.cjs',
      url: `${API_URL}/auth/check-code/e2e-ready`,
      timeout: 120_000,
      reuseExistingServer: false,
    },
    {
      command: webCommand,
      cwd: 'gem-frontend',
      url: WEB_ORIGIN,
      // The fake photo store's address, so the page's content policy lets its photos in
      env: { VITE_API_URL: API_URL, VITE_PHOTO_HOST: 'https://res.cloudinary.test' },
      timeout: 240_000,
      reuseExistingServer: false,
    },
  ],
});
