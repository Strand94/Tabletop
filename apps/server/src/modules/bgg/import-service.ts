import type { BggImportInput, BggImportResultDto } from '@tabletop/shared';
import { Prisma } from '../../../generated/prisma/client.js';
import { prisma } from '../../db.js';
import { getCatalogEntries } from './catalog-service.js';

/**
 * Create a Game per catalog id, skipping ids already owned or not in the catalog.
 * Deliberately does NOT set a cover from the catalog thumbnail — those CSV images
 * are low quality; imported games start coverless until a better image is added.
 */
export async function importGames(
  input: BggImportInput,
  defaultCurrency: string,
): Promise<BggImportResultDto> {
  const entries = await getCatalogEntries(input.bggIds);
  const existing = await prisma.game.findMany({
    where: { bggId: { in: input.bggIds } },
    select: { bggId: true },
  });
  const owned = new Set(existing.map((g) => g.bggId));

  let created = 0;
  for (const e of entries) {
    if (owned.has(e.bggId)) continue;
    try {
      await prisma.game.create({
        data: {
          title: e.name,
          releaseYear: e.year ?? undefined,
          bggId: e.bggId,
          bggRating: e.average ?? undefined,
          bggRank: e.rank ?? undefined,
          currency: defaultCurrency,
          collectionStatus: input.collectionStatus ?? undefined,
        },
      });
      created += 1;
    } catch (err) {
      // A concurrent import can race us between the pre-check and this create;
      // the unique constraint on bggId is the source of truth. Treat the
      // resulting P2002 as "already imported" rather than a hard failure.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        continue;
      }
      throw err;
    }
  }
  return { created, skipped: input.bggIds.length - created };
}
