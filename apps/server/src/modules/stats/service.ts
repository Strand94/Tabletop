import type {
  DashboardStats,
  GameStats,
  PlayerStats,
  SessionsPerDay,
  TopPlayer,
} from '@tabletop/shared';
import { prisma } from '../../db.js';
import { HttpError } from '../../middleware/error.js';

interface PlayerAgg {
  personId: number;
  name: string;
  plays: number;
  wins: number;
  scoreSum: number;
  scoreCount: number;
  gameCounts: Map<string, number>;
}

/**
 * Single pass over all player-sessions to derive per-person aggregates (plays,
 * wins, average score, favourite game). Fine for a household-scale instance.
 */
async function computePlayerAggregates(): Promise<Map<number, PlayerAgg>> {
  const rows = await prisma.playerSession.findMany({
    include: {
      person: { select: { id: true, name: true } },
      session: { select: { game: { select: { title: true } } } },
    },
  });

  const map = new Map<number, PlayerAgg>();
  for (const row of rows) {
    let agg = map.get(row.personId);
    if (!agg) {
      agg = {
        personId: row.personId,
        name: row.person.name,
        plays: 0,
        wins: 0,
        scoreSum: 0,
        scoreCount: 0,
        gameCounts: new Map(),
      };
      map.set(row.personId, agg);
    }
    agg.plays += 1;
    if (row.won) agg.wins += 1;
    if (row.score !== null) {
      agg.scoreSum += row.score;
      agg.scoreCount += 1;
    }
    const title = row.session.game.title;
    agg.gameCounts.set(title, (agg.gameCounts.get(title) ?? 0) + 1);
  }
  return map;
}

function favouriteGame(agg: PlayerAgg): string | null {
  let best: string | null = null;
  let bestCount = 0;
  for (const [title, count] of agg.gameCounts) {
    if (count > bestCount) {
      best = title;
      bestCount = count;
    }
  }
  return best;
}

function toTopPlayers(aggs: PlayerAgg[], limit: number): TopPlayer[] {
  return aggs
    .filter((a) => a.plays > 0)
    .map((a) => ({
      personId: a.personId,
      name: a.name,
      plays: a.plays,
      wins: a.wins,
      winRate: a.wins / a.plays,
    }))
    .sort((a, b) => b.winRate - a.winRate || b.plays - a.plays)
    .slice(0, limit);
}

async function mostPlayedGames(limit: number): Promise<DashboardStats['mostPlayed']> {
  const grouped = await prisma.session.groupBy({
    by: ['gameId'],
    _count: { _all: true },
    orderBy: { _count: { gameId: 'desc' } },
    take: limit,
  });
  if (grouped.length === 0) return [];
  const games = await prisma.game.findMany({
    where: { id: { in: grouped.map((g) => g.gameId) } },
    select: { id: true, title: true },
  });
  const titleById = new Map(games.map((g) => [g.id, g.title]));
  return grouped.map((g) => ({
    gameId: g.gameId,
    title: titleById.get(g.gameId) ?? '—',
    plays: g._count._all,
  }));
}

