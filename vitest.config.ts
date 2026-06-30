import { defineConfig } from 'vitest/config';

/**
 * Root Vitest config. Uses `projects` (Vitest v4) so each workspace runs with
 * its own environment. Server/client projects register their own configs as
 * they are added; the shared package runs in a node environment here.
 */
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'shared',
          root: './packages/shared',
          environment: 'node',
          include: ['test/**/*.test.ts'],
        },
      },
      './apps/server/vitest.config.ts',
      // apps/client registers its project when added.
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      reportsDirectory: './coverage',
    },
  },
});
