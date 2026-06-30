# Tabletop MVP Slice (Stages 0–3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement
> this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a runnable, tested, CI-gated board-game tracker covering project foundation,
data layer, auth, and Games CRUD + Collection UI + a basic dashboard — ending at a tagged
`v0.1.0-mvp` you can log into, add a game, and see it on the dashboard.

**Architecture:** npm-workspaces monorepo. `apps/server` (Express + Prisma + TS) serves
both `/api` and the built `apps/client` (React + Vite + TS) bundle as one container; Postgres
is the second container. `packages/shared` holds zod schemas that are the single source of
truth for API contracts and inferred types. JWT access+refresh auth with argon2.

**Tech Stack:** TypeScript, Express, Prisma, PostgreSQL 16, React 18, Vite, Tailwind, Radix UI,
react-i18next, zod, Vitest, Supertest, Playwright, Docker, GitHub Actions.

---

## Conventions for every task

- TDD where there is logic: write the failing test, see it fail, implement, see it pass, commit.
- One commit per sub-task, message prefixed `feat:`/`chore:`/`test:`/`ci:`/`docs:` and the stage id.
- Run `npm run lint && npm run typecheck` before each commit once those scripts exist.
- Never commit secrets; `.env` is gitignored, `.env.example` is committed.

---

## File structure (created across this plan)

```
package.json                      # workspace root + scripts
tsconfig.base.json                # shared compiler options
.eslintrc.cjs / .prettierrc / .gitignore / .env.example
.husky/pre-commit
.github/workflows/ci.yml
.github/dependabot.yml
.gitleaks.toml
README.md / CONTRIBUTING.md / .github/ISSUE_TEMPLATE/*
packages/shared/                  # zod schemas + inferred types + enums
  src/{enums,game,auth,common,index}.ts
prisma/schema.prisma              # full data model
prisma/seed.ts
apps/server/
  src/config.ts                   # typed, fail-fast env
  src/logger.ts                   # pino
  src/db.ts                       # Prisma client singleton
  src/app.ts                      # express app factory (testable)
  src/server.ts                   # boot: migrate + listen
  src/middleware/{auth,error}.ts
  src/modules/auth/{service,routes}.ts
  src/modules/games/{service,routes}.ts
  src/modules/stats/{service,routes}.ts
  src/modules/uploads/image.ts
  test/*                          # vitest + supertest
apps/client/
  src/main.tsx / src/App.tsx / src/theme.css
  src/lib/{api,auth-store}.ts
  src/components/{AppShell,...}
  src/pages/{Login,Dashboard,Collection,GameDetail}.tsx
docker/{Dockerfile,docker-compose.yml,.dockerignore}
```

---

## STAGE 0 — Foundation & tooling

### Task 0.1: npm workspace root + TS + lint/format + gitignore

**Files:** Create `package.json`, `tsconfig.base.json`, `.eslintrc.cjs`, `.prettierrc`,
`.prettierignore`, `.gitignore`, `.env.example`.

- [ ] Root `package.json` declares `"workspaces": ["packages/*", "apps/*"]`, `"private": true`,
      Node engine `>=20`, and scripts: `lint`, `format`, `typecheck`, `test`, `build`, `dev`.
- [ ] `tsconfig.base.json`: `strict`, `target ES2022`, `module NodeNext`, `moduleResolution NodeNext`,
      `esModuleInterop`, `skipLibCheck`, `composite` off, `declaration` for shared.
- [ ] ESLint flat/legacy config with `@typescript-eslint`, `eslint-config-prettier`; Prettier defaults.
- [ ] `.gitignore`: `node_modules`, `dist`, `.env`, `coverage`, `playwright-report`, `images/`, `logs/`,
      `postgres-data/`, `*.tsbuildinfo`.
- [ ] `.env.example` with every var from product spec §8.3 (placeholders, no real secrets).
- [ ] Commit: `chore(stage-0): scaffold npm workspace, typescript, eslint/prettier`

### Task 0.2: Test tooling + git hooks

**Files:** Create `vitest.config.ts` (root, projects), `playwright.config.ts`, `.husky/pre-commit`,
a smoke test `packages/shared/test/smoke.test.ts`.

