import type {
  GameRatingDto,
  SessionRatingDto,
  UpsertGameRatingInput,
  UpsertSessionRatingInput,
} from '@tabletop/shared';
import { prisma } from '../../db.js';
import { HttpError } from '../../middleware/error.js';

/** Upsert the current user's overall rating of a game (spec §3.9). */
export async function upsertGameRating(
  userId: number,
  gameId: number,
  input: UpsertGameRatingInput,
): Promise<GameRatingDto> {
  const game = await prisma.game.findUnique({ where: { id: gameId }, select: { id: true } });
  if (!game) throw new HttpError(404, 'Game not found');

  const rating = await prisma.userGameRating.upsert({
    where: { userId_gameId: { userId, gameId } },
    create: { userId, gameId, rating: input.rating, review: input.review ?? null },
    update: { rating: input.rating, review: input.review ?? null },
  });
  return {
    rating: rating.rating.toNumber(),
    review: rating.review,
    updatedAt: rating.updatedAt.toISOString(),
  };
}

/** Upsert the current user's rating of a specific play/session (spec §3.9). */
export async function upsertSessionRating(
  userId: number,
  sessionId: number,
  input: UpsertSessionRatingInput,
): Promise<SessionRatingDto> {
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    select: { id: true },
  });
  if (!session) throw new HttpError(404, 'Session not found');

  const rating = await prisma.userSessionRating.upsert({
    where: { userId_sessionId: { userId, sessionId } },
    create: { userId, sessionId, rating: input.rating, note: input.note ?? null },
    update: { rating: input.rating, note: input.note ?? null },
  });
  return {
    rating: rating.rating.toNumber(),
    note: rating.note,
    updatedAt: rating.updatedAt.toISOString(),
  };
}
