import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const frontendRoot = path.dirname(fileURLToPath(import.meta.url));
const adminStorageState = path.join(frontendRoot, '.e2e', 'auth', 'admin.json');
const externalServer = process.env['PLAYWRIGHT_BASE_URL'];

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 2 : 0,
  workers: 1,
  reporter: process.env['CI'] ? [['github'], ['html', { open: 'never' }]] : 'list',
  timeout: 30_000,
  expect: { timeout: 5_000 },

  use: {
    baseURL: process.env['PLAYWRIGHT_BASE_URL'] ?? 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'on-first-retry',
  },

  projects: [
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'chromium',
      dependencies: ['setup'],
      testIgnore: [/auth\.setup\.ts/, /\.mobile\.spec\.ts/],
      use: {
        ...devices['Desktop Chrome'],
        storageState: adminStorageState,
      },
    },
    {
      name: 'mobile-safari',
      dependencies: ['setup'],
      testMatch: /\.mobile\.spec\.ts/,
      use: {
        ...devices['iPhone 13'],
        storageState: adminStorageState,
      },
    },
  ],

  ...(externalServer
    ? {}
    : {
        webServer: {
          command: 'pnpm test:e2e:server',
          url: 'http://127.0.0.1:3000/readyz',
          reuseExistingServer: false,
          timeout: 120_000,
        },
      }),
});
