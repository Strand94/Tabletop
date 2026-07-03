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
  avgScore: number | null;
  favouriteGame: string | null;
}

/** Minimal shape needed to rank players by win share. */
type RankablePlayer = Pick<PlayerAgg, 'personId' | 'name' | 'plays' | 'wins'>;

/**
 * Per-person aggregates. Plays / wins / average score are computed in SQL via
 * groupBy; the favourite game comes from a light (personId, gameId) projection
 * plus a single title lookup — instead of materialising every player-session row
 * with nested person/game includes.
 */
async function computePlayerAggregates(): Promise<Map<number, PlayerAgg>> {
  const [statGroups, winGroups, gamePairs, people] = await Promise.all([
    prisma.playerSession.groupBy({
      by: ['personId'],
      _count: { _all: true },
      _avg: { score: true },
    }),
    prisma.playerSession.groupBy({
      by: ['personId'],
      where: { won: true },
      _count: { _all: true },
    }),
    prisma.playerSession.findMany({
      select: { personId: true, session: { select: { gameId: true } } },
    }),
    prisma.person.findMany({ select: { id: true, name: true } }),
  ]);

  // Favourite game per person = most-played game (ties broken by lowest game id).
  const perPersonGameCounts = new Map<number, Map<number, number>>();
  for (const row of gamePairs) {
    let counts = perPersonGameCounts.get(row.personId);
    if (!counts) {
      counts = new Map();
      perPersonGameCounts.set(row.personId, counts);
    }
    const gameId = row.session.gameId;
    counts.set(gameId, (counts.get(gameId) ?? 0) + 1);
  }
  const favouriteGameId = new Map<number, number>();
  for (const [personId, counts] of perPersonGameCounts) {
    let bestGame = -1;
    let bestCount = 0;
    for (const [gameId, count] of counts) {
      if (count > bestCount || (count === bestCount && (bestGame < 0 || gameId < bestGame))) {
        bestGame = gameId;
        bestCount = count;
      }
    }
    if (bestGame >= 0) favouriteGameId.set(personId, bestGame);
  }
  const favIds = [...new Set(favouriteGameId.values())];
  const favGames = favIds.length
    ? await prisma.game.findMany({
        where: { id: { in: favIds } },
        select: { id: true, title: true },
      })
    : [];
  const titleById = new Map(favGames.map((g) => [g.id, g.title]));

  const nameById = new Map(people.map((p) => [p.id, p.name]));
  const winsById = new Map(winGroups.map((w) => [w.personId, w._count._all]));

  const map = new Map<number, PlayerAgg>();
  for (const g of statGroups) {
    const favGid = favouriteGameId.get(g.personId);
    map.set(g.personId, {
      personId: g.personId,
      name: nameById.get(g.personId) ?? '',
      plays: g._count._all,
      wins: winsById.get(g.personId) ?? 0,
      avgScore: g._avg.score ?? null,
      favouriteGame: favGid != null ? (titleById.get(favGid) ?? null) : null,
    });
  }
  return map;
}

function toTopPlayers(aggs: RankablePlayer[], limit: number): TopPlayer[] {
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

/**
 * Local-time `YYYY-MM-DD` key. The window below is anchored to local midnight
 * (the server's TZ — `Europe/Oslo` in the default compose), so buckets must be
 * keyed by local date too. Keying by UTC (`toISOString`) here would misplace
 * evening plays into the wrong day under a non-UTC TZ (spec review #3).
 */
function localDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
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
    const key = localDateKey(s.start);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const result: SessionsPerDay[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(since);
    d.setDate(since.getDate() + i);
    const key = localDateKey(d);
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
      avgScore: agg.avgScore,
      favoriteGame: agg.favouriteGame,
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

  const byPerson = new Map<number, RankablePlayer>();
  for (const row of playerRows) {
    let agg = byPerson.get(row.personId);
    if (!agg) {
      agg = { personId: row.personId, name: row.person.name, plays: 0, wins: 0 };
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
