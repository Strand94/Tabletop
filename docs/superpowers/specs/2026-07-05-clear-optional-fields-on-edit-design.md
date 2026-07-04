# Clear optional fields back to empty on edit

**Date:** 2026-07-05
**Status:** Approved (design)

## Problem

When editing a game or expansion, a user cannot clear an optional field that was
previously set (e.g. release year, description, cover image, price). Emptying the
field and saving leaves the old value in place. Users expect emptying a field and
saving to unset it.

## Root cause

The clear is dropped at two independent layers:

1. **Server** — `toWritableData` in both `games/service.ts` and `expansions/service.ts`
   maps every optional field as `input.x ?? undefined`. Prisma treats `undefined` as
   "leave the column unchanged", so an explicit `null` from the client is silently
   turned into a no-op.
2. **Client** — `GameFormModal` and `ExpansionFormModal` map an emptied input to
   `undefined` (`num()` returns `undefined` for blank; text fields use
   `.trim() || undefined`), so the clear is never even sent.

The zod schemas already accept `null` (fields are `.nullish()`) and the database
columns are already nullable, so no schema or migration change is needed.

## Non-goals

- **People**: `people/service.ts` `updatePerson` already passes `null` through
  correctly (`input.imagePath === undefined ? undefined : input.imagePath`), and
  `PersonFormModal` only edits `name` (required). Nothing to clear → no change.
- **Sessions**: already handle the undefined-vs-null distinction for their nullable
  fields (`sessions/service.ts` `end`). No change.
- No new "clear" button UI — emptying the existing input and saving is the gesture.

## Approach

### Server (`games/service.ts`, `expansions/service.ts`)

In each `toWritableData`, stop collapsing `null` into `undefined`. Pass nullable
fields through as `input.x` directly:

- `undefined` (field absent from a partial update) stays `undefined` → Prisma skips it
  (unchanged).
- `null` (field explicitly cleared) stays `null` → Prisma sets the column NULL.

Dates need a guarded conversion so `null` and `undefined` are preserved and only a
string is converted:

```ts
dateAdded: input.dateAdded == null ? input.dateAdded : new Date(input.dateAdded),
```

Fields that are never null are unaffected: `title` and `currency` (games) are handled
in the create/update spreads as today; `collectionStatus` is `.optional()` (not
`.nullish()`), so it is only ever a value or `undefined`.

`toWritableData` is shared with `createGame`/`createExpansion`. Passing `null` on
create sets the column NULL, which equals its existing default — no create regression.

### Client (`GameFormModal.tsx`, `ExpansionFormModal.tsx`)

Map emptied fields to `null` instead of `undefined` so a cleared field is sent
explicitly:

- `num(value)` returns `null` for blank/invalid input (was `undefined`).
- Text fields: `description` / `imagePath` use `.trim() || null` (was `|| undefined`).

This applies to both create and edit. On create, `null` equals the existing default,
so there is no visible change; on edit, it clears the field. `title` stays required;
`collectionStatus` stays as the selected value. `num`'s return type becomes
`number | null`, which is assignable to the `number | null | undefined` schema fields.

## Data flow

```
Edit form, field emptied → payload value = null
  → PATCH /api/games/:id (or /expansions/:id)
  → updateGameSchema/.partial() parse (null accepted)
  → toWritableData passes null through
  → prisma.update sets column NULL
  → GET returns the field as null
```

## Testing

- **Server integration** (`apps/server/test/games.int.test.ts`,
  `apps/server/test/expansions.int.test.ts`):
  - Create a game/expansion with an optional field set (e.g. `releaseYear`,
    `description`), PATCH with that field = `null`, GET and assert it is now `null`.
  - PATCH omitting the field and assert an unrelated previously-set field is
    unchanged (guards the undefined-vs-null distinction — a regression here would
    clear fields that were merely not sent).
- **Client**: the form submit is not unit-tested today (no established pattern for it);
  verify manually in the running app — edit a game, clear release year / description /
  cover, save, confirm the fields stay empty after reload.

## Files touched

- `apps/server/src/modules/games/service.ts` — `toWritableData` passes nulls through.
- `apps/server/src/modules/expansions/service.ts` — same.
- `apps/client/src/components/GameFormModal.tsx` — empty → `null`.
- `apps/client/src/components/ExpansionFormModal.tsx` — empty → `null`.
- `apps/server/test/games.int.test.ts`, `apps/server/test/expansions.int.test.ts` — clear-on-update tests.

No shared-schema change, no DB migration, no people/sessions changes.
