# Tabletop Tracker — Build Design & Staged Plan

> Companion to `tabletop-design-spec.md` (the product/data spec) and the
> `Tabletop.dc.html` design handoff. This document records the **build-time decisions**
> and the **staged task breakdown** that turn that spec into a working, tested,
> CI/CD-gated application. The product spec remains authoritative for the data model,
> API surface, and feature semantics; this document is authoritative for repo layout,
> tooling, testing, and build order.

Date: 2026-06-30
Status: Approved (design phase)

---

## 1. Decisions locked in

| Decision            | Choice                                         | Rationale                                                                                                                                                   |
| ------------------- | ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| First MVP milestone | **Thin vertical slice** (Stages 0–3)           | Fastest path to a runnable, clickable app; everything else layers on incrementally.                                                                         |
| App architecture    | **Combined single app image**                  | Express serves the built React bundle + `/api`; deploys as one `app` + one `db` container, exactly as the product spec's compose file describes.            |
| Repo structure      | **npm workspaces monorepo**                    | `apps/server`, `apps/client`, `packages/shared`.                                                                                                            |
| Testing stack       | **Vitest + Supertest + Playwright**            | Vitest for unit (FE+BE), Supertest for API integration against real Postgres, Playwright for E2E. TS-native and fast.                                       |
| CI/CD depth         | **Full gauntlet**                              | Lint, typecheck, unit/integration/e2e, `npm audit`, Trivy image scan, CodeQL + Semgrep SAST, Gitleaks secret scan, Dependabot; build & push to GHCR on tag. |
| Package manager     | **npm**                                        | Simplest; matches product spec assumptions.                                                                                                                 |
| Person/User link    | **`Person.user_id` is authoritative**          | Per product spec §3.5 recommendation; `User.person_id` omitted/derived to avoid drift.                                                                      |
| Member permissions  | Members add/edit games; **only admins delete** | Per product spec §6 recommendation.                                                                                                                         |
| Password hashing    | **argon2**                                     | Modern default; spec allows argon2/bcrypt.                                                                                                                  |
| Image storage       | Local volume `/app/images` via multer          | No S3 dependency by default.                                                                                                                                |
| Logging             | **pino** structured logs to `/app/logs`        | Operability per spec §12.                                                                                                                                   |

---

## 2. Repository layout

```
Tabletop/
├─ apps/
│  ├─ server/        # Express + TypeScript + Prisma (API under /api, serves client build)
│  └─ client/        # React + Vite + TypeScript (Radix UI + Tailwind, react-i18next)
├─ packages/
│  └─ shared/        # shared TS types + zod schemas (API contracts, enums) used by both
├─ prisma/           # schema.prisma, migrations, seed.ts
├─ docker/           # Dockerfile (multi-stage), docker-compose.yml, .dockerignore
├─ .github/workflows/ # ci.yml, release.yml; plus dependabot.yml
├─ docs/superpowers/specs/
└─ package.json      # workspace root, shared scripts
```

The `shared` package holds **zod schemas as the single source of truth** for request/response
validation and the inferred TypeScript types. The server validates incoming payloads with them;
the client imports the same inferred types — so the API contract cannot drift between the two.

---

## 3. Key technical conventions

- **Validation:** zod at every API boundary. Cross-entity integrity rules (product spec §10) —
  every `expansionId` belongs to the session's `gameId`, a session has ≥1 player, ratings in
  1.0–10.0, `min_players ≤ max_players`, etc. — live in a **service layer**, not in controllers.
- **Auth:** JWT access (short-lived) + refresh (long-lived); argon2 password hashes.
  `JWT_SECRET` and `JWT_REFRESH_SECRET` are required and **fail-fast on boot** if unset.
  First-run bootstrap: if no users exist, the first registration creates the initial `ADMIN`;
  afterwards registration is admin-gated (no open public signup).
- **Config:** all environment variables parsed and validated once through a typed config module
  that throws on missing required vars (mirrors the fail-fast requirement).
- **Migrations:** `prisma migrate deploy` runs on app startup before the server binds; seed script
  creates default categories and supports the first-admin path.
- **Frontend design tokens:** the mockup's CSS custom properties (`--bg`, `--card`, `--accent`,
  `--border`, light/dark `data-theme` blocks) and fonts (Space Grotesk for display, Hanken Grotesk
  for body) become the Tailwind theme + CSS variables. Light/dark themes via `data-theme`.
- **i18n:** **zero hardcoded UI strings.** All strings via react-i18next namespaces
  (`common`, `games`, `sessions`, `players`, `dashboard`, `settings`), lazy-loaded. Ship `nb`
  (Norwegian Bokmål, default per mockup) + `en`. API responses are data-only with stable enum
  codes; the client localizes labels. `Intl` for dates/numbers/currency (default `NOK`/`kr`).
- **Operability:** `/api/health` endpoint; structured pino logs.

---

## 4. Testing strategy

- **Unit (Vitest):** services, validation, utilities, React components/hooks. Run in both
  `apps/server` and `apps/client`.
- **Integration (Supertest):** exercises the real Express app against a throwaway PostgreSQL —
  Testcontainers locally, a Postgres service container in CI — with migrations applied per run.
  Covers auth flows, CRUD, and the cross-entity validation rules.
