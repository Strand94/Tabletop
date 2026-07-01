import type { Prisma } from '@prisma/client';
import type { CreateExpansionInput, ExpansionDto, UpdateExpansionInput } from '@tabletop/shared';
import { prisma } from '../../db.js';
import { HttpError } from '../../middleware/error.js';

const expansionInclude = {
  _count: { select: { sessions: true } },
} satisfies Prisma.ExpansionInclude;

type ExpansionWithCount = Prisma.ExpansionGetPayload<{ include: typeof expansionInclude }>;

function decToNum(value: Prisma.Decimal | null): number | null {
  return value === null ? null : value.toNumber();
}

function dateOnly(value: Date | null): string | null {
  return value === null ? null : value.toISOString().slice(0, 10);
}

export function toExpansionDto(exp: ExpansionWithCount): ExpansionDto {
  return {
    id: exp.id,
    gameId: exp.gameId,
    title: exp.title,
    imagePath: exp.imagePath,
    releaseYear: exp.releaseYear,
    minPlayers: exp.minPlayers,
    maxPlayers: exp.maxPlayers,
    minPlaytime: exp.minPlaytime,
    maxPlaytime: exp.maxPlaytime,
    minAge: exp.minAge,
    weight: decToNum(exp.weight),
    description: exp.description,
    price: decToNum(exp.price),
    dateAdded: dateOnly(exp.dateAdded),
    bggId: exp.bggId,
    bggRating: decToNum(exp.bggRating),
    bggRank: exp.bggRank,
    bggSyncedAt: exp.bggSyncedAt ? exp.bggSyncedAt.toISOString() : null,
    sessionCount: exp._count.sessions,
    createdAt: exp.createdAt.toISOString(),
    updatedAt: exp.updatedAt.toISOString(),
  };
}

function toWritableData(
  input: Partial<CreateExpansionInput>,
): Omit<Prisma.ExpansionUncheckedCreateInput, 'gameId' | 'title'> & { title?: string } {
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
    price: input.price ?? undefined,
    dateAdded: input.dateAdded ? new Date(input.dateAdded) : undefined,
    bggId: input.bggId ?? undefined,
  };
}

/** List the expansions belonging to a game (validates the game exists). */
export async function listExpansions(gameId: number): Promise<ExpansionDto[]> {
  await ensureGameExists(gameId);
  const expansions = await prisma.expansion.findMany({
    where: { gameId },
    include: expansionInclude,
    orderBy: { title: 'asc' },
  });
  return expansions.map(toExpansionDto);
}

/** Create an expansion attached to an existing base game. */
export async function createExpansion(
  gameId: number,
  input: CreateExpansionInput,
): Promise<ExpansionDto> {
  await ensureGameExists(gameId);
  const exp = await prisma.expansion.create({
    data: { ...toWritableData(input), title: input.title, gameId },
    include: expansionInclude,
  });
  return toExpansionDto(exp);
}

export async function updateExpansion(
  id: number,
  input: UpdateExpansionInput,
): Promise<ExpansionDto> {
  await ensureExpansionExists(id);
  const exp = await prisma.expansion.update({
    where: { id },
    data: toWritableData(input),
    include: expansionInclude,
  });
  return toExpansionDto(exp);
}

export async function deleteExpansion(id: number): Promise<void> {
  await ensureExpansionExists(id);
  await prisma.expansion.delete({ where: { id } });
}

async function ensureGameExists(gameId: number): Promise<void> {
  const game = await prisma.game.findUnique({ where: { id: gameId }, select: { id: true } });
  if (!game) throw new HttpError(404, 'Game not found');
}

async function ensureExpansionExists(id: number): Promise<void> {
  const exp = await prisma.expansion.findUnique({ where: { id }, select: { id: true } });
  if (!exp) throw new HttpError(404, 'Expansion not found');
}
