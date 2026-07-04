import type { BggCatalogRefreshResultDto } from '@tabletop/shared';
import { parseCatalogCsv } from './csv.js';
import { pickLatest } from './snapshot.js';
import { currentSnapshotDate, replaceCatalog } from './catalog-service.js';

export interface SnapshotSource {
  /** All file names available in the mirror. */
  listNames(): Promise<string[]>;
  /** Raw CSV text for one file name. */
  download(name: string): Promise<string>;
}

type FetchLike = typeof fetch;

/** GitHub-backed mirror source. Uses the git trees API to list in one call. */
export function githubSource(repo: string, fetchImpl: FetchLike = fetch): SnapshotSource {
  const ua = { 'User-Agent': 'tabletop-app' };
  return {
    async listNames() {
      const res = await fetchImpl(
        `https://api.github.com/repos/${repo}/git/trees/master?recursive=0`,
        { headers: ua },
      );
      if (!res.ok) throw new Error(`GitHub tree list failed: ${res.status}`);
      const body = (await res.json()) as { tree?: { path: string; type: string }[] };
      return (body.tree ?? []).filter((e) => e.type === 'blob').map((e) => e.path);
    },
    async download(name) {
      const res = await fetchImpl(
        `https://raw.githubusercontent.com/${repo}/master/${encodeURIComponent(name)}`,
        { headers: ua },
      );
      if (!res.ok) throw new Error(`Download ${name} failed: ${res.status}`);
      return res.text();
    },
  };
}

/**
 * Resolve the newest snapshot; if it matches the loaded one (and not forced),
 * no-op without downloading. Otherwise download + transactionally replace.
 */
export async function refreshCatalog(opts: {
  source: SnapshotSource;
  force?: boolean;
}): Promise<BggCatalogRefreshResultDto> {
  const names = await opts.source.listNames();
  const latest = pickLatest(names);
  if (latest === null) throw new Error('No dated CSV snapshots found in mirror');

  const current = await currentSnapshotDate();
  if (!opts.force && current === latest.snapshotDate) {
    return { status: 'unchanged', snapshotDate: current, count: 0 };
  }

  const csv = await opts.source.download(latest.name);
  const count = await replaceCatalog(parseCatalogCsv(csv), latest.snapshotDate);
  return { status: 'refreshed', snapshotDate: latest.snapshotDate, count };
}
