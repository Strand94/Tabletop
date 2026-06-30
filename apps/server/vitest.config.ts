import { defineConfig } from 'vitest/config';

/**
 * Server unit/integration test config. Unit tests (*.test.ts) run by default.
 * Integration tests (*.int.test.ts) require a reachable Postgres via DATABASE_URL
 * and are included only when RUN_DB_TESTS=1 (set in CI's integration job).
 */
const runDbTests = process.env.RUN_DB_TESTS === '1';

export default defineConfig({
  test: {
    name: 'server',
    environment: 'node',
    env: { LOG_LEVEL: 'silent' },
    include: runDbTests ? ['test/**/*.{test,int.test}.ts'] : ['test/**/*.test.ts'],
    exclude: runDbTests ? [] : ['test/**/*.int.test.ts'],
  },
});
