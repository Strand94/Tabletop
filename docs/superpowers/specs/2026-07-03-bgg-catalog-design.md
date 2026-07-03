# BGG Catalog — Autofill & Bulk Import Design

> Companion to `docs/design/tabletop-design-spec.md` (product/data spec). This document
> records the design for a reference **BGG catalog** that powers game-add **autofill**,
> **bulk import**, and finally wires up the already-stubbed BGG rating-sync provider.

Date: 2026-07-03
Status: Approved (design phase)

---

## 1. Problem & context

We want a user adding a game to autofill its data from BoardGameGeek (BGG) by **name or
BGG ID**, and optionally **bulk-import** many games at once.

The codebase already anticipates this: `Game` carries `bggId`, `bggRating`, `bggRank`,
`bggSyncedAt`, and `modules/bgg/provider.ts` ships a stubbed `CsvDumpProvider` whose comment
reads _"would download BGG's public ranks CSV data dump and match by bgg_id."_ This design
supplies that data and builds the user-facing features on top of it.

### 1.1 Data-source investigation (why CSV, not the live API)

As of **2 July 2025**, both official BGG data paths are gated:

| Source                                                             | Auth                                                            | Contents                                                      | Auto-downloadable |
| ------------------------------------------------------------------ | --------------------------------------------------------------- | ------------------------------------------------------------- | ----------------- |
| BGG **XML API2** (`thing`/`search`)                                | Registration + token required                                   | Full details (players, playtime, weight, description)         | No                |
| Official ranks dump `boardgamegeek.com/data_dumps/bg_ranks`        | Login required (verified: "You don't have access to this page") | Ranks CSV (id, name, year, rank, ratings, thumbnail)          | No                |
| **Community mirror** `github.com/beefsack/bgg-ranking-historicals` | **None**                                                        | Republishes the same official dump daily as date-stamped CSVs | **Yes**           |

**Decision:** ingest the freely-downloadable community mirror. It is byte-for-byte the same
data as the official dump and the file the user already exported. No live per-game API is used.

### 1.2 Consequence: which fields autofill can provide

The mirror CSV columns are: `ID, Name, Year, Rank, Average, Bayes average, Users rated, URL,
Thumbnail`. Therefore autofill can fill **title, releaseYear, bggId, bggRating, bggRank,
imagePath (thumbnail)** only. **Player counts, playtime, weight, and description are left
blank** for the user to fill manually (accepted trade-off — those require the gated API).

---

## 2. Decisions locked in

| Decision          | Choice                                                                 | Rationale                                                                                                     |
| ----------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Data source       | **beefsack GitHub mirror**, newest date-stamped CSV                    | Only freely auto-downloadable source; same data as official dump. GitLab `recommend.games` noted as fallback. |
| Storage           | New reference table **`bgg_catalog`**, separate from `game`            | It is reference data, not collection data; games link via existing `Game.bggId`.                              |
| Missing fields    | **Leave blank** on autofill                                            | Honest; mirror can't supply them.                                                                             |
| `bggRating` value | Store CSV **`Average`** (e.g. `8.56`)                                  | The recognizable user average, not the Bayes/geek rating.                                                     |
| BGG page link     | **Derived, not stored**: `https://boardgamegeek.com/boardgame/{bggId}` | Resolves without the slug; drop the CSV `URL` column.                                                         |
| Refresh safety    | Parse fully, then replace in a transaction                             | A failed download never wipes the existing catalog.                                                           |
| Import permission | Member (matches "members create/edit games")                           | Consistent with existing games routes; delete stays admin-only.                                               |

---

## 3. Data model

New Prisma model `BggCatalogEntry` → table `bgg_catalog`:

| Field          | Type                        | Source column   | Notes                                        |
| -------------- | --------------------------- | --------------- | -------------------------------------------- |
| `bggId`        | `Int @id`                   | `ID`            | Primary key.                                 |
| `name`         | `String`                    | `Name`          | Indexed for search.                          |
| `year`         | `Int?`                      | `Year`          | 0/blank → null.                              |
| `rank`         | `Int?`                      | `Rank`          | Sort key for search results.                 |
| `average`      | `Decimal? @db.Decimal(4,2)` | `Average`       | Maps to `Game.bggRating` on import/autofill. |
| `bayesAverage` | `Decimal? @db.Decimal(4,2)` | `Bayes average` | Stored for completeness.                     |
| `usersRated`   | `Int?`                      | `Users rated`   |                                              |
| `thumbnail`    | `String?`                   | `Thumbnail`     | Maps to `Game.imagePath`.                    |
| `snapshotDate` | `DateTime? @db.Date`        | (filename)      | Which dump this row came from.               |
| `updatedAt`    | `DateTime @updatedAt`       | —               |                                              |

- `@@index([name])` for `ILIKE` search (MVP). Optional upgrade: a `pg_trgm` GIN index for
  fuzzy matching — noted, not required for the first cut.
- ~31k rows; negligible for Postgres.
- No `url` column — the BGG link is derived (see §7).

---

## 4. Ingestion / refresh (`apps/server/src/modules/bgg`)

- **`catalog-source.ts`** — `fetchLatestSnapshot()`:
  1. `GET` the GitHub contents/trees API for `beefsack/bgg-ranking-historicals`.
  2. Pick the newest `YYYY-MM-DD*.csv` by filename.
  3. Download the raw CSV and stream-parse rows (header → field mapping, decimals, null-blanks).
     Returns `{ snapshotDate, rows }`.
