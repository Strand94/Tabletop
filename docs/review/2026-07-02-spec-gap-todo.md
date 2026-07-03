# Spec Gap Review — TODO

Review of the app against `boardgame-tracker-design-spec.md`, 2026-07-02.

The implementation is close to the spec: schema, two-rating design, cascade rules,
validation, auth gating, and v2 seams are all present. Items below are the gaps found,
with story-point (SP) effort estimates and priority.

**SP scale:** 1 = trivial (<1h), 2 = small, 3 = half-day, 5 = ~1 day, 8 = multi-day.
**Priority:** P0 blocks a fresh install / core flow · P1 spec requirement, no workaround ·
P2 spec requirement with workaround · P3 polish / deferrable.

---

## Bugs / correctness

| #   | Item                                                                                                                                                                                                                                                                                                                                                                                       | Priority | SP  |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- | --- |
| 1   | **No way to create the first admin.** `prisma/seed.ts` seeds only categories; no admin is created and the client has no registration UI (`Login.tsx` logs in only). Fresh deploy can only bootstrap the first admin via a manual `curl` to `/api/auth/register`. Spec §8.5 expects the seed to admit the first admin. Fix: env-driven admin seed **or** a first-run "create admin" screen. | P0       | 5   |
| 2   | **BGG ID field missing from the game form.** Backend accepts `bggId` and the sync route reads it, but `bggId` appears nowhere in the client — the whole BGG sync seam is unreachable from the UI. Spec §9.2/§9.3 require an optional "BGG ID" input on the game form.                                                                                                                      | P1       | 2   |
| 3   | ✅ **FIXED** (commit a1221bd). ~~`sessionsPerDay` timezone mismatch~~ — window was local-midnight but buckets were UTC dates; now both key by local date. Was causing an intermittent `stats.int.test` failure outside UTC.                                                                                                                                                                | P2       | 3   |

## Missing vs spec

| #   | Item                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Priority | SP  |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | --- |
| 4   | **No admin user-management UI** (create/list/manage users) — §4.1/§6. Ties into #1.                                                                                                                                                                                                                                                                                                                                                                                                 | P1       | 5   |
| 5   | **BGG sync toggle in Settings is a dead visual stub** (`Settings.tsx:132`); even the no-op `POST /api/sync/bgg` can't be triggered from the UI. Stub is acceptable per §9.3, but there's no wired trigger at all.                                                                                                                                                                                                                                                                   | P2       | 2   |
| 6   | **Can't sort/filter collection by the user's game rating.** `gameQuerySchema.sort` = `['title','releaseYear','dateAdded','createdAt']` — no rating. Spec §3.9 calls out per-game rating driving "my favourites" sorting. `avgSessionRating` is also only computed on `getGame`, never in the list.                                                                                                                                                                                  | P2       | 5   |
| 7   | **No category/location creation UI.** Game form assigns `categoryIds` and admin `POST /categories` exists, but nothing in the UI creates a category/location beyond the 4 seeded ones.                                                                                                                                                                                                                                                                                              | P2       | 3   |
| 8   | **Import not implemented** (export JSON/CSV works). §4.2 lists "Export/Import"; import is a v2 nice-to-have, safe to defer.                                                                                                                                                                                                                                                                                                                                                         | P3       | 5   |
| 9   | **No image removal.** Sessions can add photos but not delete; game/expansion cover images can't be cleared.                                                                                                                                                                                                                                                                                                                                                                         | P3       | 3   |
| 14  | **No image upload anywhere in the client (MVP gap).** Backend endpoints exist (`POST /api/games/:id/image`, `/expansions/:id/image`, `/sessions/:id/image`) but the client never calls them — no `FormData`/multipart anywhere, and `GameFormModal` has no image field at all. Game covers, expansion art, avatars, and session photos are all unsettable from the UI. Spec §4.1.2 lists image upload as MVP. Follow-up: add upload UI (start with game cover, reuse for the rest). | P1       | 5   |

## Integrity edges to decide

| #   | Item                                                                                                                                                                                                                                                                                                                                                                           | Priority | SP  |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- | --- |
| 10  | **§10.3 vs §10.8 conflict — playerless sessions.** Deleting a person cascades their `PlayerSession` rows (sessions correctly survive), but removing a session's _last_ player leaves it with zero players, violating §10.3's "≥1 player" invariant. No guard. **Decision needed:** block a person delete that would empty a session, or explicitly accept playerless sessions. | P2       | 3   |
| 11  | **Minor TOCTOU in session create.** `assertExpansionsBelongToGame` / `assertPeopleExist` run as separate queries before the create, outside a transaction (`apps/server/src/modules/sessions/service.ts:95`). Low risk for a household app.                                                                                                                                    | P3       | 2   |

## Polish

| #   | Item                                                                                                                                                                                                             | Priority | SP  |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | --- |
| 12  | **Seed categories are Norwegian-only literals** (`'Strategi','Familie','Co-op','Kortspill'`) shown verbatim regardless of locale — i18n smell for an `en`-default instance. See also #15 (broader i18n cluster). | P3       | 2   |
| 13  | **Port/DB naming deviates from spec** (`5470`/`tabletop` vs spec's `5444`/`boardgametracker`). Intentional Tabletop branding, consistent across config/compose — not a bug, noted as a conscious deviation.      | —        | 0   |

---

## Beyond spec / feature requests

Enhancements raised outside the design spec (household-use feedback, 2026-07-03). Not spec
gaps — tracked here so they don't get lost.

| #   | Item                                                                                                                                                                                                                                                                                                                                                            | Priority     | SP  |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ | --- |
| 15  | **i18n cluster (English-first).** Broadens #12. Three parts: (a) make **English the default locale** (fall back to `en`, not `nb`); (b) **audit for remaining hardcoded strings** beyond the seed categories — any user-facing literal not routed through `lib/strings.ts`; (c) **flag icons next to the language selector**.                                   | P2           | 5   |
| 16  | **Mobile-friendly / responsive layout.** No responsive pass has been done; layouts assume desktop widths. Make the collection, session, and stats views usable on a phone. Net-new, not spec-driven.                                                                                                                                                            | P2           | 5   |
| 17  | **Shared household collection (partner co-editing).** Let a partner share one collection, sessions, ratings, etc. Data model already leans multi-user (`Person.userId`, roles) and members can already edit most resources, so the open question is the **scoping model**: per-user vs. shared-household. **Needs a brainstorm/design pass before estimating.** | needs design | ?   |

---

## Suggested order

`#1 → #2 → #3 → #10 (decision) → #6 / #7`, then P3 polish. Feature requests (#15–#17) slot
after the P0/P1 spec gaps; #17 needs a design pass before it can be scheduled.

**Totals:** P0 = 5 SP · P1 = 7 SP · P2 = 16 SP · P3 = 14 SP · feature requests = 10 SP + #17 (TBD).
