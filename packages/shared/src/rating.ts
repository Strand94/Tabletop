import { z } from 'zod';

/** Ratings are on a 1.0–10.0 scale (BGG-style), one decimal place (spec §10.5). */
const ratingValue = z
  .number()
  .min(1)
  .max(10)
  .transform((n) => Math.round(n * 10) / 10);

/** Upsert the current user's rating of a game overall. */
export const upsertGameRatingSchema = z.object({
  rating: ratingValue,
  review: z.string().max(5000).nullish(),
});
export type UpsertGameRatingInput = z.infer<typeof upsertGameRatingSchema>;

/** Upsert the current user's rating of a specific play/session. */
export const upsertSessionRatingSchema = z.object({
  rating: ratingValue,
  note: z.string().max(5000).nullish(),
});
export type UpsertSessionRatingInput = z.infer<typeof upsertSessionRatingSchema>;

export interface GameRatingDto {
  rating: number;
  review: string | null;
  updatedAt: string;
}

export interface SessionRatingDto {
  rating: number;
  note: string | null;
  updatedAt: string;
}
