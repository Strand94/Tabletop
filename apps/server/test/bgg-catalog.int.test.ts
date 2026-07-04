import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/db.js';
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