- [ ] Install dev deps: `vitest`, `@vitest/coverage-v8`, `@playwright/test`, `husky`, `lint-staged`.
- [ ] Vitest workspace config running per-package tests in node + jsdom envs.
- [ ] Smoke test: `expect(1 + 1).toBe(2)` to prove the runner works; run it, see it pass.
- [ ] `husky` pre-commit runs `lint-staged` (eslint --fix + prettier) and `npm run typecheck`.
- [ ] Commit: `chore(stage-0): add vitest, playwright, husky pre-commit`

### Task 0.3: CI skeleton + Dependabot + Gitleaks

**Files:** Create `.github/workflows/ci.yml`, `.github/dependabot.yml`, `.gitleaks.toml`.

- [ ] `ci.yml` on `pull_request` + `push` to main: setup-node (cache npm), `npm ci`,
      `npm run lint`, `npm run typecheck`, `npm test`. (Integration/e2e/scan jobs added in later stages.)
- [ ] Gitleaks job using `gitleaks/gitleaks-action`.
- [ ] `dependabot.yml`: npm (root) weekly + github-actions weekly.
- [ ] Commit: `ci(stage-0): add CI skeleton, dependabot, gitleaks`

### Task 0.4: Project docs

**Files:** Create `README.md`, `CONTRIBUTING.md`, `.github/ISSUE_TEMPLATE/{bug_report,feature_request}.md`,
`.github/pull_request_template.md`.

- [ ] README: project summary, quick-start (`docker compose up`), env table, MVP status, license.
- [ ] CONTRIBUTING: workspace layout, dev commands, commit/test conventions.
- [ ] Commit: `docs(stage-0): add README, CONTRIBUTING, issue/PR templates`

---

## STAGE 1 — Data layer & scaffold

### Task 1.1: Prisma schema (full model)

**Files:** Create `prisma/schema.prisma`, add `prisma` + `@prisma/client` deps, `apps/server` package.

- [ ] Model every entity from product spec §3: `Game`, `Expansion`, `User`, `Person`, `Session`,
      `ExpansionSession` (composite PK), `PlayerSession` (composite PK), `UserGameRating` (composite PK),
      `UserSessionRating` (composite PK), `Category`, `GameCategory` (composite PK), `Location`,
      `SessionImage`. Enums: `GameType`, `CollectionStatus`, `Role`.
- [ ] Cascades per spec §10: Game→Expansion/Session/ratings `onDelete: Cascade`; Session.location
      `onDelete: SetNull`; Person delete cascades PlayerSession but not Session.
- [ ] `Person.user_id` is the authoritative link (unique, nullable); omit `User.person_id`.
- [ ] Commit: `feat(stage-1): add full Prisma data model`

### Task 1.2: Initial migration + seed

**Files:** Create `prisma/seed.ts`; generate `prisma/migrations/*`.

- [ ] `prisma migrate dev --name init` against local Postgres (compose db) to generate migration.
- [ ] `seed.ts`: upsert default categories (Strategi, Familie, Co-op, Kortspill) idempotently.
- [ ] Commit: `feat(stage-1): initial migration + category seed`

### Task 1.3: Express skeleton + typed config + health

**Files:** Create `apps/server/src/{config,logger,db,app,server}.ts`,
`apps/server/src/middleware/error.ts`, tests `apps/server/test/{config,health}.test.ts`.

- [ ] **Test first:** `config.test.ts` — loading config with required env unset throws; with all set returns typed object.
- [ ] `config.ts`: parse `process.env` through a zod schema (DB__, JWT_SECRET, JWT_REFRESH_SECRET
      required; PORT default 5444; DEFAULT_CURRENCY `NOK`; DEFAULT_LOCALE `en`; BGG__ defaults). Throw on invalid.
- [ ] `app.ts`: express app factory (helmet, json, request logging, routes, error middleware),
      exposes `GET /api/health` → `{ status: 'ok' }`. No `listen` here (so tests import the app).
- [ ] **Test:** `health.test.ts` (Supertest) — `GET /api/health` returns 200 `{status:'ok'}`.
- [ ] `server.ts`: run `prisma migrate deploy` then `app.listen(config.PORT)`.
- [ ] Commit: `feat(stage-1): express skeleton, typed config, health endpoint`

