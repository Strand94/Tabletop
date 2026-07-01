import { prisma } from '../../db.js';

/** Full JSON backup of the collection (spec §4.2 Export/Import). */
export async function exportJson(): Promise<unknown> {
  const [games, expansions, people, sessions, categories, locations] = await Promise.all([
    prisma.game.findMany({ include: { categories: { include: { category: true } } } }),
    prisma.expansion.findMany(),
    prisma.person.findMany(),
    prisma.session.findMany({ include: { players: true, expansions: true, images: true } }),
    prisma.category.findMany(),
    prisma.location.findMany(),
  ]);
  return {
    exportedAt: new Date().toISOString(),
    version: 1,
    games,
    expansions,
    people,
    sessions,
    categories,
    locations,
  };
}

const CSV_COLUMNS = [
  'id',
  'title',
  'collectionStatus',
  'releaseYear',
  'minPlayers',
  'maxPlayers',
  'minPlaytime',
  'maxPlaytime',
  'weight',
  'price',
  'currency',
] as const;

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

/** Flat CSV of the games list. */
export async function exportGamesCsv(): Promise<string> {
  const games = await prisma.game.findMany({ orderBy: { title: 'asc' } });
  const header = CSV_COLUMNS.join(',');
  const rows = games.map((g) =>
    CSV_COLUMNS.map((col) => {
      const value = g[col];
      // Decimals serialize via their string form.
      return csvCell(value && typeof value === 'object' ? value.toString() : value);
    }).join(','),
  );
  return [header, ...rows].join('\n');
}
