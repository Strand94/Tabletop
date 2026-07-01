import { z } from 'zod';

/**
 * Expansion create/update payloads. An expansion carries the same metadata as a
 * game (spec §3.3) minus collection status, currency, type, and categories. It
 * always belongs to exactly one base game; BGG sync fields are read-only.
 */
const expansionWritableShape = {
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
  price: z.number().min(0).max(1_000_000).nullish(),
  dateAdded: z.string().date().nullish(),
  bggId: z.number().int().positive().nullish(),
};

function withRangeChecks<T extends z.ZodTypeAny>(schema: T): T {
  return schema.superRefine((value, ctx) => {
    const val = value as Record<string, unknown>;
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

export const createExpansionSchema = withRangeChecks(z.object(expansionWritableShape));
export type CreateExpansionInput = z.infer<typeof createExpansionSchema>;

export const updateExpansionSchema = withRangeChecks(z.object(expansionWritableShape).partial());
export type UpdateExpansionInput = z.infer<typeof updateExpansionSchema>;

/** Expansion as returned by the API. Decimals are numbers; dates are ISO strings. */
export interface ExpansionDto {
  id: number;
  gameId: number;
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
  price: number | null;
  dateAdded: string | null;
  bggId: number | null;
  bggRating: number | null;
  bggRank: number | null;
  bggSyncedAt: string | null;
  /** Number of logged sessions this expansion was used in. */
  sessionCount: number;
  createdAt: string;
  updatedAt: string;
}
