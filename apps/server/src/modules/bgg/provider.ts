/**
 * BGG rating sync seam (spec §9). Pluggable and shipped disabled. The provider
 * only ever writes the read-only bgg_rating / bgg_rank / bgg_synced_at fields;
 * it never touches user ratings. Wiring the real fetch is a later, opt-in change.
 */
export interface BggRating {
  bggId: number;
  rating: number | null;
  rank: number | null;
}

export interface BggRatingProvider {
  /** Fetch ratings for the given BGG thing ids (or all known when empty). */
  fetchRatings(bggIds: number[]): Promise<BggRating[]>;
}

/**
 * Default provider: would download BGG's public ranks CSV data dump and match by
 * bgg_id. No token required. Ships as a no-op stub — returns nothing so a sync
 * run is a safe no-op until wired up.
 */
export class CsvDumpProvider implements BggRatingProvider {
  fetchRatings(_bggIds: number[]): Promise<BggRating[]> {
    return Promise.resolve([]);
  }
}

/**
 * Optional token-gated provider that would call the BGG XML API2 `thing`
 * endpoint with a Bearer token. Stub until a token is configured and wired.
 */
export class XmlApiProvider implements BggRatingProvider {
  constructor(private readonly token: string | undefined) {}

  fetchRatings(_bggIds: number[]): Promise<BggRating[]> {
    if (!this.token) return Promise.resolve([]);
    return Promise.resolve([]);
  }
}

export function selectProvider(provider: string, token: string | undefined): BggRatingProvider {
  return provider === 'xmlapi' ? new XmlApiProvider(token) : new CsvDumpProvider();
}
