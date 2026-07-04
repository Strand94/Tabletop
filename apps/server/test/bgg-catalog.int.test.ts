import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/db.js';
import {
  currentSnapshotDate,
  getCatalogRatings,
  replaceCatalog,
  searchCatalog,
} from '../src/modules/bgg/catalog-service.js';
import type { CatalogRow } from '../src/modules/bgg/csv.js';
import { applyMigrations, resetDb } from './helpers/db.js';

describe.skipIf(process.env.RUN_DB_TESTS !== '1')('bgg_catalog table', () => {
  beforeEach(async () => {
    applyMigrations();
    await resetDb();
  });
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('stores and reads a catalog entry', async () => {
    await prisma.bggCatalogEntry.create({
      data: {
        bggId: 224517,
        name: 'Brass: Birmingham',
        year: 2018,
        rank: 1,
        average: 8.56,
        bayesAverage: 8.393,
        usersRated: 59007,
        thumbnail: 'https://cf.geekdo-images.com/x.jpg',
        snapshotDate: new Date('2026-06-29'),
      },
    });
    const row = await prisma.bggCatalogEntry.findUnique({ where: { bggId: 224517 } });
    expect(row?.name).toBe('Brass: Birmingham');
    expect(row?.average?.toNumber()).toBeCloseTo(8.56);
  });
});

describe.skipIf(process.env.RUN_DB_TESTS !== '1')('catalog-service', () => {
  beforeEach(async () => {
    applyMigrations();
    await resetDb();
  });

  const rows: CatalogRow[] = [
    {
      bggId: 1,
      name: 'Ark Nova',
      year: 2021,
      rank: 2,
      average: 8.54,
      bayesAverage: 8.35,
      usersRated: 100,
      thumbnail: 't1',
    },
    {
      bggId: 2,
      name: 'Arkham Horror',
      year: 2016,
      rank: 50,
      average: 7.1,
      bayesAverage: 6.9,
      usersRated: 20,
      thumbnail: 't2',
    },
    {
      bggId: 3,
      name: 'Brass',
      year: 2018,
      rank: 1,
      average: 8.6,
      bayesAverage: 8.4,
      usersRated: 200,
      thumbnail: 't3',
    },
  ];

  it('replaces the catalog and reports the snapshot date', async () => {
    expect(await currentSnapshotDate()).toBeNull();
    const n = await replaceCatalog(rows, '2026-06-29');
    expect(n).toBe(3);
    expect(await currentSnapshotDate()).toBe('2026-06-29');

    // A second replace with fewer rows fully swaps the contents.
    await replaceCatalog([rows[0]!], '2026-06-30');
    expect(await currentSnapshotDate()).toBe('2026-06-30');
    const all = await searchCatalog('a', 25);
    expect(all.map((h) => h.bggId)).toEqual([1]);
  });

  it('searches by name (rank order) and by numeric id', async () => {
    await replaceCatalog(rows, '2026-06-29');
    const byName = await searchCatalog('ark', 10);
    expect(byName.map((h) => h.bggId)).toEqual([1, 2]); // rank 2 before rank 50
    const byId = await searchCatalog('3', 10);
    expect(byId[0]).toMatchObject({ bggId: 3, name: 'Brass', average: 8.6 });
  });

  it('returns ratings for the sync provider', async () => {
    await replaceCatalog(rows, '2026-06-29');
    expect(await getCatalogRatings([3, 999])).toEqual([{ bggId: 3, rating: 8.6, rank: 1 }]);
  });
});
