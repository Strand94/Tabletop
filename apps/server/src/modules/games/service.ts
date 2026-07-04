import type { Prisma } from '../../../generated/prisma/client.js';
import type {
  CreateGameInput,
  GameDto,
  GameQuery,
  Paginated,
  UpdateGameInput,
} from '@tabletop/shared';
import { prisma } from '../../db.js';
import { HttpError } from '../../middleware/error.js';
import { decToNum, dateOnly } from '../../lib/prisma-map.js';

const gameInclude = {
  categories: { include: { category: true } },
} satisfies Prisma.GameInclude;

type GameWithCategories = Prisma.GameGetPayload<{ include: typeof gameInclude }>;

interface RatingFields {
  myRating: number | null;
  avgSessionRating: number | null;
  sessionRatingCount: number;
}

const NO_RATINGS: RatingFields = { myRating: null, avgSessionRating: null, sessionRatingCount: 0 };

/** Map a Prisma game (with categories) to the API DTO. */
export function toGameDto(game: GameWithCategories, ratings: RatingFields = NO_RATINGS): GameDto {
  return {
    id: game.id,
    title: game.title,
    imagePath: game.imagePath,
    releaseYear: game.releaseYear,
    minPlayers: game.minPlayers,
    maxPlayers: game.maxPlayers,
    minPlaytime: game.minPlaytime,
    maxPlaytime: game.maxPlaytime,
    minAge: game.minAge,
    weight: decToNum(game.weight),
    description: game.description,
    type: game.type,
    price: decToNum(game.price),
    currency: game.currency,
    collectionStatus: game.collectionStatus,
    dateAdded: dateOnly(game.dateAdded),
    bggId: game.bggId,
    bggRating: decToNum(game.bggRating),
    bggRank: game.bggRank,
    bggSyncedAt: game.bggSyncedAt ? game.bggSyncedAt.toISOString() : null,
    categories: game.categories.map((gc) => ({ id: gc.category.id, name: gc.category.name })),
    myRating: ratings.myRating,
    avgSessionRating: ratings.avgSessionRating,
    sessionRatingCount: ratings.sessionRatingCount,
    createdAt: game.createdAt.toISOString(),
    updatedAt: game.updatedAt.toISOString(),
  };
}

/** Build the writable Prisma data from a validated input (excludes categoryIds). */
function toWritableData(input: Partial<CreateGameInput>): Omit<
  Prisma.GameUncheckedCreateInput,
  'currency' | 'title'
> & {
  title?: string;
  currency?: string;
} {
  return {
    title: input.title,
    imagePath: input.imagePath ?? undefined,
    releaseYear: input.releaseYear ?? undefined,
    minPlayers: input.minPlayers ?? undefined,
    maxPlayers: input.maxPlayers ?? undefined,
    minPlaytime: input.minPlaytime ?? undefined,
    maxPlaytime: input.maxPlaytime ?? undefined,
    minAge: input.minAge ?? undefined,
    weight: input.weight ?? undefined,
    description: input.description ?? undefined,
    type: input.type ?? undefined,
    price: input.price ?? undefined,
    currency: input.currency,
    collectionStatus: input.collectionStatus ?? undefined,
    dateAdded: input.dateAdded ? new Date(input.dateAdded) : undefined,
    bggId: input.bggId ?? undefined,
  };
}

export async function listGames(query: GameQuery, userId: number): Promise<Paginated<GameDto>> {
  const where: Prisma.GameWhereInput = {};
  if (query.status) where.collectionStatus = query.status;
  if (query.category) where.categories = { some: { categoryId: query.category } };
  if (query.q) where.title = { contains: query.q, mode: 'insensitive' };
  if (query.neverPlayed) {
    // Shelf of shame: owned games with no logged sessions (spec §4.2).
    where.collectionStatus = 'OWNED';
    where.sessions = { none: {} };
  }

  const [total, games] = await Promise.all([
    prisma.game.count({ where }),
    prisma.game.findMany({
      where,
      include: gameInclude,
      orderBy: { [query.sort]: query.order },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
  ]);

  // One query for the user's ratings across the listed games (cards show the star).
  const myRatings = await prisma.userGameRating.findMany({
    where: { userId, gameId: { in: games.map((g) => g.id) } },
  });
  const ratingByGame = new Map(myRatings.map((r) => [r.gameId, r.rating.toNumber()]));

  return {
    items: games.map((g) =>
      toGameDto(g, {
        myRating: ratingByGame.get(g.id) ?? null,
        avgSessionRating: null,
        sessionRatingCount: 0,
      }),
    ),
    total,
    page: query.page,
    pageSize: query.pageSize,
  };
}

export async function getGame(id: number, userId: number): Promise<GameDto> {
  const game = await prisma.game.findUnique({ where: { id }, include: gameInclude });
  if (!game) throw new HttpError(404, 'Game not found');

  const [myRating, sessionAgg] = await Promise.all([
    prisma.userGameRating.findUnique({ where: { userId_gameId: { userId, gameId: id } } }),
    prisma.userSessionRating.aggregate({
      where: { session: { gameId: id } },
      _avg: { rating: true },
      _count: { rating: true },
    }),
  ]);

  return toGameDto(game, {
    myRating: myRating?.rating.toNumber() ?? null,
    avgSessionRating: sessionAgg._avg.rating?.toNumber() ?? null,
    sessionRatingCount: sessionAgg._count.rating,
  });
}

export async function createGame(
  input: CreateGameInput,
  defaultCurrency: string,
): Promise<GameDto> {
  const data = toWritableData(input);
  const game = await prisma.game.create({
    data: {
      ...data,
      title: input.title,
      currency: input.currency ?? defaultCurrency,
      categories: input.categoryIds
        ? { create: input.categoryIds.map((categoryId) => ({ categoryId })) }
        : undefined,
    },
    include: gameInclude,
  });
  return toGameDto(game);
}

export async function updateGame(id: number, input: UpdateGameInput): Promise<GameDto> {
  await ensureExists(id);
  const data = toWritableData(input);
  const game = await prisma.game.update({
    where: { id },
    data: {
      ...data,
      categories: input.categoryIds
        ? {
            deleteMany: {},
            create: input.categoryIds.map((categoryId) => ({ categoryId })),
          }
        : undefined,
    },
    include: gameInclude,
  });
  return toGameDto(game);
}

export async function deleteGame(id: number): Promise<void> {
  await ensureExists(id);
  await prisma.game.delete({ where: { id } });
}

async function ensureExists(id: number): Promise<void> {
  const exists = await prisma.game.findUnique({ where: { id }, select: { id: true } });
  if (!exists) throw new HttpError(404, 'Game not found');
}
