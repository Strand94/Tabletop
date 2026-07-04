import type { BggCatalogHitDto } from '@tabletop/shared';
import type { Prisma } from '../../../generated/prisma/client.js';
import { prisma } from '../../db.js';
import { decToNum, dateOnly } from '../../lib/prisma-map.js';
import type { CatalogRow } from './csv.js';

const CHUNK = 5000;

function toHit(row: {
  bggId: number;
  name: string;
  year: number | null;
  rank: number | null;
  average: Prisma.Decimal | null;
  bayesAverage: Prisma.Decimal | null;
  usersRated: number | null;
  thumbnail: string | null;
  snapshotDate: Date | null;
}): BggCatalogHitDto {
  return {
    bggId: row.bggId,
    name: row.name,
    year: row.year,
    rank: row.rank,
    average: decToNum(row.average),
    bayesAverage: decToNum(row.bayesAverage),
    usersRated: row.usersRated,
    thumbnail: row.thumbnail,
    snapshotDate: dateOnly(row.snapshotDate),
  };
}

/** Delete-all + insert, transactionally, so removed games do not linger. */
export async function replaceCatalog(rows: CatalogRow[], snapshotDate: string): Promise<number> {
  if (rows.length === 0) {
    throw new Error('refusing to replace bgg_catalog with zero rows');
  }
  const stamp = new Date(`${snapshotDate}T00:00:00.000Z`);
  const data = rows.map((r) => ({ ...r, snapshotDate: stamp }));
  await prisma.$transaction([
    prisma.bggCatalogEntry.deleteMany({}),
    ...chunk(data, CHUNK).map((batch) =>
      prisma.bggCatalogEntry.createMany({ data: batch, skipDuplicates: true }),
    ),
  ]);
  return data.length;
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** The date of the loaded snapshot, or null when the catalog is empty. */
export async function currentSnapshotDate(): Promise<string | null> {
  const agg = await prisma.bggCatalogEntry.aggregate({ _max: { snapshotDate: true } });
  const d = agg._max.snapshotDate;
  return d ? d.toISOString().slice(0, 10) : null;
}

/** Numeric query → id match; otherwise case-insensitive name contains, rank first. */
export async function searchCatalog(q: string, limit: number): Promise<BggCatalogHitDto[]> {
  const idCandidate = /^\d+$/.test(q) ? Number(q) : null;
  const isValidId =
    idCandidate !== null && Number.isInteger(idCandidate) && idCandidate <= 2147483647;
  const where: Prisma.BggCatalogEntryWhereInput = isValidId
    ? { OR: [{ bggId: idCandidate }, { name: { contains: q, mode: 'insensitive' } }] }
    : { name: { contains: q, mode: 'insensitive' } };
  const rows = await prisma.bggCatalogEntry.findMany({
    where,
    orderBy: [{ rank: { sort: 'asc', nulls: 'last' } }, { name: 'asc' }],
    take: limit,
  });
  return rows.map(toHit);
}

export async function getCatalogEntries(bggIds: number[]): Promise<BggCatalogHitDto[]> {
  if (bggIds.length === 0) return [];
  const rows = await prisma.bggCatalogEntry.findMany({ where: { bggId: { in: bggIds } } });
  return rows.map(toHit);
}

/** Shape the sync provider needs: { bggId, rating, rank }. */
export async function getCatalogRatings(
  bggIds: number[],
): Promise<{ bggId: number; rating: number | null; rank: number | null }[]> {
  const entries = await getCatalogEntries(bggIds);
  return entries.map((e) => ({ bggId: e.bggId, rating: e.average, rank: e.rank }));
}
