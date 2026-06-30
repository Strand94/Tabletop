import type { Prisma } from '@prisma/client';
import type { CreateGameInput, GameDto, GameQuery, UpdateGameInput } from '@tabletop/shared';
import { prisma } from '../../db.js';
import { HttpError } from '../../middleware/error.js';

const gameInclude = {
  categories: { include: { category: true } },
} satisfies Prisma.GameInclude;

type GameWithCategories = Prisma.GameGetPayload<{ include: typeof gameInclude }>;

function decToNum(value: Prisma.Decimal | null): number | null {
  return value === null ? null : value.toNumber();
}

function dateOnly(value: Date | null): string | null {
  return value === null ? null : value.toISOString().slice(0, 10);
}

/** Map a Prisma game (with categories) to the API DTO. */
export function toGameDto(game: GameWithCategories): GameDto {
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

export async function listGames(query: GameQuery): Promise<GameDto[]> {
  const where: Prisma.GameWhereInput = {};
  if (query.status) where.collectionStatus = query.status;
  if (query.category) where.categories = { some: { categoryId: query.category } };
  if (query.q) where.title = { contains: query.q, mode: 'insensitive' };

  const games = await prisma.game.findMany({
    where,
    include: gameInclude,
    orderBy: { [query.sort]: query.order },
  });
  return games.map(toGameDto);
}

export async function getGame(id: number): Promise<GameDto> {
  const game = await prisma.game.findUnique({ where: { id }, include: gameInclude });
  if (!game) throw new HttpError(404, 'Game not found');
  return toGameDto(game);
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