- **E2E (Playwright):** the headline user journeys — login → add a game → log a play →
  see it reflected on the dashboard; plus the 3-step "Log a play" modal flow.
- Coverage thresholds enforced on the service/validation layer where the integrity rules live.

---

## 5. CI/CD pipeline

**`ci.yml` (every pull request and push to main):**

1. Install (npm ci, cached)
2. Lint — ESLint + Prettier check
3. Typecheck — `tsc --noEmit` across workspaces
4. Unit tests — Vitest
5. Integration tests — Supertest against a Postgres service container
6. Build — client (Vite) + server (tsc/esbuild)
7. Build Docker image
8. **Trivy** image + filesystem vulnerability scan
9. **CodeQL** + **Semgrep** SAST
10. **Gitleaks** secret scan
11. **Playwright** E2E against the built image
    All gates required to merge. **Dependabot** + `npm audit` keep dependencies current.

**`release.yml` (on `v*` semver tag):** rebuild → scan → push semver-tagged image to **GHCR**
(no reliance on `latest` in production; pin a version).

---

## 6. Staged build plan — each sub-task is its own commit

### Stage 0 — Foundation & tooling

- **0.1** npm workspace root, TS base configs, ESLint + Prettier, `.gitignore`, `.env.example`
- **0.2** Vitest + Playwright config, one sample passing test, husky pre-commit (lint + typecheck)
- **0.3** `ci.yml` skeleton (lint / typecheck / test), `dependabot.yml`, Gitleaks config
- **0.4** README quick-start, CONTRIBUTING, issue templates

### Stage 1 — Data layer & scaffold

- **1.1** Prisma schema: full model from product spec §3 — Game, Expansion, User, Person, Session,
  ExpansionSession, PlayerSession, UserGameRating, UserSessionRating, Category, GameCategory,
  Location, SessionImage, and enums (GameType, CollectionStatus, Role) — with relations & cascades
- **1.2** Initial migration + seed (default categories, first-admin path)
- **1.3** Express app skeleton, typed config module (fail-fast env), pino logging, `/api/health`
- **1.4** Vite React app skeleton served through Express; Docker multi-stage build + compose;
  `prisma migrate deploy` on boot

### Stage 2 — Auth & users

- **2.1** argon2 + JWT access/refresh service, auth middleware, role guards (unit-tested)
- **2.2** `/api/auth` register / login / refresh / me + first-run admin bootstrap (integration-tested)
- **2.3** Client auth: login page, token storage + silent refresh, protected routes, app shell
  (sidebar + topbar + theme toggle) matching the mockup

### Stage 3 — Games CRUD + Collection UI + basic Dashboard → first runnable MVP

- **3.1** Games API: list (filter / sort / search), get, create, patch, delete, image upload; categories
- **3.2** Collection grid + filter bar + Game detail page (mockup-faithful)
- **3.3** Minimal `/api/stats/dashboard` + Dashboard screen wired to real data
- **3.4** Playwright E2E: login → add game → see it in collection + dashboard. **Tag `v0.1.0-mvp`.**

### Stage 4 — Expansions

- **4.1** Expansions API (CRUD, belongs-to-game validation)
- **4.2** Game-detail expansions section UI (add / edit / delete)

### Stage 5 — People

- **5.1** People API (CRUD, optional user-account link)
- **5.2** Players page UI

### Stage 6 — Sessions (core flow)

- **6.1** Sessions API: create (validate `expansionIds ∈ game`, ≥1 player, players[]),
  list / filter, get, patch, delete, session image upload
- **6.2** "Log a play" 3-step modal + Sessions list + Session detail UI
- **6.3** E2E: full log-a-play flow

### Stage 7 — Ratings

- **7.1** `UserGameRating` + `UserSessionRating` upsert APIs (per-user, 1.0–10.0)
- **7.2** Rating UI on game + session pages; average session-rating aggregation per game

### Stage 8 — Dashboard & stats (full)

- **8.1** `/api/stats/dashboard | players | games/:id` (totals, collection value, most-played,
  top players by win share, sessions-per-day, recently added, owned/wishlist breakdown)
- **8.2** Full dashboard widgets + players stats wired up

### Stage 9 — i18n & settings

- **9.1** Externalize all strings, `nb` + `en` namespaces, language switcher persisted to user locale
- **9.2** Settings page (theme, accent, currency, locale, export/import stub, BGG toggle)

### Stage 10 — v2 seams & polish

- **10.1** `BggRatingProvider` interface + `CsvDumpProvider` stub + `/api/sync/bgg` (disabled by default)
- **10.2** Shelf-of-shame + wishlist views; JSON / CSV export
- **10.3** `release.yml` GHCR publish + full Trivy / CodeQL / Semgrep wired into CI

**The thin-slice MVP is Stages 0 → 3**, ending at a tagged, runnable `v0.1.0-mvp`.
Each stage afterward is independently shippable.

---

## 7. Out of scope (v1)

Per product spec §1 Non-Goals: no mandatory live BGG API integration (seams only), no native
mobile app (responsive web), no rulebook RAG/AI, no multi-tenant SaaS concerns. v2 items
(loans, game nights, score-sheet templates, statistics deep-dive, full BGG sync) are deferred —
their schema/interface seams are placed in Stage 10 but not wired to real providers.
