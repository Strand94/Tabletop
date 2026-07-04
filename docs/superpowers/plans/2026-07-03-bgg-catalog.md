# BGG Catalog (Autofill & Bulk Import) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ingest the public BGG ranks CSV mirror into a local catalog table and use it to autofill the add-game form and bulk-import games, plus wire the existing rating-sync provider.

**Architecture:** A new `bgg_catalog` reference table is filled from the freely-downloadable `beefsack/bgg-ranking-historicals` mirror (newest date-stamped CSV), with skip-if-unchanged so a same-day poll is a no-op and refresh replaces the table transactionally. A member-facing search endpoint powers a typeahead in the add-game modal; a bulk-import endpoint creates games from selected catalog rows. The already-stubbed `CsvDumpProvider` starts reading this table.

**Tech Stack:** TypeScript, Express 5, Prisma 7 + Postgres, zod (`@tabletop/shared`), React + Vite + TanStack Query, Vitest + Supertest.

## Global Constraints

- Node `>=20`; npm workspaces monorepo (`apps/server`, `apps/client`, `packages/shared`).
- **All API input/output shapes are zod schemas in `@tabletop/shared`** — edit the schema there first; server and client both import it.
- **No hardcoded user-facing strings** — every UI string goes in `apps/client/src/lib/strings/en.ts` AND `nb.ts` (same key shape) and is read via `t.*`.
- ESLint runs with `--max-warnings=0`; `npm run typecheck` must pass (husky pre-commit runs lint-staged + typecheck — never `--no-verify`).
- Conventional Commits, one logical change per commit. TDD: write the failing test first.
- Auth: members create/edit; destructive routes are `requireRole('ADMIN')`. Catalog search/import are member-allowed; catalog refresh is admin-only.
- Integration tests are `*.int.test.ts`, excluded from `npm test`; run with `RUN_DB_TESTS=1 DATABASE_URL=postgresql://tabletop:changeme@localhost:5432/tabletop npx vitest run --project server`.
- Money/ratings decimals: Prisma `Decimal` — convert to `number` in DTOs via `.toNumber()`.
- `bggRating` stores the CSV **`Average`** value.

---

## File Structure

**Create:**

- `packages/shared/src/bgg.ts` — catalog zod schemas, DTOs, `bggUrl()` helper.
- `apps/server/src/modules/bgg/csv.ts` — pure CSV → row parser.
- `apps/server/src/modules/bgg/snapshot.ts` — pure newest-filename resolver + `snapshotDateFromName`.
- `apps/server/src/modules/bgg/catalog-service.ts` — DB ops: refresh (replace + skip-if-unchanged), search, get-by-ids, current snapshot.
- `apps/server/src/modules/bgg/catalog-source.ts` — GitHub listing + CSV download (network).
- `apps/server/src/modules/bgg/catalog-routes.ts` — `/api/bgg/catalog/*` router.
- `apps/server/src/modules/bgg/catalog-cli.ts` — `bgg:catalog:refresh` entrypoint (local file or download).
- `apps/client/src/lib/bgg-api.ts` — `useBggCatalogSearch`, `useBggImport` hooks.
- `apps/client/src/pages/BrowseBgg.tsx` — bulk-import screen.
- Tests alongside: `apps/server/test/bgg-csv.test.ts`, `bgg-snapshot.test.ts`, `bgg-source.test.ts`, `bgg-catalog.int.test.ts`, `packages/shared/test/bgg.test.ts`, `apps/client/src/components/game-autofill.test.ts`.

**Modify:**

- `packages/shared/src/index.ts` — export `./bgg.js`.
- `prisma/schema.prisma` — add `BggCatalogEntry` model.
- `apps/server/src/config.ts` — add `BGG_CATALOG_REPO`, `BGG_CATALOG_REFRESH_ENABLED`.
- `apps/server/src/app.ts` — mount catalog router; pass catalog config.
- `apps/server/src/modules/bgg/provider.ts` — `CsvDumpProvider` reads the catalog.
- `apps/server/src/modules/bgg/routes.ts` — inject a rating reader (so the sync route stays testable).
- `apps/server/src/server.ts` — pass config; optional scheduled refresh.
- `apps/server/src/components`/pages — `GameFormModal.tsx` (autofill), `GameDetail.tsx` (BGG link), `App.tsx` (route).
- `apps/client/src/lib/strings/en.ts` + `nb.ts` — new strings.
- `package.json` — `bgg:catalog:refresh` script; `apps/server/package.json` — `csv-parse` dep.

---

## Task 1: Shared BGG contract

**Files:**

- Create: `packages/shared/src/bgg.ts`
- Modify: `packages/shared/src/index.ts`
- Test: `packages/shared/test/bgg.test.ts`

**Interfaces:**

- Produces: `bggUrl(bggId: number): string`; `BggCatalogHitDto`; `bggCatalogSearchQuerySchema` (`{ q: string; limit: number }`); `bggImportSchema` (`{ bggIds: number[]; collectionStatus?: 'OWNED' | 'WISHLIST' }`); `BggImportResultDto` (`{ created: number; skipped: number }`); `BggCatalogRefreshResultDto` (`{ status: 'refreshed' | 'unchanged'; snapshotDate: string | null; count: number }`).

- [ ] **Step 1: Write the failing test**

```ts
// packages/shared/test/bgg.test.ts
import { describe, expect, it } from 'vitest';
import { bggUrl, bggCatalogSearchQuerySchema, bggImportSchema } from '../src/bgg.js';

describe('bgg shared contract', () => {
  it('builds a BGG page url from an id', () => {
    expect(bggUrl(224517)).toBe('https://boardgamegeek.com/boardgame/224517');
  });

  it('defaults and caps the search limit', () => {
    expect(bggCatalogSearchQuerySchema.parse({ q: 'ark' }).limit).toBe(10);
    expect(bggCatalogSearchQuerySchema.parse({ q: 'ark', limit: '999' }).limit).toBe(25);
  });

  it('requires at least one id to import', () => {
    expect(() => bggImportSchema.parse({ bggIds: [] })).toThrow();
    expect(bggImportSchema.parse({ bggIds: [1, 2] }).bggIds).toEqual([1, 2]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run packages/shared/test/bgg.test.ts`
Expected: FAIL — cannot find module `../src/bgg.js`.

- [ ] **Step 3: Write the implementation**

```ts
// packages/shared/src/bgg.ts
import { z } from 'zod';
import { CollectionStatus } from './enums.js';

/** Canonical BGG game page. Resolves without the slug, so id is enough. */
export function bggUrl(bggId: number): string {
  return `https://boardgamegeek.com/boardgame/${bggId}`;
}

/** One catalog row as returned by search — every stored field is exposed. */
export interface BggCatalogHitDto {
  bggId: number;
  name: string;
  year: number | null;
  rank: number | null;
  average: number | null;
  bayesAverage: number | null;
  usersRated: number | null;
  thumbnail: string | null;
  snapshotDate: string | null;
}

export const bggCatalogSearchQuerySchema = z.object({
  q: z.string().trim().min(1).max(200),
  limit: z.coerce.number().int().min(1).max(25).default(10),
});
export type BggCatalogSearchQuery = z.infer<typeof bggCatalogSearchQuerySchema>;

export const bggImportSchema = z.object({
  bggIds: z.array(z.number().int().positive()).min(1).max(500),
  collectionStatus: CollectionStatus.optional(),
});
export type BggImportInput = z.infer<typeof bggImportSchema>;

export interface BggImportResultDto {
  created: number;
  skipped: number;
}

export interface BggCatalogRefreshResultDto {
  status: 'refreshed' | 'unchanged';
  snapshotDate: string | null;
  count: number;
}
```

Then add the export (keep the list alphabetical-ish, near the other feature exports):

```ts
// packages/shared/src/index.ts  — add after: export * from './game.js';
export * from './bgg.js';
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run packages/shared/test/bgg.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Typecheck & commit**

```bash
npm run typecheck --workspace @tabletop/shared
git add packages/shared/src/bgg.ts packages/shared/src/index.ts packages/shared/test/bgg.test.ts
git commit -m "feat(shared): add BGG catalog contract (schemas, DTOs, bggUrl)"
```

---

## Task 2: Prisma `BggCatalogEntry` model + migration

**Files:**

- Modify: `prisma/schema.prisma`
- Test: `apps/server/test/bgg-catalog.int.test.ts`

**Interfaces:**

- Produces: Prisma model `BggCatalogEntry` → table `bgg_catalog` with columns `bgg_id` (PK), `name`, `year`, `rank`, `average`, `bayes_average`, `users_rated`, `thumbnail`, `snapshot_date`, `updated_at`.

- [ ] **Step 1: Write the failing test**