### Task 1.4: Client skeleton served by Express + Docker

**Files:** Create `apps/client/*` (Vite React TS), Tailwind config with mockup design tokens,
`docker/{Dockerfile,docker-compose.yml,.dockerignore}`; modify `app.ts` to serve static build.

- [ ] Scaffold Vite React-TS; Tailwind configured; `theme.css` ports mockup CSS variables
      (light/dark `data-theme`) and fonts (Space Grotesk, Hanken Grotesk).
- [ ] `App.tsx` renders a placeholder shell proving the build is served.
- [ ] `app.ts`: in production serve `apps/client/dist` statically and SPA-fallback non-`/api` routes.
- [ ] Multi-stage `Dockerfile`: build client + server, run node serving both; `docker-compose.yml`
      per product spec §8.4 (app + postgres:16-alpine, healthchecks, volumes); `migrate deploy` on boot.
- [ ] Verify `docker compose up` serves the app on `:5444` and `/api/health` passes.
- [ ] Commit: `feat(stage-1): client skeleton served by express + docker compose`

---

## STAGE 2 — Auth & users

### Task 2.1: Auth primitives (argon2 + JWT) — unit tested

**Files:** Create `apps/server/src/modules/auth/service.ts`,
`apps/server/src/middleware/auth.ts`, `packages/shared/src/auth.ts`, tests.

- [ ] `shared/src/auth.ts`: zod schemas `registerSchema`, `loginSchema`, token payload type, `Role` enum re-export.
- [ ] **Test first:** hashing — `verifyPassword(hash(pw), pw)` true, wrong pw false; JWT sign/verify
      round-trips payload; expired/invalid token rejected.
- [ ] `service.ts`: `hashPassword`, `verifyPassword` (argon2), `signAccess`/`signRefresh`/`verify*`
      using `config` secrets.
- [ ] `middleware/auth.ts`: `requireAuth` (parses Bearer, sets `req.user`), `requireRole('ADMIN')`.
      **Test:** middleware rejects missing/invalid token (401) and wrong role (403).
- [ ] Commit: `feat(stage-2): argon2 + JWT auth primitives and guards`

### Task 2.2: Auth routes + first-run bootstrap — integration tested

**Files:** Create `apps/server/src/modules/auth/routes.ts`; test
`apps/server/test/auth.int.test.ts` (Supertest + test Postgres).

- [ ] Set up integration test harness: spin Postgres (Testcontainers) or use `DATABASE_URL` test db,
      `migrate deploy`, truncate between tests.
- [ ] **Test first:** first `POST /api/auth/register` (no users) creates ADMIN; second register
      without admin token → 403; `login` returns access+refresh; `refresh` issues new access;
      `GET /api/auth/me` with token returns the user; admin-gated register with admin token succeeds.
- [ ] Implement routes to pass: register, login, refresh, me. Validate bodies with shared zod schemas.
- [ ] Commit: `feat(stage-2): auth routes with first-run admin bootstrap`

### Task 2.3: Client auth + app shell

**Files:** Create `apps/client/src/lib/{api,auth-store}.ts`,
`apps/client/src/pages/Login.tsx`, `apps/client/src/components/AppShell.tsx`,
router setup in `App.tsx`. Add `react-router-dom`, a data layer (`@tanstack/react-query`).

- [ ] `api.ts`: fetch wrapper attaching Bearer token, auto-refresh on 401 once.
- [ ] `auth-store.ts`: token storage (memory + localStorage refresh), `useAuth` hook.
- [ ] `Login.tsx`: form posting to `/api/auth/login`, mockup styling, error display.
- [ ] `AppShell.tsx`: sidebar (Dashboard/Samling/Partier/Spillere/Innstillinger), topbar with
      title/subtitle, theme toggle writing `data-theme`, user chip — matching `Tabletop.dc.html`.
- [ ] Protected route wrapper redirects to `/login` when unauthenticated.
- [ ] **Playwright smoke:** unauthenticated visit redirects to login; login renders shell.
- [ ] Commit: `feat(stage-2): client auth, login page, app shell`

---

## STAGE 3 — Games CRUD + Collection UI + basic Dashboard (→ MVP)

### Task 3.1: Games API + categories + image upload — integration tested

