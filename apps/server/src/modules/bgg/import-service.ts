import type { BggImportInput, BggImportResultDto } from '@tabletop/shared';
import { prisma } from '../../db.js';
import { getCatalogEntries } from './catalog-service.js';

/** Create a Game per catalog id, skipping ids already owned or not in the catalog. */
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
    await prisma.game.create({
      data: {
        title: e.name,
        releaseYear: e.year ?? undefined,
        imagePath: e.thumbnail ?? undefined,
        bggId: e.bggId,
        bggRating: e.average ?? undefined,
        bggRank: e.rank ?? undefined,
        currency: defaultCurrency,
        collectionStatus: input.collectionStatus ?? undefined,
      },
    });
    created += 1;
  }
  return { created, skipped: input.bggIds.length - created };
}
