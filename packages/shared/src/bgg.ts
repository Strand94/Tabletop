import { z } from 'zod';
import { CollectionStatus } from './enums.js';

/** Default GitHub repo mirroring the BGG rankings CSV (single source of truth). */
export const DEFAULT_BGG_CATALOG_REPO = 'beefsack/bgg-ranking-historicals';

/** Canonical BGG game page. Resolves without the slug, so id is enough. */
export function bggUrl(bggId: number): string {
  return `https://boardgamegeek.com/boardgame/${bggId}`;
}

/** One catalog row as returned by search — every stored field is exposed. */
export interface BggCatalogHitDto {
  bggId: number;
  name: string;
  year: number | null;
  rank: number | null;
  average: number | null;
  bayesAverage: number | null;
  usersRated: number | null;
  thumbnail: string | null;
  snapshotDate: string | null;
}

export const bggCatalogSearchQuerySchema = z.object({
  q: z.string().trim().min(1).max(200),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .default(10)
    .transform((v) => Math.min(v, 25)),
});
export type BggCatalogSearchQuery = z.infer<typeof bggCatalogSearchQuerySchema>;

export const bggImportSchema = z.object({
  bggIds: z.array(z.number().int().positive()).min(1).max(500),
  collectionStatus: CollectionStatus.optional(),
});
export type BggImportInput = z.infer<typeof bggImportSchema>;

export interface BggImportResultDto {
  created: number;
  skipped: number;
}

export interface BggCatalogRefreshResultDto {
  status: 'refreshed' | 'unchanged';
  snapshotDate: string | null;
  count: number;
}