**Files:** Create `apps/server/src/modules/games/{service,routes}.ts`,
`apps/server/src/modules/uploads/image.ts`, `packages/shared/src/game.ts`,
test `apps/server/test/games.int.test.ts`.

- [ ] `shared/src/game.ts`: `createGameSchema`/`updateGameSchema` (all §3.2 fields, correct
      nullability + ranges: weight 1–5, `min_players ≤ max_players`, etc.), `gameQuerySchema`
      (`status`, `category`, `sort`, `q`), Game response type.
- [ ] **Test first:** create game (member token) → 201; list filters by `status`/`category`/`q`
      and sorts; get by id; patch updates; delete forbidden for member (403) but allowed for admin;
      invalid weight/`min>max` → 400; categories assigned M:N.
- [ ] `service.ts`: validated CRUD via Prisma incl. category connect; enforce member-can't-delete.
- [ ] `routes.ts`: wire endpoints from product spec §5 (`/api/games*`, `/api/categories`).
- [ ] `image.ts`: multer upload to `/app/images`, `POST /api/games/:id/image`, served statically.
- [ ] Commit: `feat(stage-3): games CRUD, categories, image upload`

### Task 3.2: Collection grid + filters + Game detail UI

**Files:** Create `apps/client/src/pages/{Collection,GameDetail}.tsx` and supporting components
(`GameCard`, `FilterBar`, `RatingBadge`, `MetaGrid`), query hooks in `src/lib/queries.ts`.

- [ ] Collection page: status segmented control (Alle/Eid/Ønskeliste), category chips, sort control,
      responsive card grid — pixel-faithful to mockup lines for the collection screen.
- [ ] Game detail page: cover, action buttons, ratings row (placeholders until Stage 7), metadata
      grid, description, expansions/history sections as empty-state placeholders (filled in Stages 4/6).
- [ ] All strings via temporary `nb` constants module (full i18n externalization is Stage 9).
- [ ] Commit: `feat(stage-3): collection grid and game detail UI`

### Task 3.3: Basic dashboard endpoint + screen

**Files:** Create `apps/server/src/modules/stats/{service,routes}.ts`,
test `apps/server/test/stats.int.test.ts`; `apps/client/src/pages/Dashboard.tsx`.

- [ ] **Test first:** `GET /api/stats/dashboard` returns `{ gamesOwned, sessions, players,
collectionValue, expansions, avgPrice }` computed from seeded data.
- [ ] `service.ts`: aggregate counts/sums via Prisma; `routes.ts` exposes the endpoint (auth required).
- [ ] `Dashboard.tsx`: KPI stat cards + collection donut + recently-added wired to real data;
      other widgets (charts, top players) as static placeholders until Stage 8.
- [ ] Commit: `feat(stage-3): basic dashboard stats endpoint and screen`

### Task 3.4: MVP E2E + tag

**Files:** Create `e2e/mvp.spec.ts`; extend `ci.yml` with Postgres service + integration + e2e jobs.

- [ ] **Playwright E2E:** first-run register admin → login → add a game via UI → game appears in
      Collection → dashboard "Spill eid" count increments.
- [ ] Extend CI: add `integration` job (Postgres service container, `migrate deploy`, Supertest) and
      `e2e` job (build, start app, run Playwright).
- [ ] Verify full CI green locally (`npm test`, integration, e2e).
- [ ] Commit: `test(stage-3): MVP end-to-end flow + CI integration/e2e jobs`
- [ ] Tag: `git tag v0.1.0-mvp`

---

## Self-review notes

- **Spec coverage:** Stages 0–3 map to product spec build-order items 1–3 and design-spec Stages 0–3.
  Expansions/People/Sessions/Ratings/full-stats/i18n/v2 are intentionally deferred to later plans
  (Stages 4–10) and stubbed as placeholders here so the UI shells exist without dead promises.
- **Deferred-but-referenced:** ratings row, expansions list, play history, charts, and top-players
  widgets render as explicit empty-state/placeholder components in Stage 3, replaced in their stages.
- **Security gates:** Trivy/CodeQL/Semgrep image+SAST scanning and GHCR release are wired in Stage 10.3
  per the design spec; Stage 0–3 CI covers lint/typecheck/unit/integration/e2e + gitleaks + dependabot.
