# BGG Catalog Init + Manual Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Auto-populate the BGG catalog on boot when it's empty, and give admins a "Refresh catalog" button in Settings.

**Architecture:** Server reuses the existing best-effort `runCatalogRefresh(config)` helper in `server.ts`, gated by an empty-catalog check (`currentSnapshotDate() === null`) run once in the `app.listen()` callback. Client adds a thin `useBggCatalogRefresh()` mutation over the existing admin-gated `POST /api/bgg/catalog/refresh` endpoint and an admin-only row in the existing Settings "BGG Sync" section.

**Tech Stack:** Node/Express + Prisma (server), React + TanStack Query + Tailwind + react-i18next (client), TypeScript throughout.

## Global Constraints

- Node >= 20, npm workspaces monorepo, TypeScript everywhere.
- `npm run lint` allows **zero warnings**; `npm run typecheck` must pass across all workspaces. A husky pre-commit hook runs lint-staged + typecheck — do not bypass with `--no-verify`.
- No hardcoded user-facing strings on the client — every string goes through `lib/strings/{en,nb}.ts`; **both** locale files must define the same keys or TypeScript fails.
- Dynamic strings use the `template.replace('{n}', String(value))` pattern (see `t.rating.overSessions` usage in `GameDetail.tsx`).
- Conventional Commits, one logical change per commit.
- The API contract lives in `@tabletop/shared`. This feature needs **no** new schema — `BggCatalogRefreshResultDto` and the endpoint already exist.

---

### Task 1: Auto-init catalog on boot when empty (server)

**Files:**

- Modify: `apps/server/src/server.ts`

**Interfaces:**

- Consumes: `currentSnapshotDate(): Promise<string | null>` from `./modules/bgg/catalog-service.js` (returns `null` when the catalog has zero rows — already tested in `apps/server/test/bgg-catalog.int.test.ts`). `runCatalogRefresh(config: Config): Promise<void>` (existing local helper in `server.ts`; best-effort, logs, never throws).
- Produces: nothing consumed by other tasks.

**Note on testing:** The only logic is "if empty, refresh" wiring inside `server.ts`, which is the process entrypoint and — per the project convention documented in `CLAUDE.md` — is never imported by tests. The empty signal it depends on (`currentSnapshotDate()` returning `null`) is already covered by an integration test. Verification for this task is a real boot against the currently-empty catalog.

- [ ] **Step 1: Add the import**

At the top of `apps/server/src/server.ts`, below the existing
`import { githubSource, refreshCatalog } from './modules/bgg/catalog-source.js';` line, add:

```ts
import { currentSnapshotDate } from './modules/bgg/catalog-service.js';
```

- [ ] **Step 2: Add the `initCatalogIfEmpty` helper**

Immediately after the existing `runCatalogRefresh` function (before `scheduleCatalogRefresh`), add:

```ts
/**
 * One-shot: populate the catalog on a fresh/empty database so search & import
 * work out of the box. Independent of the recurring BGG_CATALOG_REFRESH_ENABLED
 * scheduler. Best-effort — logs and never throws.
 */
async function initCatalogIfEmpty(config: Config): Promise<void> {
  try {
    if ((await currentSnapshotDate()) !== null) return; // already populated
    logger.info('BGG catalog empty — running initial refresh');
    await runCatalogRefresh(config);
  } catch (err) {
    logger.error({ err }, 'BGG catalog init check failed');
  }
}
```

- [ ] **Step 3: Call it from the `listen()` callback**

In `main()`, update the `app.listen` callback so it also kicks off the init check.
Change:

```ts
app.listen(config.PORT, () => {
  logger.info(`Tabletop server listening on port ${config.PORT}`);
  scheduleCatalogRefresh(config);
});
```

to:

```ts
app.listen(config.PORT, () => {
  logger.info(`Tabletop server listening on port ${config.PORT}`);
  void initCatalogIfEmpty(config);
  scheduleCatalogRefresh(config);
});
```

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: PASS (all workspaces, no errors).

- [ ] **Step 5: Verify against the running empty-catalog stack**

The local Docker stack is running with an empty catalog. Rebuild and restart so the new boot code runs:

Run: `cd docker && DB_PASSWORD=changeme JWT_SECRET=x JWT_REFRESH_SECRET=x docker compose up -d --build`
(The `.env` in `docker/` already supplies real values; the inline vars are only a fallback.)

