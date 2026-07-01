/** One most-played game entry. */
export interface MostPlayedGame {
  gameId: number;
  title: string;
  plays: number;
}

/** A player's win share for the dashboard leaderboard. */
export interface TopPlayer {
  personId: number;
  name: string;
  plays: number;
  wins: number;
  /** Win rate as a fraction 0..1. */
  winRate: number;
}

/** Sessions logged on a given day (YYYY-MM-DD). */
export interface SessionsPerDay {
  date: string;
  count: number;
}

/** A compact recent-session row for the dashboard. */
export interface RecentSession {
  id: number;
  gameId: number;
  gameTitle: string;
  start: string;
  durationMinutes: number | null;
  winners: string[];
}

/** Headline dashboard counters + activity (spec §4.1 item 7). */
export interface DashboardStats {
  gamesOwned: number;
  wishlist: number;
  sessions: number;
  players: number;
  expansions: number;
  /** Total price of owned games, in the instance currency. */
  collectionValue: number;
  /** Average price across owned games that have a price. */
  avgPrice: number;
  currency: string;
  mostPlayed: MostPlayedGame[];
  topPlayers: TopPlayer[];
  /** Sessions per day over the last 14 days, oldest first. */
  sessionsPerDay: SessionsPerDay[];
  recentSessions: RecentSession[];
}

/** Per-player statistics (spec §5 GET /api/stats/players). */
export interface PlayerStats {
  personId: number;
  name: string;
  plays: number;
  wins: number;
  winRate: number;
  avgScore: number | null;
  favoriteGame: string | null;
}

/** Per-game statistics (spec §5 GET /api/stats/games/:id). */
export interface GameStats {
  gameId: number;
  plays: number;
  avgSessionRating: number | null;
  lastPlayed: string | null;
  topPlayers: TopPlayer[];
}