```ts
// apps/server/test/bgg-catalog.int.test.ts
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/db.js';
import { applyMigrations, resetDb } from './helpers/db.js';

describe.skipIf(process.env.RUN_DB_TESTS !== '1')('bgg_catalog table', () => {
  beforeEach(async () => {
    applyMigrations();
    await resetDb();
  });
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('stores and reads a catalog entry', async () => {
    await prisma.bggCatalogEntry.create({
      data: {
        bggId: 224517,
        name: 'Brass: Birmingham',
        year: 2018,
        rank: 1,
        average: 8.56,
        bayesAverage: 8.393,
        usersRated: 59007,
        thumbnail: 'https://cf.geekdo-images.com/x.jpg',
        snapshotDate: new Date('2026-06-29'),
      },
    });
    const row = await prisma.bggCatalogEntry.findUnique({ where: { bggId: 224517 } });
    expect(row?.name).toBe('Brass: Birmingham');
    expect(row?.average?.toNumber()).toBeCloseTo(8.56);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `RUN_DB_TESTS=1 DATABASE_URL=postgresql://tabletop:changeme@localhost:5432/tabletop npx vitest run apps/server/test/bgg-catalog.int.test.ts`
Expected: FAIL — `prisma.bggCatalogEntry` is undefined / relation `bgg_catalog` does not exist.

- [ ] **Step 3: Add the model**

```prisma
// prisma/schema.prisma  — add after the Game model
model BggCatalogEntry {
  bggId        Int       @id @map("bgg_id")
  name         String
  year         Int?
  rank         Int?
  average      Decimal?  @db.Decimal(4, 2)
  bayesAverage Decimal?  @map("bayes_average") @db.Decimal(4, 2)
  usersRated   Int?      @map("users_rated")
  thumbnail    String?
  snapshotDate DateTime? @map("snapshot_date") @db.Date
  updatedAt    DateTime  @updatedAt @map("updated_at") @db.Timestamptz(6)

  @@index([name])
  @@index([rank])
  @@map("bgg_catalog")
}
```

- [ ] **Step 4: Generate client + create the migration**

Run (needs a local Postgres):

```bash
npm run prisma:generate
npm run prisma:migrate -- --name add_bgg_catalog
```

Expected: a new folder under `prisma/migrations/*_add_bgg_catalog/` and the generated client now exposes `bggCatalogEntry`.

- [ ] **Step 5: Run the test to verify it passes**

Run: `RUN_DB_TESTS=1 DATABASE_URL=postgresql://tabletop:changeme@localhost:5432/tabletop npx vitest run apps/server/test/bgg-catalog.int.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations apps/server/test/bgg-catalog.int.test.ts
git commit -m "feat(db): add bgg_catalog reference table"
```

---

## Task 3: CSV parser (pure)

**Files:**

- Modify: `apps/server/package.json` (add `csv-parse`)
- Create: `apps/server/src/modules/bgg/csv.ts`
- Test: `apps/server/test/bgg-csv.test.ts`

**Interfaces:**

- Produces: `interface CatalogRow { bggId: number; name: string; year: number | null; rank: number | null; average: number | null; bayesAverage: number | null; usersRated: number | null; thumbnail: string | null }` and `parseCatalogCsv(text: string): CatalogRow[]`.

- [ ] **Step 1: Add the dependency**

Run: `npm install csv-parse --workspace apps/server`
Expected: `csv-parse` added to `apps/server/package.json` dependencies.

- [ ] **Step 2: Write the failing test**