Then confirm the init fired and the catalog populated:

Run: `docker logs tabletop 2>&1 | grep -i "catalog"`
Expected: a line `BGG catalog empty — running initial refresh` followed by `BGG catalog refresh completed` with a non-zero `count`.

Sanity-check the row count is now > 0 (search returns hits once an admin token exists, but the log line's `count` is sufficient evidence here).

- [ ] **Step 6: Commit**

```bash
git add apps/server/src/server.ts
git commit -m "feat(bgg): populate catalog on boot when empty"
```

---

### Task 2: Admin "Refresh catalog" button in Settings (client)

**Files:**

- Modify: `apps/client/src/lib/bgg-api.ts`
- Modify: `apps/client/src/lib/strings/en.ts`
- Modify: `apps/client/src/lib/strings/nb.ts`
- Modify: `apps/client/src/pages/Settings.tsx`

**Interfaces:**

- Consumes: `apiFetch<T>(path, options)` and `ApiError` from `./api.js`; `BggCatalogRefreshResultDto = { status: 'refreshed' | 'unchanged'; snapshotDate: string | null; count: number }` from `@tabletop/shared`; `useMutation` from `@tanstack/react-query`.
- Produces: `useBggCatalogRefresh()` — a TanStack mutation whose `mutationFn` POSTs to `/api/bgg/catalog/refresh` and resolves to `BggCatalogRefreshResultDto`.

**Note on testing:** `useBggCatalogRefresh` is a thin `apiFetch` wrapper identical in shape to the existing untested `useBggImport`; the client has no hook-test infrastructure (only a pure-function test exists). Following the established pattern, verification is typecheck/lint/build plus exercising the button in the running app — not a bespoke mock-heavy hook test.

- [ ] **Step 1: Add the mutation to `bgg-api.ts`**

Update the type import at the top of `apps/client/src/lib/bgg-api.ts` to include the result DTO:

```ts
import type {
  BggCatalogHitDto,
  BggCatalogRefreshResultDto,
  BggImportInput,
  BggImportResultDto,
} from '@tabletop/shared';
```

Then add, after `useBggImport`:

```ts
/** Admin-only: download the latest snapshot and replace the local catalog. */
export function useBggCatalogRefresh() {
  return useMutation({
    mutationFn: () =>
      apiFetch<BggCatalogRefreshResultDto>('/api/bgg/catalog/refresh', { method: 'POST' }),
  });
}
```

- [ ] **Step 2: Add strings to `en.ts`**

In `apps/client/src/lib/strings/en.ts`, inside the `settings` object, after the `syncHint` line, add:

```ts
    refreshCatalog: 'Refresh catalog',
    refreshCatalogHint: 'Download the latest board game data from BoardGameGeek',
    catalogUpdated: 'Updated — {n} games',
    catalogUpToDate: 'Already up to date',
    refreshFailed: 'Refresh failed',
```

- [ ] **Step 3: Add matching strings to `nb.ts`**

In `apps/client/src/lib/strings/nb.ts`, inside the `settings` object, after the `syncHint` line, add:

```ts
    refreshCatalog: 'Oppdater katalog',
    refreshCatalogHint: 'Last ned nyeste spilldata fra BoardGameGeek',
    catalogUpdated: 'Oppdatert — {n} spill',
    catalogUpToDate: 'Allerede oppdatert',
    refreshFailed: 'Oppdatering feilet',
```

- [ ] **Step 4: Wire the button into `Settings.tsx`**

In `apps/client/src/pages/Settings.tsx`:

(a) Add imports — update the api import and add the hook:

```ts
import { apiFetch, ApiError } from '../lib/api.js';
import { useBggCatalogRefresh } from '../lib/bgg-api.js';
```

(b) Inside the `Settings` component, after the `const isAdmin = ...` line, add the mutation and derived status text:

```ts
const refresh = useBggCatalogRefresh();
const refreshStatus = refresh.isPending
  ? undefined
  : refresh.error
    ? refresh.error instanceof ApiError
      ? refresh.error.message
      : t.settings.refreshFailed
    : refresh.data
      ? refresh.data.status === 'refreshed'
        ? t.settings.catalogUpdated.replace('{n}', String(refresh.data.count))
        : t.settings.catalogUpToDate
      : undefined;
```

(c) Replace the current BGG Sync section:

```tsx
<Section title={t.settings.bggSync}>
  <Row title={t.settings.enableSync} hint={t.settings.syncHint} last>
    <div className="flex items-center gap-2">
      <span className="rounded bg-chip px-2 py-1 text-[9.5px] font-bold text-muted2">
        {t.settings.offByDefault}
      </span>
      <div className="relative h-[25px] w-11 rounded-full bg-track opacity-60">
        <span className="absolute left-[3px] top-[3px] h-[19px] w-[19px] rounded-full bg-card shadow" />
      </div>
    </div>
  </Row>
</Section>
```

with (the toggle row loses `last` when the admin row is present; a new admin-only refresh row is added):

```tsx
<Section title={t.settings.bggSync}>
  <Row title={t.settings.enableSync} hint={t.settings.syncHint} last={!isAdmin}>
    <div className="flex items-center gap-2">
      <span className="rounded bg-chip px-2 py-1 text-[9.5px] font-bold text-muted2">
        {t.settings.offByDefault}
      </span>
      <div className="relative h-[25px] w-11 rounded-full bg-track opacity-60">
        <span className="absolute left-[3px] top-[3px] h-[19px] w-[19px] rounded-full bg-card shadow" />
      </div>
    </div>
  </Row>
  {isAdmin && (
    <Row title={t.settings.refreshCatalog} hint={t.settings.refreshCatalogHint} last>
      <div className="flex items-center gap-3">
        {refreshStatus && <span className="text-[11.5px] text-muted">{refreshStatus}</span>}
        <button
          type="button"
          disabled={refresh.isPending}
          onClick={() => refresh.mutate()}
          className="flex items-center gap-1.5 rounded-lg border border-border bg-input px-3 py-2 text-[12.5px] font-semibold text-muted2 disabled:opacity-60"
        >
          <Icon name="sync" size={16} className={refresh.isPending ? 'animate-spin' : ''} />
          {t.settings.refreshCatalog}
        </button>
      </div>
    </Row>
  )}
</Section>
```

- [ ] **Step 5: Lint + typecheck**

Run: `npm run lint && npm run typecheck`
Expected: PASS with zero warnings. (If `nb.ts`/`en.ts` keys diverge, typecheck fails here — fix by matching keys.)

- [ ] **Step 6: Build + verify in the running app**

Rebuild the stack so the app container serves the new client, then verify manually:

Run: `cd docker && docker compose up -d --build`

Then in the browser at `http://localhost:5470`:

1. Complete first-run setup (register the admin) if not already done, and sign in.
2. Go to **Settings → BGG Sync**. Confirm the admin-only "Refresh catalog" row is present.
3. Click **Refresh catalog**. Confirm: the button shows a spinning icon + disables while running, then an inline status appears — "Already up to date" (catalog was populated by Task 1's boot init) or "Updated — N games".
4. (Optional) Confirm a non-admin member account does **not** see the row.

- [ ] **Step 7: Commit**

```bash
git add apps/client/src/lib/bgg-api.ts apps/client/src/lib/strings/en.ts apps/client/src/lib/strings/nb.ts apps/client/src/pages/Settings.tsx
git commit -m "feat(client): admin BGG catalog refresh button in settings"
```

---

## Self-Review

**Spec coverage:**

- Auto-init on boot when empty → Task 1. ✓
- Admin manual refresh button in Settings BGG Sync section, inline status, no force → Task 2. ✓
- No shared-schema/DB/auth changes → confirmed; neither task touches them. ✓
- Recurring scheduler unchanged → neither task modifies `scheduleCatalogRefresh` or `BGG_CATALOG_REFRESH_ENABLED`. ✓

**Placeholder scan:** No TBD/TODO; all code shown in full; verification commands have expected output. ✓

**Type consistency:** `useBggCatalogRefresh` returns `BggCatalogRefreshResultDto` and is consumed in `Settings.tsx` via `refresh.data.status`/`refresh.data.count` — matches the DTO (`status`, `count`). `currentSnapshotDate` used with the correct `Promise<string | null>` return. String keys (`refreshCatalog`, `refreshCatalogHint`, `catalogUpdated`, `catalogUpToDate`, `refreshFailed`) added identically to both locale files and referenced with matching names in `Settings.tsx`. ✓
