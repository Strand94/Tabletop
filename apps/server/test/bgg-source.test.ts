import { afterEach, describe, expect, it, vi } from 'vitest';
import { refreshCatalog, type SnapshotSource } from '../src/modules/bgg/catalog-source.js';
import * as service from '../src/modules/bgg/catalog-service.js';

const CSV =
  'ID,Name,Year,Rank,Average,Bayes average,Users rated,URL,Thumbnail\n1,Ark Nova,2021,2,8.54,8.35,100,/bg/1,t1';

function fakeSource(names: string[], csv = CSV): SnapshotSource {
  return { listNames: () => Promise.resolve(names), download: () => Promise.resolve(csv) };
}

// Spies are created per test with vi.spyOn; restore them so call counts and
// implementations do not leak between tests (no global restoreMocks config).
afterEach(() => {
  vi.restoreAllMocks();
});

describe('refreshCatalog', () => {
  it('downloads and replaces when the snapshot is newer', async () => {
    vi.spyOn(service, 'currentSnapshotDate').mockResolvedValue('2026-06-28');
    const replace = vi.spyOn(service, 'replaceCatalog').mockResolvedValue(1);
    const result = await refreshCatalog({ source: fakeSource(['2026-06-29.csv']) });
    expect(replace).toHaveBeenCalledOnce();
    expect(result).toEqual({ status: 'refreshed', snapshotDate: '2026-06-29', count: 1 });
  });

  it('skips download + replace when the snapshot is unchanged', async () => {
    vi.spyOn(service, 'currentSnapshotDate').mockResolvedValue('2026-06-29');
    const replace = vi.spyOn(service, 'replaceCatalog').mockResolvedValue(0);
    const source = fakeSource(['2026-06-29.csv']);
    const dl = vi.spyOn(source, 'download');
    const result = await refreshCatalog({ source });
    expect(dl).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
    expect(result).toEqual({ status: 'unchanged', snapshotDate: '2026-06-29', count: 0 });
  });

  it('force refreshes even when unchanged', async () => {
    vi.spyOn(service, 'currentSnapshotDate').mockResolvedValue('2026-06-29');
    const replace = vi.spyOn(service, 'replaceCatalog').mockResolvedValue(1);
    const result = await refreshCatalog({ source: fakeSource(['2026-06-29.csv']), force: true });
    expect(replace).toHaveBeenCalledOnce();
    expect(result.status).toBe('refreshed');
  });
});
