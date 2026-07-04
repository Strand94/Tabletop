import { execFileSync } from 'node:child_process';
import { createApp } from './app.js';
import { loadConfig, type Config } from './config.js';
import { logger } from './logger.js';
import { tokenServiceFromConfig } from './modules/auth/routes.js';
import { githubSource, refreshCatalog } from './modules/bgg/catalog-source.js';
import { currentSnapshotDate } from './modules/bgg/catalog-service.js';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

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

/** Run one catalog refresh; log the outcome and never throw (boot/interval-safe). */
async function runCatalogRefresh(config: Config): Promise<void> {
  try {
    const result = await refreshCatalog({ source: githubSource(config.BGG_CATALOG_REPO) });
    logger.info(
      { status: result.status, count: result.count, snapshotDate: result.snapshotDate },
      'BGG catalog refresh completed',
    );
  } catch (err) {
    logger.error({ err }, 'BGG catalog refresh failed');
  }
}

/**
 * One-shot: populate the catalog on a fresh/empty database so search & import
 * work out of the box. Independent of the recurring BGG_CATALOG_REFRESH_ENABLED
 * scheduler. Best-effort — logs and never throws.
 */
async function initCatalogIfEmpty(config: Config): Promise<void> {
  try {
    if ((await currentSnapshotDate()) !== null) return; // already populated
    logger.info('BGG catalog empty — running initial refresh');
    await runCatalogRefresh(config);
  } catch (err) {
    logger.error({ err }, 'BGG catalog init check failed');
  }
}

/** Kick off the scheduled BGG catalog refresh when enabled (no-op otherwise). */
function scheduleCatalogRefresh(config: Config): void {
  if (!config.BGG_CATALOG_REFRESH_ENABLED) return;

  void runCatalogRefresh(config);
  const interval = setInterval(() => void runCatalogRefresh(config), ONE_DAY_MS);
  interval.unref();
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
    void initCatalogIfEmpty(config);
    scheduleCatalogRefresh(config);
  });
}

main();
