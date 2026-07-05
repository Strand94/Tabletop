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
    imagePath: input.imagePath,
    releaseYear: input.releaseYear,
    minPlayers: input.minPlayers,
    maxPlayers: input.maxPlayers,
    minPlaytime: input.minPlaytime,
    maxPlaytime: input.maxPlaytime,
    minAge: input.minAge,
    weight: input.weight,
    description: input.description,
    type: input.type,
    price: input.price,
    currency: input.currency,
    collectionStatus: input.collectionStatus,
    dateAdded: input.dateAdded == null ? input.dateAdded : new Date(input.dateAdded),
    bggId: input.bggId,
  };
}

/** The user's per-game rating map for a set of game ids (cards show the star). */
async function ratingMapFor(userId: number, gameIds: number[]): Promise<Map<number, number>> {
  const rows = await prisma.userGameRating.findMany({
    where: { userId, gameId: { in: gameIds } },
  });
  return new Map(rows.map((r) => [r.gameId, r.rating.toNumber()]));
}

/** Map games to DTOs attaching each game's rating from the map (list path: no session avg). */
function toListItems(games: GameWithCategories[], ratingByGame: Map<number, number>): GameDto[] {
  return games.map((g) =>
    toGameDto(g, {
      myRating: ratingByGame.get(g.id) ?? null,
      avgSessionRating: null,
      sessionRatingCount: 0,
    }),
  );
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

  if (query.sort === 'myRating') {
    return listGamesByMyRating(query, userId, where);
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

  const ratingByGame = await ratingMapFor(
    userId,
    games.map((g) => g.id),
  );

  return {
    items: toListItems(games, ratingByGame),
    total,
    page: query.page,
    pageSize: query.pageSize,
  };
}

/**
 * Sort by the requesting user's per-game rating. `UserGameRating` is per-user, so
 * Prisma can't `orderBy` it directly — we sort ids in memory (NULL/unrated always
 * last regardless of order; tie-break by id asc for stability) and page over that.
 */
async function listGamesByMyRating(
  query: GameQuery,
  userId: number,
  where: Prisma.GameWhereInput,
): Promise<Paginated<GameDto>> {
  const matching = await prisma.game.findMany({ where, select: { id: true } });
  const ratingByGame = await ratingMapFor(
    userId,
    matching.map((g) => g.id),
  );

  const sortedIds = matching
    .map((g) => g.id)
    .sort((a, b) => {
      const ra = ratingByGame.get(a);
      const rb = ratingByGame.get(b);
      if (ra == null && rb == null) return a - b;
      if (ra == null) return 1; // unrated always last
      if (rb == null) return -1;
      if (ra !== rb) return query.order === 'asc' ? ra - rb : rb - ra;
      return a - b; // stable tie-break
    });

  const total = sortedIds.length;
  const pageIds = sortedIds.slice(
    (query.page - 1) * query.pageSize,
    (query.page - 1) * query.pageSize + query.pageSize,
  );

  const games = await prisma.game.findMany({
    where: { id: { in: pageIds } },
    include: gameInclude,
  });
  const byId = new Map(games.map((g) => [g.id, g]));
  const ordered = pageIds.map((id) => byId.get(id)).filter((g): g is GameWithCategories => !!g);

  return {
    items: toListItems(ordered, ratingByGame),
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
