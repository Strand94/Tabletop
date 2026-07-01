import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E config. Specs live in `e2e/`. The web server is started by CI
 * (and locally) against the built app; `E2E_BASE_URL` overrides the target.
 */
const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:5444';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  // Specs share one Postgres + app instance; run them on a single worker.
  workers: 1,
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
  // Boot the built app (Express serving the client bundle + API). Skipped when
  // E2E_NO_SERVER is set (e.g. pointing at an already-running instance).
  webServer: process.env.E2E_NO_SERVER
    ? undefined
    : {
        command: 'node apps/server/dist/server.js',
        url: `${baseURL}/api/health`,
        timeout: 120_000,
        reuseExistingServer: !process.env.CI,
      },
});