- **`catalog-service.ts`** — `refreshCatalog({ snapshotDate, rows })`: within a transaction,
  upsert all rows (replace-in-place). Never clears on a failed/partial download. Returns
  `{ count, snapshotDate }`. Also `searchCatalog(q, limit)` and `getCatalogEntries(bggIds)`.
- **Config** (`config.ts`, zod): `BGG_CATALOG_REPO` (default `beefsack/bgg-ranking-historicals`),
  `BGG_CATALOG_REFRESH_ENABLED` (default false), `BGG_CATALOG_REFRESH_CRON`/interval. Fail-fast
  on malformed config; a refresh _runtime_ failure logs (pino) and keeps prior data.

**Triggers:**

1. **Seed / CLI** — `npm run bgg:catalog:refresh`: loads from a **local CSV path** (offline
   bootstrap using the file the user already has) _or_ downloads. Enables first load without
   network.
2. **Admin endpoint** — `POST /api/bgg/catalog/refresh` (admin-only): downloads + refreshes on
   demand; returns `{ count, snapshotDate }`.
3. **Scheduled** — optional daily refresh in `server.ts`, guarded by
   `BGG_CATALOG_REFRESH_ENABLED`.

---

## 5. Autofill on add

- **Shared** (`packages/shared/src/bgg.ts`): `bggCatalogSearchQuerySchema` (`{ q, limit? }`),
  `BggCatalogHitDto` (`{ bggId, name, year, rank, average, thumbnail }`), `bggUrl(bggId)` helper.
- **Server**: `GET /api/bgg/catalog/search?q=` (member auth). If `q` is all digits → match
  `bggId` exactly (plus name-contains); else `name ILIKE '%q%'` ordered by `rank` asc (nulls
  last), `limit` default 10 / max 25.
- **Client**: debounced typeahead/combobox in the add-game form. Each hit shows thumbnail +
  name + year + rank + a "View on BGG ↗" link. On select → populate `title`, `releaseYear`,
  `bggId`, `bggRating` (= `average`), `bggRank`, `imagePath` (= `thumbnail`); leave
  players/playtime/weight/description blank. Submit through the existing create-game flow.

---

## 6. Bulk import

- **Shared**: `bggImportSchema` (`{ bggIds: number[], collectionStatus? }`),
  `BggImportResultDto` (`{ created, skipped }`).
- **Server**: `POST /api/bgg/catalog/import` (member auth). For each `bggId`: skip if a `Game`
  with that `bggId` already exists; else create a `Game` from the catalog row (title,
  releaseYear, bggId, bggRating, bggRank, imagePath, `collectionStatus`, default currency).
  Returns `{ created, skipped }` (skipped includes already-owned and not-in-catalog ids).
- **Client**: a "Browse BGG" screen — paginated catalog search, multi-select checkboxes,
  "Add N to collection", result toast.

---

## 7. BGG page links

- **Shared helper** `bggUrl(bggId) → https://boardgamegeek.com/boardgame/{bggId}` (resolves
  without slug).
- Shown on **`GameDetail.tsx`** ("View on BoardGameGeek ↗") for any game with a `bggId` — not
  just imported ones — and in the autofill dropdown and Browse-BGG screen.
- New i18n strings in `lib/strings/en.ts` + `nb.ts` (no hardcoded UI text, per conventions).

---

## 8. Wiring the existing rating-sync provider

`CsvDumpProvider.fetchRatings(bggIds)` (currently a no-op stub) starts reading `bgg_catalog`,
returning `{ bggId, rating: average, rank }` for the requested ids. The already-built admin
`POST /api/sync/bgg` route then updates `bggRating`/`bggRank`/`bggSyncedAt` on owned games —
closing the loop the code was designed around. It still never touches user ratings.

---

## 9. Error handling

- **Refresh**: network/parse failure → `HttpError(502)` on the admin route with a descriptive
  message; scheduled refresh logs and retains the previous catalog. Replace only inside a
  transaction after a full successful parse.
- **Search**: empty/whitespace `q` → empty list (not an error); `limit` capped.
- **Import**: partial-tolerant — reports `created` vs `skipped`; ids absent from the catalog
  are reported as skipped rather than failing the whole request.

---

## 10. Testing (TDD)

- **Unit** (Vitest): CSV parser (header mapping, decimals, blank year/thumbnail); newest-file
  selection from a filename list; search query builder (numeric-vs-name); `bggUrl` helper.
- **Integration** (Supertest + real Postgres, `*.int.test.ts`): refresh upsert &
  replace-in-transaction; search endpoint ordering; import skip-existing-by-bggId; provider
  reads catalog and the sync route updates `bgg_*` fields.
- **Client** (Vitest): autofill maps hit → form fields; import selection → request payload.

---

## 11. Build order (phased plan)

1. **Catalog foundation** — `bgg_catalog` model + migration, CSV parser, local-file seed CLI.
2. **Autofill** — shared schemas, search endpoint, add-game typeahead + `bggUrl` link.
3. **Bulk import** — import endpoint + Browse-BGG screen.
4. **Auto-refresh & provider wiring** — GitHub download + admin/scheduled refresh; wire
   `CsvDumpProvider`; add the BGG link on `GameDetail`.

Each phase is independently shippable and testable.
