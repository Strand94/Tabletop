import { z } from 'zod';

/**
 * Enum codes shared across the API. These mirror the Prisma enums but are
 * defined here independently so neither the client nor the shared package needs
 * to depend on @prisma/client. Values are stable codes; the frontend localizes
 * display labels.
 */
export const Role = z.enum(['ADMIN', 'MEMBER']);
export type Role = z.infer<typeof Role>;

export const CollectionStatus = z.enum(['OWNED', 'WISHLIST']);
export type CollectionStatus = z.infer<typeof CollectionStatus>;

export const GameType = z.enum([
  'BOARD_GAME',
  'CARD_GAME',
  'DICE_GAME',
  'MINIATURES',
  'RPG',
  'OTHER',
]);
export type GameType = z.infer<typeof GameType>;
