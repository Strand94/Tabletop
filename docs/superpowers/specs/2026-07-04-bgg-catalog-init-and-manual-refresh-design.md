# BGG Catalog: boot-time auto-init + manual admin refresh

**Date:** 2026-07-04
**Status:** Approved (design)

## Problem

A fresh install (or a wiped database — see the recent worktree-volume data loss) starts
with an empty BGG catalog. Today the catalog only populates if an admin manually runs the
CLI or if the optional daily scheduler (`BGG_CATALOG_REFRESH_ENABLED`) is turned on. We want:

1. The catalog to **initialize itself** on a fresh/empty database without manual steps.
2. An **admin button in Settings** to trigger a refresh on demand from the app.

## Non-goals

- The recurring daily scheduler stays exactly as-is (`BGG_CATALOG_REFRESH_ENABLED`,
  `scheduleCatalogRefresh`). This spec does not change it.
- No new "force" control in the UI (YAGNI). The endpoint keeps its `?force=` query param.
- No changes to the auth/register flow (an earlier idea, rejected — see below).

## Approach

### 1. Auto-init: refresh on boot when the catalog is empty

`server.ts` already owns `runCatalogRefresh(config)` — a best-effort helper that runs one
refresh, logs the outcome, and never throws. It is already invoked from the `app.listen()`
callback for the daily scheduler.

Add a one-time check in that same startup path: if the catalog is empty, kick off one
background refresh (fire-and-forget; `runCatalogRefresh` already swallows/logs errors).

- **Empty check:** reuse `currentSnapshotDate()` from `catalog-service.ts`, which already
  returns `null` when the catalog has no rows. No new query surface.
- **Wiring (server.ts):** in the `listen()` callback, before/alongside `scheduleCatalogRefresh(config)`:

  ```ts
  // Populate the catalog on a fresh/empty DB so search/import work out of the box.
  void initCatalogIfEmpty(config);
  ```

  where `initCatalogIfEmpty` is a small local helper:

  ```ts
  async function initCatalogIfEmpty(config: Config): Promise<void> {
    if ((await currentSnapshotDate()) !== null) return; // already populated
    logger.info('BGG catalog empty — running initial refresh');
    await runCatalogRefresh(config);
  }
  ```

- **Independence:** this runs regardless of `BGG_CATALOG_REFRESH_ENABLED`. That flag governs
  the _recurring_ job; empty-catalog init is a separate one-shot concern. If the daily
  scheduler is also enabled, its first run simply reports `unchanged` (idempotent).
- **Self-healing:** covers fresh deploys and wiped databases automatically on next boot.

**Why not "on first admin created"?** Considered and rejected: it couples a background
network job to the register HTTP handler, threads a new dependency through
`server → app → auth`, and only fires conceptually once. Boot-if-empty is decoupled
(server.ts only), idempotent, and self-heals the exact wipe scenario we just hit.

### 2. Manual refresh button (Settings, admin-only)

The server endpoint already exists and needs no change:
`POST /api/bgg/catalog/refresh` — `requireRole('ADMIN')`, returns
`BggCatalogRefreshResultDto = { status: 'refreshed' | 'unchanged', snapshotDate, count }`,
502 on download failure.

**Client:**

- `lib/bgg-api.ts`: add a `useBggCatalogRefresh()` mutation calling
  `apiFetch<BggCatalogRefreshResultDto>('/api/bgg/catalog/refresh', { method: 'POST' })`.
- `pages/Settings.tsx`: in the existing **BGG Sync** section, add an admin-only
  "Refresh catalog" row (rendered only when `isAdmin`). A button that:
  - disables and shows a spinner while `mutation.isPending`;
  - on success shows inline status — `refreshed` → "Updated — {count} games";
    `unchanged` → "Already up to date";
  - on error shows the `ApiError` message inline.
- `lib/strings/en.ts` + `lib/strings/nb.ts`: new keys under `settings` —
  `refreshCatalog`, `refreshCatalogHint`, `catalogUpdated` (formats a count),
  `catalogUpToDate`, `refreshFailed`.

## Data flow

```
Boot:   server.listen() → initCatalogIfEmpty(config)
          → currentSnapshotDate() === null ?
            → runCatalogRefresh(config) → refreshCatalog(githubSource) → replaceCatalog()

Manual: Settings button → useBggCatalogRefresh() → POST /api/bgg/catalog/refresh
          → requireRole('ADMIN') → refreshCatalog(githubSource(catalogRepo))
          → { status, snapshotDate, count } → inline status in UI
```

## Error handling

- Boot init: `runCatalogRefresh` never throws; a failed download logs an error and the app
  starts normally with an empty catalog (admin can retry via the button).
- Manual endpoint: unchanged — download failure → 502 with message; client renders it inline.

## Testing

- **Server (integration, `*.int.test.ts`):** `currentSnapshotDate()` returns `null` on an
  empty catalog and a date after `replaceCatalog(...)`. (Confirms the empty signal the boot
  check relies on.) The existing admin-gate test on `POST /api/bgg/catalog/refresh` stays.
  `initCatalogIfEmpty`/`runCatalogRefresh` wiring lives in `server.ts`, which is the process
  entrypoint and, per project convention, is not imported by tests.
- **Client:** a light test that `useBggCatalogRefresh` issues `POST /api/bgg/catalog/refresh`
  (mirrors `bgg-autofill.test.ts` style).

## Files touched

Server:

- `apps/server/src/server.ts` — add `initCatalogIfEmpty`, call it in the `listen()` callback.

Client:

- `apps/client/src/lib/bgg-api.ts` — `useBggCatalogRefresh()`.
- `apps/client/src/pages/Settings.tsx` — admin-only "Refresh catalog" row.
- `apps/client/src/lib/strings/en.ts`, `apps/client/src/lib/strings/nb.ts` — new strings.

No shared-schema change, no DB migration, no auth/app change.