/** Sessions per day for the last `days` days (oldest first), zero-filled. */
async function sessionsPerDay(days: number): Promise<SessionsPerDay[]> {
  const since = new Date();
  since.setHours(0, 0, 0, 0);
  since.setDate(since.getDate() - (days - 1));

  const sessions = await prisma.session.findMany({
    where: { start: { gte: since } },
    select: { start: true },
  });

  const counts = new Map<string, number>();
  for (const s of sessions) {
    const key = s.start.toISOString().slice(0, 10);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const result: SessionsPerDay[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(since);
    d.setDate(since.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    result.push({ date: key, count: counts.get(key) ?? 0 });
  }
  return result;
}

async function recentSessions(limit: number): Promise<DashboardStats['recentSessions']> {
  const sessions = await prisma.session.findMany({
    orderBy: { start: 'desc' },
    take: limit,
    include: {
      game: { select: { title: true } },
      players: { where: { won: true }, include: { person: { select: { name: true } } } },
    },
  });
  return sessions.map((s) => ({
    id: s.id,
    gameId: s.gameId,
    gameTitle: s.game.title,
    start: s.start.toISOString(),
    durationMinutes:
      s.end === null
        ? null
        : Math.max(0, Math.round((s.end.getTime() - s.start.getTime()) / 60000)),
    winners: s.players.map((p) => p.person.name),
  }));
}

/** Compute the full dashboard payload. */
export async function dashboardStats(currency: string): Promise<DashboardStats> {
  const [
    gamesOwned,
    wishlist,
    sessions,
    players,
    expansions,
    ownedAgg,
    aggregates,
    most,
    perDay,
    recent,
  ] = await Promise.all([
    prisma.game.count({ where: { collectionStatus: 'OWNED' } }),
    prisma.game.count({ where: { collectionStatus: 'WISHLIST' } }),
    prisma.session.count(),
    prisma.person.count(),
    prisma.expansion.count(),
    prisma.game.aggregate({
      where: { collectionStatus: 'OWNED', price: { not: null } },
      _sum: { price: true },
      _avg: { price: true },
    }),
    computePlayerAggregates(),
    mostPlayedGames(5),
    sessionsPerDay(14),
    recentSessions(4),
  ]);

  return {
    gamesOwned,
    wishlist,
    sessions,
    players,
    expansions,
    collectionValue: ownedAgg._sum.price?.toNumber() ?? 0,
    avgPrice: ownedAgg._avg.price?.toNumber() ?? 0,
    currency,
    mostPlayed: most,
    topPlayers: toTopPlayers([...aggregates.values()], 5),
    sessionsPerDay: perDay,
    recentSessions: recent,
  };
}

/** Per-player statistics for the players page. */
export async function playerStats(): Promise<PlayerStats[]> {
  const [people, aggregates] = await Promise.all([
    prisma.person.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    computePlayerAggregates(),
  ]);

  return people.map((person) => {
    const agg = aggregates.get(person.id);
    if (!agg || agg.plays === 0) {
      return {
        personId: person.id,
        name: person.name,
        plays: 0,
        wins: 0,
        winRate: 0,
        avgScore: null,
        favoriteGame: null,
      };
    }
    return {
      personId: person.id,
      name: person.name,
      plays: agg.plays,
      wins: agg.wins,
      winRate: agg.wins / agg.plays,
      avgScore: agg.scoreCount > 0 ? agg.scoreSum / agg.scoreCount : null,
      favoriteGame: favouriteGame(agg),
    };
  });
}

/** Per-game statistics. */
export async function gameStats(gameId: number): Promise<GameStats> {
  const game = await prisma.game.findUnique({ where: { id: gameId }, select: { id: true } });
  if (!game) throw new HttpError(404, 'Game not found');

  const [plays, last, ratingAgg, playerRows] = await Promise.all([
    prisma.session.count({ where: { gameId } }),
    prisma.session.findFirst({
      where: { gameId },
      orderBy: { start: 'desc' },
      select: { start: true },
    }),
    prisma.userSessionRating.aggregate({
      where: { session: { gameId } },
      _avg: { rating: true },
    }),
    prisma.playerSession.findMany({
      where: { session: { gameId } },
      include: { person: { select: { id: true, name: true } } },
    }),
  ]);

  const byPerson = new Map<number, PlayerAgg>();
  for (const row of playerRows) {
    let agg = byPerson.get(row.personId);
    if (!agg) {
      agg = {
        personId: row.personId,
        name: row.person.name,
        plays: 0,
        wins: 0,
        scoreSum: 0,
        scoreCount: 0,
        gameCounts: new Map(),
      };
      byPerson.set(row.personId, agg);
    }
    agg.plays += 1;
    if (row.won) agg.wins += 1;
  }

  return {
    gameId,
    plays,
    avgSessionRating: ratingAgg._avg.rating?.toNumber() ?? null,
    lastPlayed: last?.start.toISOString() ?? null,
    topPlayers: toTopPlayers([...byPerson.values()], 5),
  };
}
