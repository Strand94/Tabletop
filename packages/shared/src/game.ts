import { z } from 'zod';
import { CollectionStatus, GameType } from './enums.js';

/**
 * Game create/update payloads. BGG sync fields (bggRating/bggRank/bggSyncedAt)
 * are intentionally absent — they are written only by the sync job and are
 * read-only in the UI (spec §3.2, §9.2). `currency` is optional on input and
 * defaults to the instance currency server-side.
 */
const gameWritableShape = {
  title: z.string().min(1).max(300),
  imagePath: z.string().max(500).nullish(),
  releaseYear: z.number().int().min(0).max(3000).nullish(),
  minPlayers: z.number().int().min(1).max(100).nullish(),
  maxPlayers: z.number().int().min(1).max(100).nullish(),
  minPlaytime: z.number().int().min(0).max(100000).nullish(),
  maxPlaytime: z.number().int().min(0).max(100000).nullish(),
  minAge: z.number().int().min(0).max(120).nullish(),
  weight: z.number().min(1).max(5).nullish(),
  description: z.string().max(20000).nullish(),
  type: GameType.nullish(),
  price: z.number().min(0).max(1_000_000).nullish(),
  currency: z.string().min(1).max(10).optional(),
  collectionStatus: CollectionStatus.optional(),
  dateAdded: z.string().date().nullish(),
  bggId: z.number().int().positive().nullish(),
  categoryIds: z.array(z.number().int().positive()).optional(),
};

/** Cross-field integrity checks shared by create and update (spec §10.6). */
function withRangeChecks<T extends z.ZodTypeAny>(schema: T): z.ZodEffects<T> {
  return schema.superRefine((val: Record<string, unknown>, ctx) => {
    const min = val.minPlayers as number | null | undefined;
    const max = val.maxPlayers as number | null | undefined;
    if (min != null && max != null && min > max) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['minPlayers'],
        message: 'minPlayers must be <= maxPlayers',
      });
    }
    const minT = val.minPlaytime as number | null | undefined;
    const maxT = val.maxPlaytime as number | null | undefined;
    if (minT != null && maxT != null && minT > maxT) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['minPlaytime'],
        message: 'minPlaytime must be <= maxPlaytime',
      });
    }
  });
}

export const createGameSchema = withRangeChecks(z.object(gameWritableShape));
export type CreateGameInput = z.infer<typeof createGameSchema>;

export const updateGameSchema = withRangeChecks(z.object(gameWritableShape).partial());
export type UpdateGameInput = z.infer<typeof updateGameSchema>;

/** Query params for the games list. */
export const gameQuerySchema = z.object({
  status: CollectionStatus.optional(),
  category: z.coerce.number().int().positive().optional(),
  q: z.string().max(200).optional(),
  sort: z.enum(['title', 'releaseYear', 'dateAdded', 'createdAt']).default('title'),
  order: z.enum(['asc', 'desc']).default('asc'),
  /** "Shelf of shame": owned games that have never been played (spec §4.2). */
  neverPlayed: z
    .union([z.literal('true'), z.literal('false')])
    .optional()
    .transform((v) => v === 'true'),
});
export type GameQuery = z.infer<typeof gameQuerySchema>;

/** Category as returned in responses. */
export interface CategoryDto {
  id: number;
  name: string;
}

/** Game as returned by the API. Decimals are numbers; dates are ISO strings. */
export interface GameDto {
  id: number;
  title: string;
  imagePath: string | null;
  releaseYear: number | null;
  minPlayers: number | null;
  maxPlayers: number | null;
  minPlaytime: number | null;
  maxPlaytime: number | null;
  minAge: number | null;
  weight: number | null;
  description: string | null;
  type: GameType | null;
  price: number | null;
  currency: string;
  collectionStatus: CollectionStatus;
  dateAdded: string | null;
  bggId: number | null;
  bggRating: number | null;
  bggRank: number | null;
  bggSyncedAt: string | null;
  categories: CategoryDto[];
  /** The requesting user's overall rating of this game, if any (1.0–10.0). */
  myRating: number | null;
  /** Average of all users' per-session ratings for this game's sessions. */
  avgSessionRating: number | null;
  /** How many session ratings that average is based on. */
  sessionRatingCount: number;
  createdAt: string;
  updatedAt: string;
}
