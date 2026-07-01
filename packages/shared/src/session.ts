import { z } from 'zod';

/** A player's participation & result in a session (spec §3.8). */
export const playerResultSchema = z.object({
  personId: z.number().int().positive(),
  score: z.number().nullish(),
  won: z.boolean().default(false),
  firstPlay: z.boolean().default(false),
  color: z.string().max(50).nullish(),
});
export type PlayerResultInput = z.infer<typeof playerResultSchema>;

/**
 * Create-session payload (spec §5). `expansionIds` must all belong to `gameId`
 * and there must be at least one player — both enforced in the service layer
 * (§10). Duration is derived from start/end; multiple winners are allowed.
 */
export const createSessionSchema = z.object({
  gameId: z.number().int().positive(),
  start: z.string().datetime({ offset: true }),
  end: z.string().datetime({ offset: true }).nullish(),
  locationId: z.number().int().positive().nullish(),
  comment: z.string().max(5000).nullish(),
  expansionIds: z.array(z.number().int().positive()).default([]),
  players: z.array(playerResultSchema).min(1, 'A session needs at least one player'),
});
export type CreateSessionInput = z.infer<typeof createSessionSchema>;

/** Update-session payload. Players/expansions replace the existing sets when present. */
export const updateSessionSchema = z.object({
  start: z.string().datetime({ offset: true }).optional(),
  end: z.string().datetime({ offset: true }).nullish(),
  locationId: z.number().int().positive().nullish(),
  comment: z.string().max(5000).nullish(),
  expansionIds: z.array(z.number().int().positive()).optional(),
  players: z.array(playerResultSchema).min(1).optional(),
});
export type UpdateSessionInput = z.infer<typeof updateSessionSchema>;

/** Query filters for the sessions list (spec §5). */
export const sessionQuerySchema = z.object({
  game: z.coerce.number().int().positive().optional(),
  person: z.coerce.number().int().positive().optional(),
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
});
export type SessionQuery = z.infer<typeof sessionQuerySchema>;

export interface SessionPlayerDto {
  personId: number;
  name: string;
  score: number | null;
  won: boolean;
  firstPlay: boolean;
  color: string | null;
}

export interface SessionExpansionDto {
  id: number;
  title: string;
}

export interface SessionImageDto {
  id: number;
  imagePath: string;
}

export interface SessionLocationDto {
  id: number;
  name: string;
}

/** Session as returned by the API. */
export interface SessionDto {
  id: number;
  gameId: number;
  gameTitle: string;
  start: string;
  end: string | null;
  durationMinutes: number | null;
  comment: string | null;
  location: SessionLocationDto | null;
  expansions: SessionExpansionDto[];
  players: SessionPlayerDto[];
  images: SessionImageDto[];
  /** The requesting user's rating of this specific play, if any (1.0–10.0). */
  myRating: number | null;
  createdAt: string;
}

/** Location create payload. */
export const createLocationSchema = z.object({
  name: z.string().min(1).max(100),
  address: z.string().max(300).nullish(),
});
export type CreateLocationInput = z.infer<typeof createLocationSchema>;

export interface LocationDto {
  id: number;
  name: string;
  address: string | null;
}