```ts
// apps/server/test/bgg-csv.test.ts
import { describe, expect, it } from 'vitest';
import { parseCatalogCsv } from '../src/modules/bgg/csv.js';

const HEADER = 'ID,Name,Year,Rank,Average,Bayes average,Users rated,URL,Thumbnail';

describe('parseCatalogCsv', () => {
  it('maps columns to typed fields', () => {
    const rows = parseCatalogCsv(
      `${HEADER}\n224517,Brass: Birmingham,2018,1,8.56,8.393,59007,/boardgame/224517/brass,https://x/t.jpg`,
    );
    expect(rows).toEqual([
      {
        bggId: 224517,
        name: 'Brass: Birmingham',
        year: 2018,
        rank: 1,
        average: 8.56,
        bayesAverage: 8.393,
        usersRated: 59007,
        thumbnail: 'https://x/t.jpg',
      },
    ]);
  });

  it('honours quoting for names containing commas', () => {
    const rows = parseCatalogCsv(`${HEADER}\n1,"Tak, a Beautiful Game",2016,,,,,/bg/1,`);
    expect(rows[0].name).toBe('Tak, a Beautiful Game');
  });

  it('turns blank/zero numerics and empty thumbnail into null', () => {
    const rows = parseCatalogCsv(`${HEADER}\n42,Nulls,0,,,,,/bg/42,`);
    expect(rows[0]).toMatchObject({ year: null, rank: null, average: null, thumbnail: null });
  });

  it('skips rows with a non-numeric id', () => {
    expect(parseCatalogCsv(`${HEADER}\n,Bad,,,,,,,`)).toEqual([]);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run apps/server/test/bgg-csv.test.ts`
Expected: FAIL — cannot find module `../src/modules/bgg/csv.js`.

- [ ] **Step 4: Write the implementation**

```ts
// apps/server/src/modules/bgg/csv.ts
import { parse } from 'csv-parse/sync';

export interface CatalogRow {
  bggId: number;
  name: string;
  year: number | null;
  rank: number | null;
  average: number | null;
  bayesAverage: number | null;
  usersRated: number | null;
  thumbnail: string | null;
}

/** null unless the string parses to a finite, non-zero-for-year value. */
function int(value: string | undefined, { zeroIsNull = false } = {}): number | null {
  const n = Number((value ?? '').trim());
  if (!Number.isFinite(n)) return null;
  if (zeroIsNull && n === 0) return null;
  return Math.trunc(n);
}

function dec(value: string | undefined): number | null {
  const n = Number((value ?? '').trim());
  return Number.isFinite(n) && n !== 0 ? n : null;
}

function str(value: string | undefined): string | null {
  const s = (value ?? '').trim();
  return s === '' ? null : s;
}

/**
 * Parse a BGG ranks CSV dump into typed rows. Columns:
 * ID, Name, Year, Rank, Average, Bayes average, Users rated, URL, Thumbnail.
 * Rows without a numeric ID are dropped.
 */
export function parseCatalogCsv(text: string): CatalogRow[] {
  const records = parse(text, {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
  }) as Record<string, string>[];

  const rows: CatalogRow[] = [];
  for (const r of records) {
    const bggId = int(r.ID);
    if (bggId === null) continue;
    rows.push({
      bggId,
      name: (r.Name ?? '').trim(),
      year: int(r.Year, { zeroIsNull: true }),
      rank: int(r.Rank, { zeroIsNull: true }),
      average: dec(r.Average),
      bayesAverage: dec(r['Bayes average']),
      usersRated: int(r['Users rated']),
      thumbnail: str(r.Thumbnail),
    });
  }
  return rows;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run apps/server/test/bgg-csv.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add apps/server/package.json package-lock.json apps/server/src/modules/bgg/csv.ts apps/server/test/bgg-csv.test.ts
git commit -m "feat(bgg): parse BGG ranks CSV into typed rows"
```

---

## Task 4: Newest-snapshot resolver (pure)

**Files:**

- Create: `apps/server/src/modules/bgg/snapshot.ts`
- Test: `apps/server/test/bgg-snapshot.test.ts`

**Interfaces:**

- Produces: `snapshotDateFromName(name: string): string | null` (returns `YYYY-MM-DD` or null); `pickLatest(names: string[]): { name: string; snapshotDate: string } | null`.

- [ ] **Step 1: Write the failing test**

```ts
// apps/server/test/bgg-snapshot.test.ts
import { describe, expect, it } from 'vitest';
import { pickLatest, snapshotDateFromName } from '../src/modules/bgg/snapshot.js';

describe('snapshot resolver', () => {
  it('extracts the date from a dump filename', () => {
    expect(snapshotDateFromName('2026-06-29T00-57-24.csv')).toBe('2026-06-29');
    expect(snapshotDateFromName('2016-10-12.csv')).toBe('2016-10-12');
    expect(snapshotDateFromName('README.md')).toBeNull();
  });

  it('picks the newest dated csv, ignoring non-matching files', () => {
    expect(
      pickLatest(['2016-10-12.csv', 'README.md', '2026-06-29T00-57-24.csv', '2026-06-28.csv']),
    ).toEqual({ name: '2026-06-29T00-57-24.csv', snapshotDate: '2026-06-29' });
  });

  it('returns null when there are no dated csvs', () => {
    expect(pickLatest(['README.md', 'LICENSE'])).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run apps/server/test/bgg-snapshot.test.ts`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Write the implementation**

```ts
// apps/server/src/modules/bgg/snapshot.ts
const DATED_CSV = /^(\d{4}-\d{2}-\d{2})(?:T[\d-]+)?\.csv$/;

/** `YYYY-MM-DD` from a dump filename, or null if it is not a dated csv. */
export function snapshotDateFromName(name: string): string | null {
  const m = DATED_CSV.exec(name);
  return m ? m[1] : null;
}

/** Newest dated csv by filename (lexical == chronological for ISO dates). */
export function pickLatest(names: string[]): { name: string; snapshotDate: string } | null {
  let best: { name: string; snapshotDate: string } | null = null;
  for (const name of names) {
    const snapshotDate = snapshotDateFromName(name);
    if (snapshotDate === null) continue;
    if (best === null || name > best.name) best = { name, snapshotDate };
  }
  return best;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run apps/server/test/bgg-snapshot.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/modules/bgg/snapshot.ts apps/server/test/bgg-snapshot.test.ts
git commit -m "feat(bgg): resolve newest dated snapshot filename"
```

---

## Task 5: Catalog service (DB ops)

**Files:**

- Create: `apps/server/src/modules/bgg/catalog-service.ts`
- Test: `apps/server/test/bgg-catalog.int.test.ts` (extend Task 2's file)

**Interfaces:**

- Consumes: `CatalogRow` (Task 3).
- Produces:
  - `replaceCatalog(rows: CatalogRow[], snapshotDate: string): Promise<number>` — deletes all, inserts rows stamped with `snapshotDate`, returns count.
  - `currentSnapshotDate(): Promise<string | null>` — max `snapshot_date` as `YYYY-MM-DD`.
  - `searchCatalog(q: string, limit: number): Promise<BggCatalogHitDto[]>`.
  - `getCatalogRatings(bggIds: number[]): Promise<{ bggId: number; rating: number | null; rank: number | null }[]>`.
  - `getCatalogEntries(bggIds: number[]): Promise<BggCatalogHitDto[]>`.

- [ ] **Step 1: Write the failing tests (append to `bgg-catalog.int.test.ts`)**

```ts
// apps/server/test/bgg-catalog.int.test.ts  — add these imports at the top
import {
  currentSnapshotDate,
  getCatalogRatings,
  replaceCatalog,
  searchCatalog,
} from '../src/modules/bgg/catalog-service.js';
import type { CatalogRow } from '../src/modules/bgg/csv.js';

// ...and add this describe block in the same file:
describe.skipIf(process.env.RUN_DB_TESTS !== '1')('catalog-service', () => {
  beforeEach(async () => {
    applyMigrations();
    await resetDb();
  });

  const rows: CatalogRow[] = [
    {
      bggId: 1,
      name: 'Ark Nova',
      year: 2021,
      rank: 2,
      average: 8.54,
      bayesAverage: 8.35,
      usersRated: 100,
      thumbnail: 't1',
    },
    {
      bggId: 2,
      name: 'Arkham Horror',
      year: 2016,
      rank: 50,
      average: 7.1,
      bayesAverage: 6.9,
      usersRated: 20,
      thumbnail: 't2',
    },
    {
      bggId: 3,
      name: 'Brass',
      year: 2018,
      rank: 1,
      average: 8.6,
      bayesAverage: 8.4,
      usersRated: 200,
      thumbnail: 't3',
    },
  ];

  it('replaces the catalog and reports the snapshot date', async () => {
    expect(await currentSnapshotDate()).toBeNull();
    const n = await replaceCatalog(rows, '2026-06-29');
    expect(n).toBe(3);
    expect(await currentSnapshotDate()).toBe('2026-06-29');

    // A second replace with fewer rows fully swaps the contents.
    await replaceCatalog([rows[0]], '2026-06-30');
    expect(await currentSnapshotDate()).toBe('2026-06-30');
    const all = await searchCatalog('a', 25);
    expect(all.map((h) => h.bggId)).toEqual([1]);
  });

  it('searches by name (rank order) and by numeric id', async () => {
    await replaceCatalog(rows, '2026-06-29');
    const byName = await searchCatalog('ark', 10);
    expect(byName.map((h) => h.bggId)).toEqual([1, 2]); // rank 2 before rank 50
    const byId = await searchCatalog('3', 10);
    expect(byId[0]).toMatchObject({ bggId: 3, name: 'Brass', average: 8.6 });
  });

  it('returns ratings for the sync provider', async () => {
    await replaceCatalog(rows, '2026-06-29');
    expect(await getCatalogRatings([3, 999])).toEqual([{ bggId: 3, rating: 8.6, rank: 1 }]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `RUN_DB_TESTS=1 DATABASE_URL=postgresql://tabletop:changeme@localhost:5432/tabletop npx vitest run apps/server/test/bgg-catalog.int.test.ts`
Expected: FAIL — cannot find module `catalog-service.js`.

- [ ] **Step 3: Write the implementation**

```ts
// apps/server/src/modules/bgg/catalog-service.ts
import type { BggCatalogHitDto } from '@tabletop/shared';
import type { Prisma } from '../../../generated/prisma/client.js';
import { prisma } from '../../db.js';
import type { CatalogRow } from './csv.js';

const CHUNK = 5000;

function toHit(row: {
  bggId: number;
  name: string;
  year: number | null;
  rank: number | null;
  average: Prisma.Decimal | null;
  bayesAverage: Prisma.Decimal | null;
  usersRated: number | null;
  thumbnail: string | null;
  snapshotDate: Date | null;
}): BggCatalogHitDto {
  return {
    bggId: row.bggId,
    name: row.name,
    year: row.year,
    rank: row.rank,
    average: row.average === null ? null : row.average.toNumber(),
    bayesAverage: row.bayesAverage === null ? null : row.bayesAverage.toNumber(),
    usersRated: row.usersRated,
    thumbnail: row.thumbnail,
    snapshotDate: row.snapshotDate ? row.snapshotDate.toISOString().slice(0, 10) : null,
  };
}

/** Delete-all + insert, transactionally, so removed games do not linger. */
export async function replaceCatalog(rows: CatalogRow[], snapshotDate: string): Promise<number> {
  const stamp = new Date(`${snapshotDate}T00:00:00.000Z`);
  const data = rows.map((r) => ({ ...r, snapshotDate: stamp }));
  await prisma.$transaction([
    prisma.bggCatalogEntry.deleteMany({}),
    ...chunk(data, CHUNK).map((batch) =>
      prisma.bggCatalogEntry.createMany({ data: batch, skipDuplicates: true }),
    ),
  ]);
  return data.length;
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** The date of the loaded snapshot, or null when the catalog is empty. */
export async function currentSnapshotDate(): Promise<string | null> {
  const agg = await prisma.bggCatalogEntry.aggregate({ _max: { snapshotDate: true } });
  const d = agg._max.snapshotDate;
  return d ? d.toISOString().slice(0, 10) : null;
}

/** Numeric query → id match; otherwise case-insensitive name contains, rank first. */
export async function searchCatalog(q: string, limit: number): Promise<BggCatalogHitDto[]> {
  const where: Prisma.BggCatalogEntryWhereInput = /^\d+$/.test(q)
    ? { OR: [{ bggId: Number(q) }, { name: { contains: q, mode: 'insensitive' } }] }
    : { name: { contains: q, mode: 'insensitive' } };
  const rows = await prisma.bggCatalogEntry.findMany({
    where,
    orderBy: [{ rank: { sort: 'asc', nulls: 'last' } }, { name: 'asc' }],
    take: limit,
  });
  return rows.map(toHit);
}

export async function getCatalogEntries(bggIds: number[]): Promise<BggCatalogHitDto[]> {
  if (bggIds.length === 0) return [];
  const rows = await prisma.bggCatalogEntry.findMany({ where: { bggId: { in: bggIds } } });
  return rows.map(toHit);
}

/** Shape the sync provider needs: { bggId, rating, rank }. */
export async function getCatalogRatings(
  bggIds: number[],
): Promise<{ bggId: number; rating: number | null; rank: number | null }[]> {
  const entries = await getCatalogEntries(bggIds);
  return entries.map((e) => ({ bggId: e.bggId, rating: e.average, rank: e.rank }));
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `RUN_DB_TESTS=1 DATABASE_URL=postgresql://tabletop:changeme@localhost:5432/tabletop npx vitest run apps/server/test/bgg-catalog.int.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/modules/bgg/catalog-service.ts apps/server/test/bgg-catalog.int.test.ts
git commit -m "feat(bgg): catalog service — replace, search, ratings"
```

---

## Task 6: Catalog source + refresh orchestrator (network)

**Files:**

- Create: `apps/server/src/modules/bgg/catalog-source.ts`
- Test: `apps/server/test/bgg-source.test.ts`

**Interfaces:**

- Consumes: `pickLatest` (Task 4), `parseCatalogCsv` (Task 3), `replaceCatalog`/`currentSnapshotDate` (Task 5).
- Produces:
  - `interface SnapshotSource { listNames(): Promise<string[]>; download(name: string): Promise<string> }`
  - `githubSource(repo: string, fetchImpl?): SnapshotSource`
  - `refreshCatalog(opts: { source: SnapshotSource; force?: boolean }): Promise<BggCatalogRefreshResultDto>` — skip-if-unchanged, else download + `replaceCatalog`.

- [ ] **Step 1: Write the failing test (source + skip logic, no real network)**

```ts
// apps/server/test/bgg-source.test.ts
import { describe, expect, it, vi } from 'vitest';
import { refreshCatalog, type SnapshotSource } from '../src/modules/bgg/catalog-source.js';
import * as service from '../src/modules/bgg/catalog-service.js';

const CSV =
  'ID,Name,Year,Rank,Average,Bayes average,Users rated,URL,Thumbnail\n1,Ark Nova,2021,2,8.54,8.35,100,/bg/1,t1';

function fakeSource(names: string[], csv = CSV): SnapshotSource {
  return { listNames: () => Promise.resolve(names), download: () => Promise.resolve(csv) };
}

describe('refreshCatalog', () => {
  it('downloads and replaces when the snapshot is newer', async () => {
    vi.spyOn(service, 'currentSnapshotDate').mockResolvedValue('2026-06-28');
    const replace = vi.spyOn(service, 'replaceCatalog').mockResolvedValue(1);
    const result = await refreshCatalog({ source: fakeSource(['2026-06-29.csv']) });
    expect(replace).toHaveBeenCalledOnce();
    expect(result).toEqual({ status: 'refreshed', snapshotDate: '2026-06-29', count: 1 });
  });

  it('skips download + replace when the snapshot is unchanged', async () => {
    vi.spyOn(service, 'currentSnapshotDate').mockResolvedValue('2026-06-29');
    const replace = vi.spyOn(service, 'replaceCatalog').mockResolvedValue(0);
    const source = fakeSource(['2026-06-29.csv']);
    const dl = vi.spyOn(source, 'download');
    const result = await refreshCatalog({ source });
    expect(dl).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
    expect(result).toEqual({ status: 'unchanged', snapshotDate: '2026-06-29', count: 0 });
  });

  it('force refreshes even when unchanged', async () => {
    vi.spyOn(service, 'currentSnapshotDate').mockResolvedValue('2026-06-29');
    const replace = vi.spyOn(service, 'replaceCatalog').mockResolvedValue(1);
    const result = await refreshCatalog({ source: fakeSource(['2026-06-29.csv']), force: true });
    expect(replace).toHaveBeenCalledOnce();
    expect(result.status).toBe('refreshed');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run apps/server/test/bgg-source.test.ts`
Expected: FAIL — cannot find module `catalog-source.js`.

- [ ] **Step 3: Write the implementation**

```ts
// apps/server/src/modules/bgg/catalog-source.ts
import type { BggCatalogRefreshResultDto } from '@tabletop/shared';
import { parseCatalogCsv } from './csv.js';
import { pickLatest } from './snapshot.js';
import { currentSnapshotDate, replaceCatalog } from './catalog-service.js';

export interface SnapshotSource {
  /** All file names available in the mirror. */
  listNames(): Promise<string[]>;
  /** Raw CSV text for one file name. */
  download(name: string): Promise<string>;
}

type FetchLike = typeof fetch;

/** GitHub-backed mirror source. Uses the git trees API to list in one call. */
export function githubSource(repo: string, fetchImpl: FetchLike = fetch): SnapshotSource {
  const ua = { 'User-Agent': 'tabletop-app' };
  return {
    async listNames() {
      const res = await fetchImpl(
        `https://api.github.com/repos/${repo}/git/trees/master?recursive=0`,
        { headers: ua },
      );
      if (!res.ok) throw new Error(`GitHub tree list failed: ${res.status}`);
      const body = (await res.json()) as { tree?: { path: string; type: string }[] };
      return (body.tree ?? []).filter((e) => e.type === 'blob').map((e) => e.path);
    },
    async download(name) {
      const res = await fetchImpl(
        `https://raw.githubusercontent.com/${repo}/master/${encodeURIComponent(name)}`,
        { headers: ua },
      );
      if (!res.ok) throw new Error(`Download ${name} failed: ${res.status}`);
      return res.text();
    },
  };
}

/**
 * Resolve the newest snapshot; if it matches the loaded one (and not forced),
 * no-op without downloading. Otherwise download + transactionally replace.
 */
export async function refreshCatalog(opts: {
  source: SnapshotSource;
  force?: boolean;
}): Promise<BggCatalogRefreshResultDto> {
  const names = await opts.source.listNames();
  const latest = pickLatest(names);
  if (latest === null) throw new Error('No dated CSV snapshots found in mirror');

  const current = await currentSnapshotDate();
  if (!opts.force && current === latest.snapshotDate) {
    return { status: 'unchanged', snapshotDate: current, count: 0 };
  }

  const csv = await opts.source.download(latest.name);
  const count = await replaceCatalog(parseCatalogCsv(csv), latest.snapshotDate);
  return { status: 'refreshed', snapshotDate: latest.snapshotDate, count };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run apps/server/test/bgg-source.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/modules/bgg/catalog-source.ts apps/server/test/bgg-source.test.ts
git commit -m "feat(bgg): mirror source + skip-if-unchanged refresh orchestrator"
```

---

## Task 7: CLI to load a local file or download

**Files:**

- Create: `apps/server/src/modules/bgg/catalog-cli.ts`
- Modify: `package.json` (root scripts)

**Interfaces:**

- Consumes: `parseCatalogCsv`, `replaceCatalog`, `githubSource`, `refreshCatalog`, `snapshotDateFromName`.
- Produces: `runCatalogRefresh(argv: string[], deps): Promise<BggCatalogRefreshResultDto>` (exported for a smoke test) + a `main()` guard.

- [ ] **Step 1: Write the failing test**

```ts
// apps/server/test/bgg-source.test.ts  — append
import { runCatalogRefresh } from '../src/modules/bgg/catalog-cli.js';

describe('runCatalogRefresh (CLI arg handling)', () => {
  it('routes --file to a local-file replace using the filename date', async () => {
    const replace = vi.fn().mockResolvedValue(1);
    const result = await runCatalogRefresh(['--file', '/tmp/2026-06-29T00-57-24.csv'], {
      readFile: () =>
        Promise.resolve(
          'ID,Name,Year,Rank,Average,Bayes average,Users rated,URL,Thumbnail\n1,X,2020,5,7,6,9,/bg/1,t',
        ),
      replace,
      refresh: vi.fn(),
    });
    expect(replace).toHaveBeenCalledWith(expect.any(Array), '2026-06-29');
    expect(result).toEqual({ status: 'refreshed', snapshotDate: '2026-06-29', count: 1 });
  });

  it('routes no --file to a network refresh', async () => {
    const refresh = vi
      .fn()
      .mockResolvedValue({ status: 'unchanged', snapshotDate: '2026-06-29', count: 0 });
    const result = await runCatalogRefresh([], { readFile: vi.fn(), replace: vi.fn(), refresh });
    expect(refresh).toHaveBeenCalledOnce();
    expect(result.status).toBe('unchanged');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run apps/server/test/bgg-source.test.ts`
Expected: FAIL — cannot find module `catalog-cli.js`.

- [ ] **Step 3: Write the implementation**

```ts
// apps/server/src/modules/bgg/catalog-cli.ts
import { readFile as fsReadFile } from 'node:fs/promises';
import path from 'node:path';
import type { BggCatalogRefreshResultDto } from '@tabletop/shared';
import { loadConfig } from '../../config.js';
import { parseCatalogCsv } from './csv.js';
import { snapshotDateFromName } from './snapshot.js';
import { replaceCatalog } from './catalog-service.js';
import { githubSource, refreshCatalog } from './catalog-source.js';

export interface CliDeps {
  readFile: (p: string) => Promise<string>;
  replace: typeof replaceCatalog;
  refresh: (opts: { force?: boolean }) => Promise<BggCatalogRefreshResultDto>;
}

/** `--file <path>` loads a local CSV; otherwise downloads the newest snapshot. */
export async function runCatalogRefresh(
  argv: string[],
  deps: CliDeps,
): Promise<BggCatalogRefreshResultDto> {
  const fileIdx = argv.indexOf('--file');
  const force = argv.includes('--force');
  if (fileIdx !== -1) {
    const filePath = argv[fileIdx + 1];
    const snapshotDate = snapshotDateFromName(path.basename(filePath ?? ''));
    if (!filePath || snapshotDate === null) {
      throw new Error('--file requires a path named YYYY-MM-DD(...).csv');
    }
    const rows = parseCatalogCsv(await deps.readFile(filePath));
    const count = await deps.replace(rows, snapshotDate);
    return { status: 'refreshed', snapshotDate, count };
  }
  return deps.refresh({ force });
}

/* c8 ignore start — process entrypoint */
async function main(): Promise<void> {
  const config = loadConfig();
  const result = await runCatalogRefresh(process.argv.slice(2), {
    readFile: (p) => fsReadFile(p, 'utf8'),
    replace: replaceCatalog,
    refresh: ({ force }) =>
      refreshCatalog({ source: githubSource(config.BGG_CATALOG_REPO), force }),
  });
  // eslint-disable-next-line no-console
  console.log(`bgg catalog: ${result.status} (${result.count} rows, ${result.snapshotDate})`);
  process.exit(0);
}

if (process.argv[1] && process.argv[1].endsWith('catalog-cli.ts')) {
  void main();
}
/* c8 ignore stop */
```

Add the root script:

```jsonc
// package.json  — in "scripts", after "prisma:seed"
"bgg:catalog:refresh": "tsx apps/server/src/modules/bgg/catalog-cli.ts",
```

> Note: `main()` references `config.BGG_CATALOG_REPO`, added in Task 9. If executing tasks strictly in order, this file typechecks only after Task 9; keep the commit but run the full `npm run typecheck` at Task 9. The exported `runCatalogRefresh` (what the test covers) does not depend on config.

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run apps/server/test/bgg-source.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/modules/bgg/catalog-cli.ts package.json
git commit -m "feat(bgg): catalog refresh CLI (local file or download)"
```

---

## Task 8: Search endpoint + router

**Files:**

- Create: `apps/server/src/modules/bgg/catalog-routes.ts`
- Modify: `apps/server/src/app.ts`
- Test: `apps/server/test/bgg-catalog.int.test.ts` (extend)

**Interfaces:**

- Consumes: `searchCatalog`, `getCatalogEntries` (Task 5); `TokenService`; `requireAuth`.
- Produces: `createBggCatalogRouter(deps: { tokens: TokenService; defaultCurrency: string }): Router` mounted at `/api/bgg`, exposing `GET /catalog/search`. (Import endpoint added in Task 10.)

- [ ] **Step 1: Write the failing test (append an authed describe using the app)**

```ts
// apps/server/test/bgg-catalog.int.test.ts  — add at top
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../src/app.js';
import { tokenServiceFromConfig } from '../src/modules/auth/routes.js';

const tokens = tokenServiceFromConfig({
  JWT_SECRET: 'access-secret-access-secret-1234567890',
  JWT_REFRESH_SECRET: 'refresh-secret-refresh-secret-1234567890',
});

// add this describe block:
describe.skipIf(process.env.RUN_DB_TESTS !== '1')('GET /api/bgg/catalog/search', () => {
  let app: Express;
  let token: string;
  beforeEach(async () => {
    applyMigrations();
    await resetDb();
    app = createApp({ tokens, defaultLocale: 'en', defaultCurrency: 'NOK' });
    await request(app)
      .post('/api/auth/register')
      .send({ username: 'maya', password: 'supersecret' });
    const login = await request(app)
      .post('/api/auth/login')
      .send({ username: 'maya', password: 'supersecret' });
    token = login.body.accessToken;
    await replaceCatalog(
      [
        {
          bggId: 1,
          name: 'Ark Nova',
          year: 2021,
          rank: 2,
          average: 8.54,
          bayesAverage: 8.35,
          usersRated: 100,
          thumbnail: 't1',
        },
      ],
      '2026-06-29',
    );
  });

  it('requires auth', async () => {
    await request(app).get('/api/bgg/catalog/search?q=ark').expect(401);
  });

  it('returns hits with every field', async () => {
    const res = await request(app)
      .get('/api/bgg/catalog/search?q=ark')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body[0]).toMatchObject({
      bggId: 1,
      name: 'Ark Nova',
      average: 8.54,
      thumbnail: 't1',
    });
  });

  it('rejects an empty query', async () => {
    await request(app)
      .get('/api/bgg/catalog/search?q=')
      .set('Authorization', `Bearer ${token}`)
      .expect(400);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `RUN_DB_TESTS=1 DATABASE_URL=postgresql://tabletop:changeme@localhost:5432/tabletop npx vitest run apps/server/test/bgg-catalog.int.test.ts`
Expected: FAIL — 404 on `/api/bgg/catalog/search` (router not mounted).

- [ ] **Step 3: Write the router**

```ts
// apps/server/src/modules/bgg/catalog-routes.ts
import { Router } from 'express';
import { bggCatalogSearchQuerySchema } from '@tabletop/shared';
import { requireAuth } from '../../middleware/auth.js';
import type { TokenService } from '../auth/service.js';
import { searchCatalog } from './catalog-service.js';

export interface BggCatalogDeps {
  tokens: TokenService;
  defaultCurrency: string;
}

/** Catalog routes mounted at /api/bgg. All require an authenticated member. */
export function createBggCatalogRouter(deps: BggCatalogDeps): Router {
  const router = Router();
  router.use(requireAuth(deps.tokens));

  router.get('/catalog/search', (req, res, next) => {
    void (async () => {
      const { q, limit } = bggCatalogSearchQuerySchema.parse(req.query);
      res.json(await searchCatalog(q, limit));
    })().catch(next);
  });

  return router;
}
```

Mount it in `app.ts` (near the games router mount):

```ts
// apps/server/src/app.ts
import { createBggCatalogRouter } from './modules/bgg/catalog-routes.js';
// ...inside createApp, where feature routers mount (deps present):
app.use(
  '/api/bgg',
  createBggCatalogRouter({ tokens: deps.tokens, defaultCurrency: deps.defaultCurrency }),
);
```

- [ ] **Step 4: Run to verify it passes**

Run: `RUN_DB_TESTS=1 DATABASE_URL=postgresql://tabletop:changeme@localhost:5432/tabletop npx vitest run apps/server/test/bgg-catalog.int.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/modules/bgg/catalog-routes.ts apps/server/src/app.ts apps/server/test/bgg-catalog.int.test.ts
git commit -m "feat(bgg): catalog search endpoint"
```

---

## Task 9: Config vars for catalog source

**Files:**

- Modify: `apps/server/src/config.ts`
- Test: `apps/server/test/config.test.ts` (create if absent, else extend)

**Interfaces:**

- Produces: `Config.BGG_CATALOG_REPO: string` (default `beefsack/bgg-ranking-historicals`), `Config.BGG_CATALOG_REFRESH_ENABLED: boolean` (default false).

- [ ] **Step 1: Write the failing test**

```ts
// apps/server/test/config.test.ts
import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config.js';

const base = {
  DB_USER: 'u',
  DB_PASSWORD: 'p',
  JWT_SECRET: 'x'.repeat(32),
  JWT_REFRESH_SECRET: 'y'.repeat(32),
};

describe('BGG catalog config', () => {
  it('defaults the mirror repo and refresh flag', () => {
    const c = loadConfig(base);
    expect(c.BGG_CATALOG_REPO).toBe('beefsack/bgg-ranking-historicals');
    expect(c.BGG_CATALOG_REFRESH_ENABLED).toBe(false);
  });

  it('reads overrides', () => {
    const c = loadConfig({ ...base, BGG_CATALOG_REFRESH_ENABLED: 'true' });
    expect(c.BGG_CATALOG_REFRESH_ENABLED).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run apps/server/test/config.test.ts`
Expected: FAIL — `BGG_CATALOG_REPO` is undefined.

- [ ] **Step 3: Add the fields**

```ts
// apps/server/src/config.ts  — in envSchema, after BGG_API_TOKEN
  BGG_CATALOG_REPO: z.string().default('beefsack/bgg-ranking-historicals'),
  BGG_CATALOG_REFRESH_ENABLED: booleanFromString.default(false),
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run apps/server/test/config.test.ts`
Expected: PASS. Then `npm run typecheck` (this is where `catalog-cli.ts`'s `config.BGG_CATALOG_REPO` reference resolves).

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/config.ts apps/server/test/config.test.ts
git commit -m "feat(config): BGG catalog repo + refresh flag"
```

---

## Task 10: Bulk-import endpoint

**Files:**

- Create: `apps/server/src/modules/bgg/import-service.ts`
- Modify: `apps/server/src/modules/bgg/catalog-routes.ts`
- Test: `apps/server/test/bgg-catalog.int.test.ts` (extend)

**Interfaces:**

- Consumes: `getCatalogEntries` (Task 5); `bggImportSchema`, `BggImportResultDto`.
- Produces: `importGames(input: BggImportInput, defaultCurrency: string): Promise<BggImportResultDto>` and `POST /api/bgg/catalog/import`.

- [ ] **Step 1: Write the failing test (append to the authed describe from Task 8)**

```ts
// apps/server/test/bgg-catalog.int.test.ts  — new describe
describe.skipIf(process.env.RUN_DB_TESTS !== '1')('POST /api/bgg/catalog/import', () => {
  let app: Express;
  let token: string;
  beforeEach(async () => {
    applyMigrations();
    await resetDb();
    app = createApp({ tokens, defaultLocale: 'en', defaultCurrency: 'NOK' });
    await request(app)
      .post('/api/auth/register')
      .send({ username: 'maya', password: 'supersecret' });
    token = (
      await request(app).post('/api/auth/login').send({ username: 'maya', password: 'supersecret' })
    ).body.accessToken;
    await replaceCatalog(
      [
        {
          bggId: 1,
          name: 'Ark Nova',
          year: 2021,
          rank: 2,
          average: 8.54,
          bayesAverage: 8.35,
          usersRated: 100,
          thumbnail: 'https://x/t1.jpg',
        },
        {
          bggId: 2,
          name: 'Brass',
          year: 2018,
          rank: 1,
          average: 8.6,
          bayesAverage: 8.4,
          usersRated: 200,
          thumbnail: 'https://x/t2.jpg',
        },
      ],
      '2026-06-29',
    );
  });

  it('creates games from catalog rows and maps fields', async () => {
    const res = await request(app)
      .post('/api/bgg/catalog/import')
      .set('Authorization', `Bearer ${token}`)
      .send({ bggIds: [1, 2], collectionStatus: 'WISHLIST' })
      .expect(201);
    expect(res.body).toEqual({ created: 2, skipped: 0 });
    const list = await request(app).get('/api/games?q=Ark').set('Authorization', `Bearer ${token}`);
    expect(list.body.items[0]).toMatchObject({
      title: 'Ark Nova',
      releaseYear: 2021,
      bggId: 1,
      bggRating: 8.54,
      bggRank: 2,
      imagePath: 'https://x/t1.jpg',
      collectionStatus: 'WISHLIST',
    });
  });

  it('skips ids already in the collection or absent from the catalog', async () => {
    await request(app)
      .post('/api/bgg/catalog/import')
      .set('Authorization', `Bearer ${token}`)
      .send({ bggIds: [1] })
      .expect(201);
    const res = await request(app)
      .post('/api/bgg/catalog/import')
      .set('Authorization', `Bearer ${token}`)
      .send({ bggIds: [1, 2, 999] })
      .expect(201);
    expect(res.body).toEqual({ created: 1, skipped: 2 });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `RUN_DB_TESTS=1 DATABASE_URL=postgresql://tabletop:changeme@localhost:5432/tabletop npx vitest run apps/server/test/bgg-catalog.int.test.ts`
Expected: FAIL — 404 on `/api/bgg/catalog/import`.

- [ ] **Step 3: Write the service**

```ts
// apps/server/src/modules/bgg/import-service.ts
import type { BggImportInput, BggImportResultDto } from '@tabletop/shared';
import { prisma } from '../../db.js';
import { getCatalogEntries } from './catalog-service.js';

/** Create a Game per catalog id, skipping ids already owned or not in the catalog. */
export async function importGames(
  input: BggImportInput,
  defaultCurrency: string,
): Promise<BggImportResultDto> {
  const entries = await getCatalogEntries(input.bggIds);
  const existing = await prisma.game.findMany({
    where: { bggId: { in: input.bggIds } },
    select: { bggId: true },
  });
  const owned = new Set(existing.map((g) => g.bggId));

  let created = 0;
  for (const e of entries) {
    if (owned.has(e.bggId)) continue;
    await prisma.game.create({
      data: {
        title: e.name,
        releaseYear: e.year ?? undefined,
        imagePath: e.thumbnail ?? undefined,
        bggId: e.bggId,
        bggRating: e.average ?? undefined,
        bggRank: e.rank ?? undefined,
        currency: defaultCurrency,
        collectionStatus: input.collectionStatus ?? undefined,
      },
    });
    created += 1;
  }
  return { created, skipped: input.bggIds.length - created };
}
```

- [ ] **Step 4: Add the route**

```ts
// apps/server/src/modules/bgg/catalog-routes.ts  — add imports + route
import { bggCatalogSearchQuerySchema, bggImportSchema } from '@tabletop/shared';
import { importGames } from './import-service.js';

// inside createBggCatalogRouter, after the search route:
router.post('/catalog/import', (req, res, next) => {
  void (async () => {
    const input = bggImportSchema.parse(req.body);
    res.status(201).json(await importGames(input, deps.defaultCurrency));
  })().catch(next);
});
```

- [ ] **Step 5: Run to verify it passes**

Run: `RUN_DB_TESTS=1 DATABASE_URL=postgresql://tabletop:changeme@localhost:5432/tabletop npx vitest run apps/server/test/bgg-catalog.int.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/server/src/modules/bgg/import-service.ts apps/server/src/modules/bgg/catalog-routes.ts apps/server/test/bgg-catalog.int.test.ts
git commit -m "feat(bgg): bulk-import games from catalog"
```

---

## Task 11: Wire `CsvDumpProvider` to the catalog + admin refresh route

**Files:**

- Modify: `apps/server/src/modules/bgg/provider.ts`
- Modify: `apps/server/src/modules/bgg/catalog-routes.ts`
- Modify: `apps/server/src/app.ts`, `apps/server/src/server.ts`
- Test: `apps/server/test/bgg.int.test.ts` (extend existing sync test)

**Interfaces:**

- Consumes: `getCatalogRatings` (Task 5); `githubSource`/`refreshCatalog` (Task 6); admin guard `requireRole('ADMIN')`.
- Produces: `CsvDumpProvider.fetchRatings` reads the catalog; `POST /api/bgg/catalog/refresh` (admin).

- [ ] **Step 1: Write the failing test (extend `bgg.int.test.ts`)**

```ts
// apps/server/test/bgg.int.test.ts  — add a test in the existing describe
import { replaceCatalog } from '../src/modules/bgg/catalog-service.js';

it('sync updates bgg_rating/bgg_rank from the catalog when enabled', async () => {
  // create a game with a bggId
  const game = await request(app)
    .post('/api/games')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ title: 'Ark Nova', bggId: 1 })
    .expect(201);
  await replaceCatalog(
    [
      {
        bggId: 1,
        name: 'Ark Nova',
        year: 2021,
        rank: 2,
        average: 8.54,
        bayesAverage: 8.35,
        usersRated: 100,
        thumbnail: 't',
      },
    ],
    '2026-06-29',
  );
  const enabledApp = createApp({
    tokens,
    defaultLocale: 'en',
    defaultCurrency: 'NOK',
    bgg: { enabled: true, provider: 'csv', apiToken: undefined },
  });
  await request(enabledApp)
    .post('/api/sync/bgg')
    .set('Authorization', `Bearer ${adminToken}`)
    .expect(200);
  const fetched = await request(app)
    .get(`/api/games/${game.body.id}`)
    .set('Authorization', `Bearer ${adminToken}`);
  expect(fetched.body.bggRating).toBe(8.54);
  expect(fetched.body.bggRank).toBe(2);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `RUN_DB_TESTS=1 DATABASE_URL=postgresql://tabletop:changeme@localhost:5432/tabletop npx vitest run apps/server/test/bgg.int.test.ts`
Expected: FAIL — `bggRating` stays null (provider still returns `[]`).

- [ ] **Step 3: Implement the provider read**

```ts
// apps/server/src/modules/bgg/provider.ts  — replace CsvDumpProvider.fetchRatings body
import { getCatalogRatings } from './catalog-service.js';
// ...
export class CsvDumpProvider implements BggRatingProvider {
  async fetchRatings(bggIds: number[]): Promise<BggRating[]> {
    const ratings = await getCatalogRatings(bggIds);
    return ratings.map((r) => ({ bggId: r.bggId, rating: r.rating, rank: r.rank }));
  }
}
```

- [ ] **Step 4: Add the admin refresh route**

```ts
// apps/server/src/modules/bgg/catalog-routes.ts  — add imports, deps, route
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { githubSource, refreshCatalog } from './catalog-source.js';

// extend BggCatalogDeps:
export interface BggCatalogDeps {
  tokens: TokenService;
  defaultCurrency: string;
  catalogRepo: string;
}

// inside createBggCatalogRouter, after import route:
router.post('/catalog/refresh', requireRole('ADMIN'), (req, res, next) => {
  void (async () => {
    const force = req.query.force === 'true';
    res.json(await refreshCatalog({ source: githubSource(deps.catalogRepo), force }));
  })().catch(next);
});
```

Update the mount in `app.ts` to pass `catalogRepo` (read from a new optional dep):

```ts
// apps/server/src/app.ts  — extend Deps and the mount
//   in the deps interface, add:  catalogRepo?: string;
app.use(
  '/api/bgg',
  createBggCatalogRouter({
    tokens: deps.tokens,
    defaultCurrency: deps.defaultCurrency,
    catalogRepo: deps.catalogRepo ?? 'beefsack/bgg-ranking-historicals',
  }),
);
```

Pass it from the entrypoint:

```ts
// apps/server/src/server.ts  — where createApp({...}) is called, add:
  catalogRepo: config.BGG_CATALOG_REPO,
```

- [ ] **Step 5: Run to verify it passes**

Run: `RUN_DB_TESTS=1 DATABASE_URL=postgresql://tabletop:changeme@localhost:5432/tabletop npx vitest run apps/server/test/bgg.int.test.ts`
Expected: PASS. Then `npm run typecheck`.

- [ ] **Step 6: Commit**

```bash
git add apps/server/src/modules/bgg/provider.ts apps/server/src/modules/bgg/catalog-routes.ts apps/server/src/app.ts apps/server/src/server.ts apps/server/test/bgg.int.test.ts
git commit -m "feat(bgg): read ratings from catalog + admin refresh route"
```

---

## Task 12: Client — catalog API hooks + autofill mapping (pure)

**Files:**

- Create: `apps/client/src/lib/bgg-api.ts`
- Create: `apps/client/src/lib/bgg-autofill.ts`
- Test: `apps/client/src/lib/bgg-autofill.test.ts`

**Interfaces:**

- Consumes: `BggCatalogHitDto`, `apiFetch`, TanStack Query.
- Produces: `useBggCatalogSearch(q: string)`, `useBggImport()`; `hitToFormPatch(hit: BggCatalogHitDto): { title: string; releaseYear: string; bggId: number; imagePath: string | null }`.

- [ ] **Step 1: Write the failing test**

```ts
// apps/client/src/lib/bgg-autofill.test.ts
import { describe, expect, it } from 'vitest';
import { hitToFormPatch } from './bgg-autofill.js';

describe('hitToFormPatch', () => {
  it('maps a catalog hit to the form fields it can fill', () => {
    expect(
      hitToFormPatch({
        bggId: 1,
        name: 'Ark Nova',
        year: 2021,
        rank: 2,
        average: 8.54,
        bayesAverage: 8.35,
        usersRated: 100,
        thumbnail: 'https://x/t.jpg',
        snapshotDate: '2026-06-29',
      }),
    ).toEqual({ title: 'Ark Nova', releaseYear: '2021', bggId: 1, imagePath: 'https://x/t.jpg' });
  });

  it('tolerates null year and thumbnail', () => {
    const patch = hitToFormPatch({
      bggId: 5,
      name: 'X',
      year: null,
      rank: null,
      average: null,
      bayesAverage: null,
      usersRated: null,
      thumbnail: null,
      snapshotDate: null,
    });
    expect(patch).toEqual({ title: 'X', releaseYear: '', bggId: 5, imagePath: null });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run apps/client/src/lib/bgg-autofill.test.ts`
Expected: FAIL — cannot find module `./bgg-autofill.js`.

- [ ] **Step 3: Write the implementation**

```ts
// apps/client/src/lib/bgg-autofill.ts
import type { BggCatalogHitDto } from '@tabletop/shared';

/** The subset of the add-game form that a catalog hit can populate. */
export interface AutofillPatch {
  title: string;
  releaseYear: string;
  bggId: number;
  imagePath: string | null;
}

export function hitToFormPatch(hit: BggCatalogHitDto): AutofillPatch {
  return {
    title: hit.name,
    releaseYear: hit.year === null ? '' : String(hit.year),
    bggId: hit.bggId,
    imagePath: hit.thumbnail,
  };
}
```

```ts
// apps/client/src/lib/bgg-api.ts
import { useMutation, useQuery } from '@tanstack/react-query';
import type { BggCatalogHitDto, BggImportInput, BggImportResultDto } from '@tabletop/shared';
import { apiFetch } from './api.js';

/** Debounced-by-caller search over the local BGG catalog. Disabled for blank q. */
export function useBggCatalogSearch(q: string) {
  return useQuery({
    queryKey: ['bgg-catalog', q],
    enabled: q.trim().length > 0,
    queryFn: () =>
      apiFetch<BggCatalogHitDto[]>(`/api/bgg/catalog/search?q=${encodeURIComponent(q)}`),
  });
}

export function useBggImport() {
  return useMutation({
    mutationFn: (input: BggImportInput) =>
      apiFetch<BggImportResultDto>('/api/bgg/catalog/import', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
  });
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run apps/client/src/lib/bgg-autofill.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/client/src/lib/bgg-api.ts apps/client/src/lib/bgg-autofill.ts apps/client/src/lib/bgg-autofill.test.ts
git commit -m "feat(client): BGG catalog hooks + autofill mapping"
```

---

## Task 13: Client — autofill typeahead in the add-game modal

**Files:**

- Modify: `apps/client/src/components/GameFormModal.tsx`
- Modify: `apps/client/src/lib/strings/en.ts`, `apps/client/src/lib/strings/nb.ts`
- Test: manual (verify build/typecheck); logic already covered by Task 12.

**Interfaces:**

- Consumes: `useBggCatalogSearch`, `hitToFormPatch`, `bggUrl`.

- [ ] **Step 1: Add strings (both locales, same keys)**

```ts
// apps/client/src/lib/strings/en.ts  — inside the gameForm object
    bggSearch: 'Search BoardGameGeek',
    bggSearchPlaceholder: 'Type a game name or BGG ID…',
    bggViewOnBgg: 'View on BGG',
    bggNoResults: 'No matches',
```

```ts
// apps/client/src/lib/strings/nb.ts  — inside the gameForm object
    bggSearch: 'Søk på BoardGameGeek',
    bggSearchPlaceholder: 'Skriv spillnavn eller BGG-ID…',
    bggViewOnBgg: 'Vis på BGG',
    bggNoResults: 'Ingen treff',
```

- [ ] **Step 2: Extend the form state + add the search UI**

Add `bggId` and `imagePath` to `FormState`, seed them in `initialState`, include them in the `payload`, and render a search box above the Title field. Full changes:

```tsx
// apps/client/src/components/GameFormModal.tsx

// 1) imports (add):
import { useState, type FormEvent } from 'react';
import { useBggCatalogSearch, hitToFormPatch } from '../lib/bgg-api.js'; // hitToFormPatch re-exported below
import { bggUrl, type BggCatalogHitDto } from '@tabletop/shared';

// (re-export helper to keep one import site)
// in apps/client/src/lib/bgg-api.ts add:  export { hitToFormPatch } from './bgg-autofill.js';

// 2) FormState: add these two fields
interface FormState {
  // ...existing fields...
  bggId: string;
  imagePath: string;
}

// 3) initialState: add
    bggId: game?.bggId?.toString() ?? '',
    imagePath: game?.imagePath ?? '',

// 4) payload (in onSubmit): add
      bggId: num(form.bggId),
      imagePath: form.imagePath.trim() || undefined,

// 5) component body: add search state + handler (near other hooks)
  const [bggQuery, setBggQuery] = useState('');
  const { data: hits = [] } = useBggCatalogSearch(bggQuery);
  function applyHit(hit: BggCatalogHitDto): void {
    const patch = hitToFormPatch(hit);
    setForm((f) => ({
      ...f,
      title: patch.title,
      releaseYear: patch.releaseYear,
      bggId: String(patch.bggId),
      imagePath: patch.imagePath ?? '',
    }));
    setBggQuery('');
  }

  // 6) render, as the first child inside <form ...> (before the Title Field):
  {!editing && (
    <Field label={t.gameForm.bggSearch}>
      <input
        aria-label={t.gameForm.bggSearch}
        value={bggQuery}
        onChange={(e) => setBggQuery(e.target.value)}
        placeholder={t.gameForm.bggSearchPlaceholder}
        className={inputClass}
      />
      {bggQuery.trim() !== '' && (
        <ul className="mt-1 max-h-56 overflow-y-auto rounded-lg border border-border bg-card">
          {hits.length === 0 && (
            <li className="px-3 py-2 text-[12px] text-muted2">{t.gameForm.bggNoResults}</li>
          )}
          {hits.map((hit) => (
            <li key={hit.bggId} className="flex items-center gap-2 px-2 py-1.5">
              <button
                type="button"
                onClick={() => applyHit(hit)}
                className="flex flex-1 items-center gap-2 text-left"
              >
                {hit.thumbnail && (
                  <img src={hit.thumbnail} alt="" className="h-8 w-8 rounded object-cover" />
                )}
                <span className="text-[13px]">
                  {hit.name}
                  {hit.year ? ` (${hit.year})` : ''}
                  {hit.rank ? ` · #${hit.rank}` : ''}
                </span>
              </button>
              <a
                href={bggUrl(hit.bggId)}
                target="_blank"
                rel="noreferrer"
                className="text-[11px] font-semibold text-accent-text"
              >
                {t.gameForm.bggViewOnBgg} ↗
              </a>
            </li>
          ))}
        </ul>
      )}
    </Field>
  )}
```

- [ ] **Step 3: Typecheck + lint**

Run: `npm run typecheck --workspace @tabletop/client && npm run lint`
Expected: no errors, zero warnings.

- [ ] **Step 4: Commit**

```bash
git add apps/client/src/components/GameFormModal.tsx apps/client/src/lib/bgg-api.ts apps/client/src/lib/strings/en.ts apps/client/src/lib/strings/nb.ts
git commit -m "feat(client): BGG autofill typeahead in add-game modal"
```

---

## Task 14: Client — BGG link on game detail + Browse-BGG import screen

**Files:**

- Modify: `apps/client/src/pages/GameDetail.tsx`
- Create: `apps/client/src/pages/BrowseBgg.tsx`
- Modify: `apps/client/src/App.tsx` (route), `apps/client/src/lib/strings/en.ts` + `nb.ts`
- Test: manual (typecheck/lint); import logic covered by Task 10/12.

**Interfaces:**

- Consumes: `bggUrl`, `useBggCatalogSearch`, `useBggImport`.

- [ ] **Step 1: Add strings (both locales)**

```ts
// en.ts — add a new top-level object
  browseBgg: {
    title: 'Browse BoardGameGeek',
    searchPlaceholder: 'Search the BGG catalog…',
    add: 'Add selected',
    imported: '{{created}} added, {{skipped}} skipped',
    empty: 'Search to find games to import',
  },
// en.ts — inside gameDetail (or the relevant object)
  viewOnBgg: 'View on BoardGameGeek',
```

```ts
// nb.ts — mirror the same keys
  browseBgg: {
    title: 'Utforsk BoardGameGeek',
    searchPlaceholder: 'Søk i BGG-katalogen…',
    add: 'Legg til valgte',
    imported: '{{created}} lagt til, {{skipped}} hoppet over',
    empty: 'Søk for å finne spill å importere',
  },
  viewOnBgg: 'Vis på BoardGameGeek',
```

- [ ] **Step 2: Add the BGG link on GameDetail**

```tsx
// apps/client/src/pages/GameDetail.tsx  — import and render near the title/meta
import { bggUrl } from '@tabletop/shared';
// where game meta renders:
{
  game.bggId && (
    <a
      href={bggUrl(game.bggId)}
      target="_blank"
      rel="noreferrer"
      className="text-[12.5px] font-semibold text-accent-text"
    >
      {t.gameDetail.viewOnBgg} ↗
    </a>
  );
}
```

- [ ] **Step 3: Create the Browse-BGG screen**

```tsx
// apps/client/src/pages/BrowseBgg.tsx
import { useMemo, useState, type JSX } from 'react';
import { bggUrl } from '@tabletop/shared';
import { useBggCatalogSearch, useBggImport } from '../lib/bgg-api.js';
import { t } from '../lib/strings.js';

export function BrowseBgg(): JSX.Element {
  const [q, setQ] = useState('');
  const { data: hits = [] } = useBggCatalogSearch(q);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const importGames = useBggImport();
  const ids = useMemo(() => [...selected], [selected]);

  function toggle(id: number): void {
    setSelected((s) => {
      const next = new Set(s);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  return (
    <div className="flex flex-col gap-4 p-6">
      <h1 className="font-display text-[20px] font-semibold">{t.browseBgg.title}</h1>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={t.browseBgg.searchPlaceholder}
        className="w-full rounded-lg border border-border bg-input px-3 py-2 text-[13px]"
      />
      {q.trim() === '' ? (
        <p className="text-[13px] text-muted2">{t.browseBgg.empty}</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {hits.map((hit) => (
            <li
              key={hit.bggId}
              className="flex items-center gap-3 rounded-lg border border-border px-3 py-2"
            >
              <input
                type="checkbox"
                checked={selected.has(hit.bggId)}
                onChange={() => toggle(hit.bggId)}
              />
              {hit.thumbnail && (
                <img src={hit.thumbnail} alt="" className="h-8 w-8 rounded object-cover" />
              )}
              <span className="flex-1 text-[13px]">
                {hit.name}
                {hit.year ? ` (${hit.year})` : ''}
                {hit.rank ? ` · #${hit.rank}` : ''}
              </span>
              <a
                href={bggUrl(hit.bggId)}
                target="_blank"
                rel="noreferrer"
                className="text-[11px] font-semibold text-accent-text"
              >
                ↗
              </a>
            </li>
          ))}
        </ul>
      )}
      <button
        type="button"
        disabled={ids.length === 0 || importGames.isPending}
        onClick={() =>
          importGames.mutate({ bggIds: ids }, { onSuccess: () => setSelected(new Set()) })
        }
        className="self-start rounded-lg bg-accent px-4 py-2 text-[13px] font-semibold text-on-accent disabled:opacity-60"
      >
        {t.browseBgg.add}
      </button>
      {importGames.data && (
        <p className="text-[13px] text-muted2">
          {t.browseBgg.imported
            .replace('{{created}}', String(importGames.data.created))
            .replace('{{skipped}}', String(importGames.data.skipped))}
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Add the route**

```tsx
// apps/client/src/App.tsx  — import and add a route inside the authed route table
import { BrowseBgg } from './pages/BrowseBgg.js';
// ...
<Route path="/browse-bgg" element={<BrowseBgg />} />;
```

Add a nav entry if the app has a nav list (follow the existing pattern in the file that renders `t.nav.*`); otherwise the route is reachable directly. Use an existing `t.nav.*` key or add `nav.browseBgg` to both locales if a nav link is added.

- [ ] **Step 5: Typecheck + lint + build**

Run: `npm run typecheck && npm run lint && npm run build`
Expected: all pass; client bundle builds.

- [ ] **Step 6: Commit**

```bash
git add apps/client/src/pages/GameDetail.tsx apps/client/src/pages/BrowseBgg.tsx apps/client/src/App.tsx apps/client/src/lib/strings/en.ts apps/client/src/lib/strings/nb.ts
git commit -m "feat(client): BGG page link + browse/import screen"
```

---

## Task 15: Full-suite verification

- [ ] **Step 1: Unit tests**

Run: `npm test`
Expected: all pass (new shared/server/client unit tests included).

- [ ] **Step 2: Integration tests (needs Postgres)**

Run: `RUN_DB_TESTS=1 DATABASE_URL=postgresql://tabletop:changeme@localhost:5432/tabletop npx vitest run --project server`
Expected: all pass, including `bgg-catalog.int.test.ts` and `bgg.int.test.ts`.

- [ ] **Step 3: Lint + typecheck + build**

Run: `npm run lint && npm run typecheck && npm run build`
Expected: zero warnings, no type errors, build succeeds.

- [ ] **Step 4: One-time catalog bootstrap (manual, optional)**

Load the file the user already exported:

```bash
npm run bgg:catalog:refresh -- --file "/c/Users/Andre/Downloads/2026-06-29T00-57-24.csv"
```

Expected: `bgg catalog: refreshed (~30854 rows, 2026-06-29)`.

- [ ] **Step 5: Commit any final fixes**

```bash
git commit -am "test: verify BGG catalog feature end-to-end" --allow-empty
```

---

## Self-Review Notes (traceability)

- **Spec §1.1/§2 data source** → Tasks 6, 9 (githubSource + `BGG_CATALOG_REPO`).
- **Spec §3 data model (all fields)** → Task 2 (`bgg_catalog`), Task 5 (`toHit` exposes all).
- **Spec §4 refresh, skip-if-unchanged, replace-in-transaction, offline seed** → Tasks 5, 6, 7, 11.
- **Spec §5 autofill (fills title/year/bggId/rating/rank/thumbnail; leaves rest blank)** → Tasks 8, 12, 13.
- **Spec §6 bulk import (skip existing by bggId)** → Task 10.
- **Spec §7 BGG links (detail + dropdown + browse)** → Tasks 12–14; helper in Task 1.
- **Spec §8 wire CsvDumpProvider** → Task 11.
- **Spec §9 error handling** → Task 6 (throw before delete; unchanged no-op), Task 8 (empty q → 400 via schema).
- **Spec §10 testing** → unit (Tasks 1,3,4,6,12), integration (Tasks 2,5,8,10,11), Task 15 full run.
- **`bggRating` = CSV Average** → Tasks 5 (`getCatalogRatings` uses `average`), 10 (import uses `average`).
