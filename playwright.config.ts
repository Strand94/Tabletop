import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E config. Specs live in `e2e/`. The web server is started by CI
 * (and locally) against the built app; `E2E_BASE_URL` overrides the target.
 */
const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:5444';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['html'], ['github']] : 'list',
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
