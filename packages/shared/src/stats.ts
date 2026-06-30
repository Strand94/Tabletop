/** Headline dashboard counters (spec §4.1 item 7). */
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
}
