import { readFile as fsReadFile } from 'node:fs/promises';
import path from 'node:path';
import type { BggCatalogRefreshResultDto } from '@tabletop/shared';
import { loadConfig } from '../../config.js';
import { parseCatalogCsv } from './csv.js';
import { snapshotDateFromName } from './snapshot.js';
import { replaceCatalog } from './catalog-service.js';
import { githubSource, refreshCatalog } from './catalog-source.js';

export interface CliDeps {
  readFile: (p: string) => Promise<string>;
  replace: typeof replaceCatalog;
  refresh: (opts: { force?: boolean }) => Promise<BggCatalogRefreshResultDto>;
}

/** `--file <path>` loads a local CSV; otherwise downloads the newest snapshot. */
export async function runCatalogRefresh(
  argv: string[],
  deps: CliDeps,
): Promise<BggCatalogRefreshResultDto> {
  const fileIdx = argv.indexOf('--file');
  const force = argv.includes('--force');
  if (fileIdx !== -1) {
    const filePath = argv[fileIdx + 1];
    const snapshotDate = snapshotDateFromName(path.basename(filePath ?? ''));
    if (!filePath || snapshotDate === null) {
      throw new Error('--file requires a path named YYYY-MM-DD(...).csv');
    }
    const rows = parseCatalogCsv(await deps.readFile(filePath));
    const count = await deps.replace(rows, snapshotDate);
    return { status: 'refreshed', snapshotDate, count };
  }
  return deps.refresh({ force });
}

/* c8 ignore start — process entrypoint */
async function main(): Promise<void> {
  const config = loadConfig();
  const result = await runCatalogRefresh(process.argv.slice(2), {
    readFile: (p) => fsReadFile(p, 'utf8'),
    replace: replaceCatalog,
    refresh: ({ force }) =>
      refreshCatalog({ source: githubSource(config.BGG_CATALOG_REPO), force }),
  });

  console.log(`bgg catalog: ${result.status} (${result.count} rows, ${result.snapshotDate})`);
  process.exit(0);
}

if (process.argv[1] && process.argv[1].endsWith('catalog-cli.ts')) {
  void main();
}
/* c8 ignore stop */
