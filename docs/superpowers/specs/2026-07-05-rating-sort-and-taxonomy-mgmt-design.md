# Rating Sort + Category/Location Management — Design

Closes backlog items #6 and #7 (`docs/review/2026-07-02-spec-gap-todo.md`, both P2).

## #6 — Sort the collection by your game rating (§3.9 "my favourites")

The requesting user's per-game rating lives in `UserGameRating` (per-user), which Prisma can't
`orderBy` directly, so `myRating` needs a dedicated path.

**Shared:** `gameQuerySchema.sort` gains `'myRating'` (already committed).

**Server — `apps/server/src/modules/games/service.ts`, `listGames`:**

- Keep the existing DB `orderBy` path for `title | releaseYear | dateAdded | createdAt`.
- When `sort === 'myRating'`: in-memory path.
  1. Fetch the ids of all games matching the current `where` (`prisma.game.findMany({ where,
select: { id: true } })`).
  2. Fetch this user's ratings for those ids (`userGameRating.findMany`), build an
     `id → rating` map.
  3. Sort the ids by rating according to `order` (`asc`/`desc`), with **NULL ratings always last**
     regardless of order; tie-break by id asc for stability.
  4. `total` = full list length; slice the page (`skip`/`take` from `page`/`pageSize`).
  5. Load the page's games with `gameInclude`, re-order them to match the sorted id slice, and map
     to DTOs attaching `myRating` (as the current list path already does).

Factor the shared "attach myRating map" logic so both paths reuse it. `avgSessionRating` stays
`null` in the list (unchanged; out of scope).

**Client:** add a "My rating" option to the collection sort control (wherever the existing
`sort` options are rendered — `Collection.tsx` / its filter bar) with a new string in `nb`/`en`.
Default order for rating is descending (highest first) — set when the user picks it, matching how
the control drives `order`.

## #7 — Category & Location management UI (Settings, admin-only)

Create endpoints already exist (`POST /api/categories` admin-gated upsert; `POST /api/locations`).
The gap is (a) delete endpoints and (b) a management UI.

**Backend — new delete routes, both `requireRole('ADMIN')`:**

- `DELETE /api/categories/:id` in `createCategoriesRouter` (`modules/games/routes.ts`) → 204.
  Relies on `GameCategory.category onDelete: Cascade` (schema line 254): tag rows removed, games
  survive. 404 if the category doesn't exist.
- `DELETE /api/locations/:id` in `createLocationsRouter` (`modules/sessions/routes.ts`) → 204.
  Relies on `Session.location onDelete: SetNull` (schema line 164): affected sessions keep
  existing, `locationId` nulled. 404 if the location doesn't exist.

Add a `parseId` guard consistent with the other routers. No shared-schema change needed for
delete; `CategoryDto` already exists, add a `LocationDto` type to `@tabletop/shared` if the client
needs one (Location = `{ id, name, address: string | null }`).

**Client:** two new admin-only sections in `Settings.tsx`, after the Users section, reusing
`Section`/`Row` and the lightweight modal pattern:

- **Categories** — list existing (name), "Add category" (name) → `POST /api/categories`, per-row
  delete with confirm → `DELETE`.
- **Locations** — list existing (name + address), "Add location" (name + optional address) →
  `POST /api/locations`, per-row delete with confirm → `DELETE`.
- New query/mutation hooks (`lib/categories-api.ts` reusing the existing `useCategories`, plus
  create/delete; `lib/locations-api.ts`). Mutations invalidate their list keys (`['categories']`,
  `['locations']`).
- All copy via new `settings.categories` / `settings.locations` string groups in `nb` + `en`.
  No hardcoded literals. Surface `ApiError` messages inline.

## Testing (TDD)

- **#6** `apps/server/test/games.int.test.ts` (extend): with three games and mixed ratings from
  the user, `sort=myRating&order=desc` returns highest-first with unrated last; `order=asc`
  returns lowest-first with unrated still last; pagination returns the right page under rating
  sort.
- **#7** integration: `DELETE /api/categories/:id` — 403 for member, 204 for admin, the game that
  had the category survives with the tag gone; `DELETE /api/locations/:id` — 403 for member, 204
  for admin, a session that used it survives with `location` null; 404 for a missing id.
- **Client:** the sort control offers "My rating"; the Categories/Locations sections render for an
  admin (hidden for a member) — following existing client test conventions in `apps/client/test`.

## Files

```
packages/shared/src/game.ts                    (done: sort enum)
packages/shared/src/session.ts or new          (#7: LocationDto if needed)
apps/server/src/modules/games/service.ts       (#6: myRating sort path)
apps/server/src/modules/games/routes.ts        (#7: DELETE /categories/:id)
apps/server/src/modules/sessions/routes.ts     (#7: DELETE /locations/:id)
apps/server/test/games.int.test.ts             (#6 + #7 category delete tests)
apps/server/test/sessions.int.test.ts          (#7 location delete tests)
apps/client/src/pages/Collection.tsx (+filter) (#6: sort option)
apps/client/src/pages/Settings.tsx             (#7: two sections)
apps/client/src/lib/categories-api.ts          (#7)
apps/client/src/lib/locations-api.ts           (#7)
apps/client/src/lib/strings/{nb,en}.ts         (#6 + #7 copy)
apps/client/test/*                             (tests)
```
