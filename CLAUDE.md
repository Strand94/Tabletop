# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Tabletop is a self-hosted board game collection and play-session tracker. Runs as two
containers (app + PostgreSQL). Node >=20, npm workspaces monorepo, TypeScript everywhere.

Design spec: `docs/design/tabletop-design-spec.md` (authoritative data model / API
design). Build plan: `docs/superpowers/plans/2026-06-30-tabletop-mvp-slice.md`. The project is
built in stages (branch names follow `build/stage-N-*`); check the current branch name against
the plan to see which stage is in progress.

## Commands

```bash
npm install                 # install all workspaces
npm run dev                 # API + client in watch mode (tsx watch, port 5470)
npm test                    # unit tests (Vitest), excludes *.int.test.ts
npm run lint                # ESLint, zero warnings allowed
npm run format               # Prettier write
npm run format:check
npm run typecheck           # tsc --noEmit across every workspace
npm run build                # build all workspaces
```

Single test file / single test:

```bash
npx vitest run apps/server/test/games.int.test.ts
npx vitest run -t "returns 404"
```

Integration tests (`*.int.test.ts`, Supertest against a real Postgres) are excluded from
`npm test` by default. Run them with `RUN_DB_TESTS=1` and a reachable `DATABASE_URL`:

```bash
RUN_DB_TESTS=1 DATABASE_URL=postgresql://tabletop:changeme@localhost:5432/tabletop npx vitest run --project server
```

Integration test files run serially (`fileParallelism: false` when `RUN_DB_TESTS=1`) because
they share one Postgres and truncate tables between tests (`apps/server/test/helpers/db.ts`) —
don't parallelize them.

Prisma:

```bash
npm run prisma:generate
npm run prisma:migrate      # dev migration, needs a running local Postgres
npm run prisma:deploy       # apply pending migrations, no prompts (used in prod/CI)
npm run prisma:seed
```

E2E (Playwright, `e2e/*.spec.ts`) requires a built client + server and a real Postgres; see the
`e2e` job in `.github/workflows/ci.yml` for the exact env vars it needs.

A husky pre-commit hook runs lint-staged (eslint --fix + prettier) plus typecheck — don't bypass
it with `--no-verify`.

## Architecture

npm workspaces: `apps/server`, `apps/client`, `packages/shared`.

**`packages/shared` (`@tabletop/shared`) is the single source of truth for the API contract.**
It holds zod schemas + inferred types (e.g. `createGameSchema`, `GameDto`, `AuthTokens`). Both
the server (route-level `.parse()` validation) and the client (typed `apiFetch<T>` calls) import
from it. When changing an API shape, edit the schema here first — the server route and client
call site both derive their types from it, so this is the one place that can't drift.

**Server (`apps/server/src`)** — Express, feature-module layout, no ORM leakage into routes:

- `app.ts` exports `createApp(deps?)` — a pure factory (no DB connection, no `listen()`) so tests
  import and exercise it directly via Supertest. Feature routers are only mounted if `deps` is
  passed; tests that just hit `/health` can call `createApp()` with no args.
- `server.ts` is the actual process entrypoint (`node dist/server.js`) — validates config, runs
  `prisma migrate deploy` (skippable via `SKIP_MIGRATIONS=1`), then calls `app.listen()`. Never
  imported by tests.
- `config.ts` — all env access goes through `loadConfig()`, a zod schema that throws a
  descriptive, aggregated error and refuses to start on invalid/missing config (fail-fast).
  `JWT_SECRET`/`JWT_REFRESH_SECRET` have no defaults; `DATABASE_URL` is derived from the
  `DB_*` vars if not set explicitly.
- `modules/<feature>/routes.ts` + `service.ts` — routes parse input with a shared zod schema,
  delegate to the service for Prisma calls + DTO mapping, and forward errors with
  `.catch(next)`. Services throw `HttpError(status, message)` (`middleware/error.ts`) for
  expected failures (404s, etc); `errorHandler` middleware turns those into JSON responses.
- `middleware/auth.ts` — `requireAuth(tokens)` verifies the bearer access token and attaches
  `req.user: TokenPayload`; `requireRole(...roles)` must run after it. Both are factories that
  close over a `TokenService` (never a bare secret) so tests can inject a fake one.
- Static file serving: uploaded images are served from `/images` (see `modules/uploads/image.ts`,
  `IMAGES_DIR`); the built client is served from `apps/client/dist` (or `CLIENT_DIST` in
  containers) with an SPA fallback for any non-`/api` route.

**Client (`apps/client/src`)** — React + Vite + TypeScript, Radix UI + Tailwind, TanStack Query,
react-router, react-i18next:

- `App.tsx` — provider stack (QueryClient → Theme → BrowserRouter → Auth) and the route table.
  Routes not yet built get a `<Placeholder>`.
- `lib/api.ts` — `apiFetch<T>()` is the one place HTTP calls go through: attaches the bearer
  token, retries exactly once after a transparent refresh on 401, and throws `ApiError` (status +
  message) on non-2xx. Feature-specific API modules (`lib/games-api.ts`, `lib/stats-api.ts`) call
  through this rather than raw `fetch`.
- `lib/token-store.ts` / `lib/auth.tsx` — token persistence and the auth context/provider.
- **i18n:** no hardcoded user-facing strings. Everything goes through `lib/strings.ts` /
  react-i18next (`t.nav.sessions` style).

**Prisma** (`prisma/schema.prisma`) — PascalCase models, snake_case tables via `@@map`/`@map`.
Two separate rating tables by design (`UserGameRating` vs `UserSessionRating` — a game rating and
a per-play rating are deliberately distinct concepts, see spec §3.9). `Person` is the player
record; `Person.userId` is the authoritative link to an account (a `Person` can exist without a
`User`, e.g. a household member who doesn't log in). Migrations live in `prisma/migrations`.

## Conventions

- **Commits:** Conventional Commits (`feat:`, `fix:`, `chore:`, `test:`, `ci:`, `docs:`,
  `refactor:`), one logical change per commit.
- **TDD** where there is logic (see `docs/superpowers` skills/plans in this repo). Unit tests
  with Vitest, API integration tests with Supertest against a real Postgres, e2e with Playwright.
  Don't merge red.
- **Validation:** all API input/output goes through zod schemas from `@tabletop/shared`;
  cross-entity integrity rules belong in the service layer, not controllers/routes.
- Auth: members can create/edit most resources; destructive operations (delete) are
  `requireRole('ADMIN')`-gated — follow this pattern for new mutating routes unless the spec says
  otherwise.
