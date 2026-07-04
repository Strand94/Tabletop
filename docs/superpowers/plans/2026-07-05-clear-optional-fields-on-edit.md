# Clear Optional Fields On Edit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users clear a previously-set optional field on a game or expansion (emptying the input and saving unsets it).

**Architecture:** Two-layer fix. Server `toWritableData` stops collapsing `null → undefined` so an explicit `null` reaches Prisma (which clears the column) while an absent field stays `undefined` (unchanged). Client edit forms send `null` for emptied fields instead of `undefined`.

**Tech Stack:** Express + Prisma + zod (server), React + TanStack Query (client), Vitest + Supertest (tests), TypeScript throughout.

## Global Constraints

- Node >= 20, TypeScript. `npm run typecheck` must pass across all workspaces; `npm run lint` allows zero warnings. Husky pre-commit runs lint-staged + typecheck — don't bypass with `--no-verify`.
- No shared-schema change, no DB migration: fields are already `.nullish()` in `@tabletop/shared` and the columns are already nullable.
- No changes to people or sessions (people's update already passes null through and its form has no clearable optional field; sessions already handle undefined-vs-null).
- Integration tests (`*.int.test.ts`) run only with `RUN_DB_TESTS=1` and a reachable `DATABASE_URL`; they run serially and truncate tables between tests.
- Conventional Commits, one logical change per commit.

Integration-test run command used throughout:

```bash
RUN_DB_TESTS=1 DATABASE_URL=postgresql://tabletop:changeme@localhost:5432/tabletop npx vitest run --project server <file>
```

---

### Task 1: Server — pass nulls through so updates can clear columns

**Files:**

- Modify: `apps/server/src/modules/games/service.ts` (`toWritableData`, ~lines 67-85)
- Modify: `apps/server/src/modules/expansions/service.ts` (`toWritableData`, ~lines 38-56)
- Test: `apps/server/test/games.int.test.ts`, `apps/server/test/expansions.int.test.ts`

**Interfaces:**

- Consumes: existing `updateGameSchema`/`updateExpansionSchema` (`.partial()`, fields `.nullish()`) — a cleared field arrives as `null`, an untouched field is absent (`undefined`).
- Produces: `toWritableData` now forwards `null` (Prisma sets column NULL) and `undefined` (Prisma leaves unchanged) unchanged. Same signatures as before.

- [ ] **Step 1: Write the failing tests**

In `apps/server/test/games.int.test.ts`, add this test immediately after the existing `it('updates a game', ...)` block (ends ~line 139):

```ts
it('clears an optional field when updated with null', async () => {
  const created = await request(app)
    .post('/api/games')
    .set(auth(memberToken))
    .send({ title: 'Clearable', releaseYear: 1999, description: 'old' });
  expect(created.body.releaseYear).toBe(1999);

  const updated = await request(app)
    .patch(`/api/games/${created.body.id}`)
    .set(auth(memberToken))
    .send({ releaseYear: null });
  expect(updated.status).toBe(200);
  expect(updated.body.releaseYear).toBeNull();
  // A field NOT included in the patch must stay unchanged.
  expect(updated.body.description).toBe('old');
});
```

In `apps/server/test/expansions.int.test.ts`, add this immediately after the existing `it('updates an expansion', ...)` block (ends ~line 99):

```ts
it('clears an optional field when updated with null', async () => {
  const created = await request(app)
    .post(`/api/games/${gameId}/expansions`)
    .set(auth(memberToken))
    .send({ title: 'Clearable', releaseYear: 2020, price: 199 });
  expect(created.body.releaseYear).toBe(2020);

  const updated = await request(app)
    .patch(`/api/expansions/${created.body.id}`)
    .set(auth(memberToken))
    .send({ releaseYear: null });
  expect(updated.status).toBe(200);
  expect(updated.body.releaseYear).toBeNull();
  // A field NOT included in the patch must stay unchanged.
  expect(updated.body.price).toBe(199);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
RUN_DB_TESTS=1 DATABASE_URL=postgresql://tabletop:changeme@localhost:5432/tabletop npx vitest run --project server apps/server/test/games.int.test.ts apps/server/test/expansions.int.test.ts
```

Expected: the two new tests FAIL — `updated.body.releaseYear` is still `1999`/`2020` (not `null`), because the current `?? undefined` collapse drops the clear.

- [ ] **Step 3: Implement — games `toWritableData`**

In `apps/server/src/modules/games/service.ts`, replace the body of `toWritableData` (the `return { ... }`) with (note: no `?? undefined`; dates guarded so null/undefined pass through):

```ts
return {
  title: input.title,
  imagePath: input.imagePath,
  releaseYear: input.releaseYear,
  minPlayers: input.minPlayers,
  maxPlayers: input.maxPlayers,
  minPlaytime: input.minPlaytime,
  maxPlaytime: input.maxPlaytime,
  minAge: input.minAge,
  weight: input.weight,
  description: input.description,
  type: input.type,
  price: input.price,
  currency: input.currency,
  collectionStatus: input.collectionStatus,
  dateAdded: input.dateAdded == null ? input.dateAdded : new Date(input.dateAdded),
  bggId: input.bggId,
};
```

- [ ] **Step 4: Implement — expansions `toWritableData`**

In `apps/server/src/modules/expansions/service.ts`, replace the body of `toWritableData` with:

```ts
return {
  title: input.title,
  imagePath: input.imagePath,
  releaseYear: input.releaseYear,
  minPlayers: input.minPlayers,
  maxPlayers: input.maxPlayers,
  minPlaytime: input.minPlaytime,
  maxPlaytime: input.maxPlaytime,
  minAge: input.minAge,
  weight: input.weight,
  description: input.description,
  price: input.price,
  dateAdded: input.dateAdded == null ? input.dateAdded : new Date(input.dateAdded),
  bggId: input.bggId,
};
```

- [ ] **Step 5: Run the tests to verify they pass**

```bash
RUN_DB_TESTS=1 DATABASE_URL=postgresql://tabletop:changeme@localhost:5432/tabletop npx vitest run --project server apps/server/test/games.int.test.ts apps/server/test/expansions.int.test.ts
```

Expected: PASS, including the two new tests and all pre-existing create/update tests (which confirms untouched fields still round-trip and create still works with the null-passthrough helper).

- [ ] **Step 6: Typecheck**

Run: `npm run typecheck`
Expected: PASS. (Prisma's `*UncheckedCreateInput` types nullable columns as `T | null | undefined`, so forwarding `null` type-checks.)

- [ ] **Step 7: Commit**

```bash
git add apps/server/src/modules/games/service.ts apps/server/src/modules/expansions/service.ts apps/server/test/games.int.test.ts apps/server/test/expansions.int.test.ts
git commit -m "fix(server): let updates clear nullable game/expansion fields"
```

---

### Task 2: Client — send null for emptied fields on the edit forms

**Files:**

- Modify: `apps/client/src/components/GameFormModal.tsx` (`num`, ~lines 51-55; submit payload ~lines 97-109)
- Modify: `apps/client/src/components/ExpansionFormModal.tsx` (`num`, ~lines 42-45; submit payload ~lines 80-90)

**Interfaces:**

- Consumes: the server change from Task 1 (a `null` field now clears the column).
- Produces: no exported API change — internal form behavior only.

**Note on testing:** These form submits have no established unit-test harness in the client. Verification is typecheck + lint + a manual click-through in the running app (documented in Step 5). Do not invent a bespoke render-and-submit test.

- [ ] **Step 1: GameFormModal — `num` returns null for empty**

In `apps/client/src/components/GameFormModal.tsx`, replace the `num` helper:

```ts
function num(value: string): number | null {
  if (value.trim() === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}
```

- [ ] **Step 2: GameFormModal — text fields send null when empty**

In the same file, in the `onSubmit` payload, change the two `|| undefined` fallbacks to `|| null`:

Change `description: form.description.trim() || undefined,` to:

```ts
      description: form.description.trim() || null,
```

Change `imagePath: form.imagePath.trim() || undefined,` to:

```ts
      imagePath: form.imagePath.trim() || null,
```

(Leave the rest of the payload as-is: `title` stays required, `collectionStatus: form.status`, `categoryIds`, and the `num(...)` numeric fields now yield `null` when empty. The post-save `imageFile` upload path below is unchanged — a picked file still wins.)

- [ ] **Step 3: ExpansionFormModal — `num` returns null for empty**

In `apps/client/src/components/ExpansionFormModal.tsx`, replace the `num` helper:

```ts
function num(value: string): number | null {
  if (value.trim() === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}
```

- [ ] **Step 4: ExpansionFormModal — description sends null when empty**

In the same file's `onSubmit` payload, change `description: form.description.trim() || undefined,` to:

```ts
      description: form.description.trim() || null,
```

- [ ] **Step 5: Verify (typecheck, lint, build, manual)**

```bash
npm run typecheck && npm run lint && npm run build
```

Expected: all PASS, zero lint warnings. (`num` returning `number | null` is assignable to the `.nullish()` schema fields, which accept `number | null | undefined`.)

Then rebuild the running stack and click through:

```bash
cd docker && docker compose up -d --build
```

In the browser at `http://localhost:5470`: edit a game that has a release year, description and cover → clear all three → save → reopen the game and confirm they are empty (release year/description blank, cover shows the gradient placeholder). Repeat for an expansion's release year/description.

- [ ] **Step 6: Commit**

```bash
git add apps/client/src/components/GameFormModal.tsx apps/client/src/components/ExpansionFormModal.tsx
git commit -m "fix(client): clear optional game/expansion fields by emptying them"
```

---

## Self-Review

**Spec coverage:**

- Server null-passthrough for games + expansions → Task 1 (both `toWritableData` bodies). ✓
- Client empty→null for both forms → Task 2. ✓
- undefined-vs-null distinction guarded → Task 1 Step 1 tests assert an omitted field stays unchanged. ✓
- No people/sessions/schema/migration changes → confirmed; not touched. ✓
- Testing: server integration tests (clear + unchanged), client manual verification → Tasks 1 & 2. ✓

**Placeholder scan:** No TBD/TODO; every code step shows complete code; run commands have expected output. ✓

**Type consistency:** `num` returns `number | null` in both forms and feeds `.nullish()` schema fields (`number | null | undefined`) — assignable. `toWritableData` forwards `null` into Prisma `*UncheckedCreateInput` nullable fields (`T | null | undefined`). `dateAdded` guard yields `Date | null | undefined`. Signatures unchanged. ✓
