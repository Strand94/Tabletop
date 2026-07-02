import type { Prisma } from '../../../generated/prisma/client.js';
import type {
  CreateSessionInput,
  Paginated,
  PlayerResultInput,
  SessionDto,
  SessionQuery,
  UpdateSessionInput,
} from '@tabletop/shared';
import { prisma } from '../../db.js';
import { HttpError } from '../../middleware/error.js';

const sessionInclude = {
  game: { select: { title: true } },
  location: true,
  expansions: { include: { expansion: { select: { id: true, title: true } } } },
  players: { include: { person: { select: { id: true, name: true } } } },
  images: true,
} satisfies Prisma.SessionInclude;

type SessionWithRelations = Prisma.SessionGetPayload<{ include: typeof sessionInclude }>;

function durationMinutes(start: Date, end: Date | null): number | null {
  if (!end) return null;
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000));
}

export function toSessionDto(
  session: SessionWithRelations,
  myRating: number | null = null,
): SessionDto {
  return {
    id: session.id,
    gameId: session.gameId,
    gameTitle: session.game.title,
    start: session.start.toISOString(),
    end: session.end ? session.end.toISOString() : null,
    durationMinutes: durationMinutes(session.start, session.end),
    comment: session.comment,
    location: session.location ? { id: session.location.id, name: session.location.name } : null,
    expansions: session.expansions.map((es) => ({
      id: es.expansion.id,
      title: es.expansion.title,
    })),
    players: session.players.map((ps) => ({
      personId: ps.person.id,
      name: ps.person.name,
      score: ps.score,
      won: ps.won,
      firstPlay: ps.firstPlay,
      color: ps.color,
    })),
    images: session.images.map((img) => ({ id: img.id, imagePath: img.imagePath })),
    myRating,
    createdAt: session.createdAt.toISOString(),
  };
}

/** Every expansion used in a session must belong to that session's game (§10.2). */
async function assertExpansionsBelongToGame(gameId: number, expansionIds: number[]): Promise<void> {
  if (expansionIds.length === 0) return;
  const unique = [...new Set(expansionIds)];
  const count = await prisma.expansion.count({
    where: { gameId, id: { in: unique } },
  });
  if (count !== unique.length) {
    throw new HttpError(400, 'One or more expansions do not belong to this game');
  }
}

/** All player personIds must reference existing people. */
async function assertPeopleExist(players: PlayerResultInput[]): Promise<void> {
  const ids = [...new Set(players.map((p) => p.personId))];
  const count = await prisma.person.count({ where: { id: { in: ids } } });
  if (count !== ids.length) throw new HttpError(400, 'One or more players do not exist');
}

async function assertGameExists(gameId: number): Promise<void> {
  const game = await prisma.game.findUnique({ where: { id: gameId }, select: { id: true } });
  if (!game) throw new HttpError(404, 'Game not found');
}

function playerCreateData(
  players: PlayerResultInput[],
): Prisma.PlayerSessionCreateManySessionInput[] {
  return players.map((p) => ({
    personId: p.personId,
    score: p.score ?? null,
    won: p.won,
    firstPlay: p.firstPlay,
    color: p.color ?? null,
  }));
}

export async function createSession(input: CreateSessionInput): Promise<SessionDto> {
  await assertGameExists(input.gameId);
  await assertExpansionsBelongToGame(input.gameId, input.expansionIds);
  await assertPeopleExist(input.players);

  const session = await prisma.session.create({
    data: {
      gameId: input.gameId,
      start: new Date(input.start),
      end: input.end ? new Date(input.end) : null,
      locationId: input.locationId ?? null,
      comment: input.comment ?? null,
      expansions: { create: input.expansionIds.map((expansionId) => ({ expansionId })) },
      players: { createMany: { data: playerCreateData(input.players) } },
    },
    include: sessionInclude,
  });
  return toSessionDto(session);
}

export async function listSessions(
  query: SessionQuery,
  userId: number,
): Promise<Paginated<SessionDto>> {
  const where: Prisma.SessionWhereInput = {};
  if (query.game) where.gameId = query.game;
  if (query.person) where.players = { some: { personId: query.person } };
  if (query.from || query.to) {
    where.start = {};
    if (query.from) where.start.gte = new Date(query.from);
    if (query.to) where.start.lte = new Date(query.to);
  }

  const [total, sessions] = await Promise.all([
    prisma.session.count({ where }),
    prisma.session.findMany({
      where,
      include: sessionInclude,
      orderBy: { start: 'desc' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
  ]);

  const myRatings = await prisma.userSessionRating.findMany({
    where: { userId, sessionId: { in: sessions.map((s) => s.id) } },
  });
  const ratingBySession = new Map(myRatings.map((r) => [r.sessionId, r.rating.toNumber()]));

  return {
    items: sessions.map((s) => toSessionDto(s, ratingBySession.get(s.id) ?? null)),
    total,
    page: query.page,
    pageSize: query.pageSize,
  };
}

export async function getSession(id: number, userId: number): Promise<SessionDto> {
  const session = await prisma.session.findUnique({ where: { id }, include: sessionInclude });
  if (!session) throw new HttpError(404, 'Session not found');
  const myRating = await prisma.userSessionRating.findUnique({
    where: { userId_sessionId: { userId, sessionId: id } },
  });
  return toSessionDto(session, myRating?.rating.toNumber() ?? null);
}

export async function updateSession(id: number, input: UpdateSessionInput): Promise<SessionDto> {
  const existing = await prisma.session.findUnique({
    where: { id },
    select: { id: true, gameId: true },
  });
  if (!existing) throw new HttpError(404, 'Session not found');

  if (input.expansionIds) {
    await assertExpansionsBelongToGame(existing.gameId, input.expansionIds);
  }
  if (input.players) await assertPeopleExist(input.players);

  const session = await prisma.$transaction(async (tx) => {
    await tx.session.update({
      where: { id },
      data: {
        start: input.start ? new Date(input.start) : undefined,
        end: input.end === undefined ? undefined : input.end ? new Date(input.end) : null,
        locationId: input.locationId === undefined ? undefined : (input.locationId ?? null),
        comment: input.comment === undefined ? undefined : (input.comment ?? null),
      },
    });
    if (input.expansionIds) {
      await tx.expansionSession.deleteMany({ where: { sessionId: id } });
      await tx.expansionSession.createMany({
        data: input.expansionIds.map((expansionId) => ({ sessionId: id, expansionId })),
      });
    }
    if (input.players) {
      await tx.playerSession.deleteMany({ where: { sessionId: id } });
      await tx.playerSession.createMany({
        data: playerCreateData(input.players).map((p) => ({ ...p, sessionId: id })),
      });
    }
    return tx.session.findUniqueOrThrow({ where: { id }, include: sessionInclude });
  });
  return toSessionDto(session);
}

export async function deleteSession(id: number): Promise<void> {
  const existing = await prisma.session.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw new HttpError(404, 'Session not found');
  await prisma.session.delete({ where: { id } });
}

export async function addSessionImage(
  id: number,
  imagePath: string,
  userId: number,
): Promise<SessionDto> {
  const existing = await prisma.session.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw new HttpError(404, 'Session not found');
  await prisma.sessionImage.create({ data: { sessionId: id, imagePath } });
  return getSession(id, userId);
}
