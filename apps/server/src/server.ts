import { execFileSync } from 'node:child_process';
import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { logger } from './logger.js';
import { tokenServiceFromConfig } from './modules/auth/routes.js';

/**
 * Process entrypoint. Validates config (fail-fast), applies pending database
 * migrations, then binds the HTTP server. Imported only by `node dist/server.js`
 * — never by tests, which import `createApp` directly.
 */
function runMigrations(databaseUrl: string): void {
  logger.info('Applying database migrations…');
  execFileSync('npx', ['prisma', 'migrate', 'deploy'], {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: databaseUrl },
    shell: process.platform === 'win32',
  });
}

function main(): void {
  const config = loadConfig();

  if (process.env.SKIP_MIGRATIONS !== '1') {
    runMigrations(config.DATABASE_URL);
  }

  const app = createApp({
    tokens: tokenServiceFromConfig(config),
    defaultLocale: config.DEFAULT_LOCALE,
    defaultCurrency: config.DEFAULT_CURRENCY,
    bgg: {
      enabled: config.BGG_SYNC_ENABLED,
      provider: config.BGG_SYNC_PROVIDER,
      apiToken: config.BGG_API_TOKEN,
    },
    catalogRepo: config.BGG_CATALOG_REPO,
  });
  app.listen(config.PORT, () => {
    logger.info(`Tabletop server listening on port ${config.PORT}`);
  });
}

main();
