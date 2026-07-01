# Board Game Tracker — Design Specification

> A self-hosted, open-source board game collection and play-session tracker.
> This document is a build-ready handover spec. It defines the data model, API surface,
> feature set, architecture, and deployment shape. It is intentionally implementation-detailed
> so it can be handed directly to a developer or coding agent.

---

## 1. Goals & Non-Goals

### Goals

- Self-hosted, runs as two Docker containers (app + PostgreSQL) on a home NAS/server.
- Track a **board game collection** with rich, BGG-like metadata — entered **manually**, no hard dependency on any external API.
- Track **expansions** as first-class objects attached to a base game (never as standalone games).
- Log **play sessions**: pick a game, pick which expansions were used, record players, scores, winner, duration, location.
- Support **two kinds of personal rating**: a per-user rating of a _game_ overall, and a per-user rating of an individual _session/play_.
- **Multi-user** with roles.
- **i18n** — UI translatable to multiple languages.
- Optional, pluggable **BGG rating sync** that can be wired up later without schema changes.

### Non-Goals (v1)

- No live, mandatory BGG API integration. (BGG closed their XML API behind a registered Bearer token as of July 2025; see §9.)
- No mobile native app (responsive web is sufficient).
- No rulebook RAG / AI features.
- No public/multi-tenant SaaS concerns — single household/group instance.

---

## 2. Technology Stack

| Layer         | Choice                                                     | Rationale                                                                          |
| ------------- | ---------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Frontend      | **React + Vite + TypeScript**                              | Type-safe, fast dev loop, large ecosystem.                                         |
| UI components | **Radix UI** (or Mantine) + Tailwind                       | Accessible primitives; matches a clean dashboard aesthetic.                        |
| i18n          | **react-i18next** + `i18next`                              | De-facto standard; JSON locale files, lazy-loaded namespaces.                      |
| Backend       | **Node.js + Express + TypeScript**                         | Same language as frontend; simple, well-understood.                                |
| ORM           | **Prisma**                                                 | Type-safe schema + first-class migrations; schema maps cleanly to the model below. |
| Database      | **PostgreSQL 16** (`postgres:16-alpine` image)             | Relational model fits; alpine keeps image small.                                   |
| Auth          | **JWT (access + refresh)**, bcrypt/argon2 password hashing | Stateless, standard.                                                               |
| File storage  | Local volume for uploaded images (`/app/images`)           | No S3 dependency by default; S3 optional later.                                    |
| Container     | **Docker + Docker Compose**                                | Two services: `app`, `db`.                                                         |
| CI            | GitHub Actions → build & push image to GHCR                | For open-source release.                                                           |

> Single combined app image (Express serves the built React static bundle + the API under `/api`) keeps deployment to **one app container + one db container**. A split frontend/backend image is allowed but not required.

---

## 3. Core Data Model

All tables use integer surrogate primary keys (`id`) unless noted. All timestamps are `timestamptz`.
Naming below is conceptual; Prisma model names in PascalCase, table names snake_case.

### 3.1 Entity overview

```
User ──< UserGameRating >── Game
User ──(optional)── Person
Person ──< PlayerSession >── Session ──>── Game
Game ──< Expansion
Session ──< ExpansionSession >── Expansion
Game ──>── Location (via Session)
User ──< UserSessionRating >── Session
Game ──(status)── Collection state (Owned | Wishlist)
```

### 3.2 `Game`

The central entity. Mirrors the fields BGG exposes, but all are user-editable and none require an API.

| Field             | Type                   | Notes                                                  |
| ----------------- | ---------------------- | ------------------------------------------------------ |
| id                | int PK                 |                                                        |
| title             | text                   | required                                               |
| image_path        | text nullable          | path/URL to uploaded cover image                       |
| release_year      | int nullable           |                                                        |
| min_players       | int nullable           |                                                        |
| max_players       | int nullable           |                                                        |
| min_playtime      | int nullable           | minutes                                                |
| max_playtime      | int nullable           | minutes                                                |
| min_age           | int nullable           | age rating (e.g. 10 → "10+")                           |
| weight            | decimal(3,2) nullable  | complexity, 1.00–5.00 (BGG-style)                      |
| description       | text nullable          |                                                        |
| type              | enum nullable          | see GameType (§3.9)                                    |
| price             | decimal(10,2) nullable | optional purchase price                                |
| currency          | text                   | ISO 4217 or symbol; instance default (e.g. `NOK`/`kr`) |
| collection_status | enum                   | `OWNED` \| `WISHLIST` (default `OWNED`)                |
| date_added        | date nullable          | date added to collection                               |
| bgg_id            | int nullable           | optional link to BGG thing id (for future sync)        |
| bgg_rating        | decimal(4,2) nullable  | populated by sync only; read-only in UI                |
| bgg_rank          | int nullable           | populated by sync only                                 |
| bgg_synced_at     | timestamptz nullable   | last successful sync for this game                     |
| created_at        | timestamptz            |                                                        |
| updated_at        | timestamptz            |                                                        |

**Many-to-many:** `Game` ↔ `Category` (a game can have several categories).
**One-to-many:** `Game` → `Expansion`, `Game` → `Session`.

### 3.3 `Expansion`

An expansion belongs to exactly one base game. Carries the **same metadata fields as a Game**
(an expansion can have its own player count, playtime, price, image, BGG id, etc.), but is never
counted as a game and never appears in the games list as a standalone entry.

| Field         | Type                   | Notes                         |
| ------------- | ---------------------- | ----------------------------- |
| id            | int PK                 |                               |
| game_id       | int FK → Game          | required; `ON DELETE CASCADE` |
| title         | text                   | required                      |
| image_path    | text nullable          |                               |
| release_year  | int nullable           |                               |
| min_players   | int nullable           |                               |
| max_players   | int nullable           |                               |
| min_playtime  | int nullable           |                               |
| max_playtime  | int nullable           |                               |
| min_age       | int nullable           |                               |
| weight        | decimal(3,2) nullable  |                               |
| description   | text nullable          |                               |
| price         | decimal(10,2) nullable |                               |
| date_added    | date nullable          |                               |
| bgg_id        | int nullable           |                               |
| bgg_rating    | decimal(4,2) nullable  | sync-only                     |
| bgg_rank      | int nullable           | sync-only                     |
| bgg_synced_at | timestamptz nullable   |                               |
| created_at    | timestamptz            |                               |
| updated_at    | timestamptz            |                               |

> Implementation note: because Game and Expansion share almost all fields, the developer may
> model shared columns via a common Prisma type/composition or simply duplicate the columns.
> Do **not** merge them into one table with a self-referencing "is_expansion" flag — keeping them
> separate matches the domain (an expansion cannot exist without its parent) and keeps the
> games list query clean.

### 3.4 `User` (login account)

| Field         | Type                     | Notes                                    |
| ------------- | ------------------------ | ---------------------------------------- |
| id            | int PK                   |                                          |
| username      | text uniq                |                                          |
| email         | text uniq nullable       |                                          |
| password_hash | text                     | argon2/bcrypt                            |
| role          | enum                     | `ADMIN` \| `MEMBER` (see §6)             |
| locale        | text                     | preferred UI language, e.g. `en`, `nb`   |
| person_id     | int FK → Person nullable | optional link to the Person they play as |
| created_at    | timestamptz              |                                          |
| updated_at    | timestamptz              |                                          |

### 3.5 `Person` (player, may or may not have an account)

Separating Person from User lets you log sessions for friends/family who don't have logins.

| Field      | Type                   | Notes                                       |
| ---------- | ---------------------- | ------------------------------------------- |
| id         | int PK                 |                                             |
| name       | text                   | display name                                |
| image_path | text nullable          | avatar                                      |
| user_id    | int FK → User nullable | set if this person also has a login account |
| created_at | timestamptz            |                                             |

> A `User` may optionally be linked to a `Person` (via `User.person_id`) and/or a `Person` may
> reference back to a `User` (`Person.user_id`). Pick **one** direction to be authoritative to
> avoid drift — recommend `Person.user_id` as the source of truth, with `User.person_id` derived
> or omitted. The developer should choose one and document it.

### 3.6 `Session` (a single play of a game)

| Field       | Type                       | Notes                           |
| ----------- | -------------------------- | ------------------------------- |
| id          | int PK                     |                                 |
| game_id     | int FK → Game              | required; `ON DELETE CASCADE`   |
| location_id | int FK → Location nullable | `ON DELETE SET NULL`            |
| start       | timestamptz                | required                        |
| end         | timestamptz nullable       | duration derived from start/end |
| comment     | text nullable              |                                 |
| created_at  | timestamptz                |                                 |

**Joins:**

- `Session` ↔ `Expansion` via **`ExpansionSession`** (which expansions were used this play).
- `Session` ↔ `Person` via **`PlayerSession`** (who played + their result).
- `Session` → images via `SessionImage` (optional photos of the play).

### 3.7 `ExpansionSession` (join: expansions used in a session)

| Field        | Type               | Notes                                  |
| ------------ | ------------------ | -------------------------------------- |
| expansion_id | int FK → Expansion | composite PK part; `ON DELETE CASCADE` |
| session_id   | int FK → Session   | composite PK part; `ON DELETE CASCADE` |

Composite primary key `(expansion_id, session_id)`.
**Validation:** every expansion linked to a session must belong to that session's `game_id`.
Enforce in the API layer (and optionally a DB trigger).

### 3.8 `PlayerSession` (join: a person's participation & result in a session)

| Field      | Type                      | Notes                                                              |
| ---------- | ------------------------- | ------------------------------------------------------------------ |
| person_id  | int FK → Person           | composite PK part; `ON DELETE CASCADE`                             |
| session_id | int FK → Session          | composite PK part; `ON DELETE CASCADE`                             |
| score      | double precision nullable | points in this play                                                |
| won        | boolean                   | default false                                                      |
| first_play | boolean                   | default false — was this the person's first time playing this game |
| color/seat | text nullable             | optional (faction/color/seat order)                                |

Composite primary key `(person_id, session_id)`.

### 3.9 Ratings — **two separate tables** (this is the headline feature)

The user explicitly wants both a per-user rating of a **game** and a per-user rating of a **session/play**.

**`UserGameRating`** — how much a user likes a game overall:

| Field      | Type          | Notes                      |
| ---------- | ------------- | -------------------------- |
| user_id    | int FK → User | composite PK part          |
| game_id    | int FK → Game | composite PK part          |
| rating     | decimal(3,1)  | 1.0–10.0 (BGG-style scale) |
| review     | text nullable | optional written note      |
| updated_at | timestamptz   |                            |

Composite PK `(user_id, game_id)` — one overall rating per user per game.

**`UserSessionRating`** — how much a user enjoyed a specific play:

| Field      | Type             | Notes             |
| ---------- | ---------------- | ----------------- |
| user_id    | int FK → User    | composite PK part |
| session_id | int FK → Session | composite PK part |
| rating     | decimal(3,1)     | 1.0–10.0          |
| note       | text nullable    |                   |
| updated_at | timestamptz      |                   |

Composite PK `(user_id, session_id)`.

> Rationale for both: the per-game rating drives collection sorting/filtering ("my favourites");
> the per-session rating captures that a _particular_ play was great or terrible (bad group,
> learning game, etc.) independent of how you feel about the game in general. Aggregations can
> show average session rating per game alongside the user's standing game rating.

### 3.10 Supporting entities

**`Category`** — `id`, `name` (unique). M:N with Game via `GameCategory(game_id, category_id)`.
**`Location`** — `id`, `name`, optional `address`. Referenced by Session.
**`SessionImage`** — `id`, `session_id` FK, `image_path`. (Mirror of BGT's `Image`/`PlayId`.)

### 3.11 Enums

- **GameType:** `BOARD_GAME`, `CARD_GAME`, `DICE_GAME`, `MINIATURES`, `RPG`, `OTHER` (extendable).
- **CollectionStatus:** `OWNED`, `WISHLIST`.
- **Role:** `ADMIN`, `MEMBER`.

---

## 4. Feature Set

### 4.1 v1 (MVP — build first)

1. **Auth & users** — register (admin-gated), login, JWT sessions, role enforcement, per-user locale.
2. **Games CRUD** — create/edit/delete games with all metadata fields; image upload; set OWNED/WISHLIST; assign categories.
3. **Expansions** — add/edit/delete expansions on a game's detail page (the gap BGT's UI is missing). Same metadata form as games.
4. **People CRUD** — manage players; optionally link to a user account.
5. **Sessions** — log a play: select game → select 0..N expansions (only those belonging to the game) → add players with score/won/first-play → start/end time → location → comment → optional photos.
6. **Ratings** — per-user game rating (on game page) and per-user session rating (on session page).
7. **Dashboard** — totals (games, players, sessions, collection value, average cost, expansions count), recent activity, most-played games, recently added, top players, collection owned/wishlist breakdown, sessions-per-day chart.
8. **i18n** — all UI strings externalized; language switcher; ship at least `en` + one more (e.g. `nb` Norwegian Bokmål).

### 4.2 v2 (nice-to-have, design seams now)

- **BGG rating sync** (pluggable — see §9). Disabled by default.
- **Wishlist view** as its own page (distinct from owned collection).
- **"Shelf of Shame"** — owned games with zero sessions (a derived view, no schema needed).
- **Loans** — track who borrowed a game (mirror BGT's Loans).
- **Game nights** — schedule events, RSVP, link multiple sessions to one night.
- **Statistics deep-dive** — per-player win rates, average scores per game, expansion impact on play length, rating trends over time.
- **Score-sheet templates** — define custom scoring categories per game (idea borrowed from MeepleStats).
- **Export/Import** — JSON or CSV backup of the whole collection.

---

## 5. API Surface (REST, `/api` prefix)

All endpoints JSON. Auth via `Authorization: Bearer <jwt>`. Standard REST verbs.

```
POST   /api/auth/register           (admin only after first-run bootstrap)
POST   /api/auth/login
POST   /api/auth/refresh
GET    /api/auth/me

GET    /api/games                   ?status=OWNED|WISHLIST&category=&sort=&q=
POST   /api/games
GET    /api/games/:id
PATCH  /api/games/:id
DELETE /api/games/:id
POST   /api/games/:id/image         (multipart upload)

GET    /api/games/:id/expansions
POST   /api/games/:id/expansions
PATCH  /api/expansions/:id
DELETE /api/expansions/:id

GET    /api/people
POST   /api/people
PATCH  /api/people/:id
DELETE /api/people/:id

GET    /api/sessions                ?game=&person=&from=&to=
POST   /api/sessions                (body includes expansionIds[], players[])
GET    /api/sessions/:id
PATCH  /api/sessions/:id
DELETE /api/sessions/:id
POST   /api/sessions/:id/image

PUT    /api/games/:id/rating        (upsert current user's game rating)
PUT    /api/sessions/:id/rating     (upsert current user's session rating)

GET    /api/categories
POST   /api/categories
GET    /api/locations
POST   /api/locations

GET    /api/stats/dashboard
GET    /api/stats/players
GET    /api/stats/games/:id

POST   /api/sync/bgg                 (v2; admin; triggers a sync run — see §9)
GET    /api/health
```

**Session create payload example:**

```json
{
  "gameId": 12,
  "start": "2026-06-30T18:00:00Z",
  "end": "2026-06-30T19:25:00Z",
  "locationId": 3,
  "comment": "Close game",
  "expansionIds": [5, 8],
  "players": [
    { "personId": 1, "score": 92, "won": true, "firstPlay": false },
    { "personId": 4, "score": 88, "won": false, "firstPlay": true }
  ]
}
```

API must validate that every id in `expansionIds` belongs to `gameId`.

---

## 6. Auth & Roles

- **Roles:** `ADMIN`, `MEMBER`.
  - **ADMIN:** full CRUD on everything; can create/manage users; can trigger BGG sync; manage categories/locations.
  - **MEMBER:** can view all data; create/edit sessions; manage their own ratings; edit games/expansions (configurable — recommend allowing members to add games but only admins to delete).
- **First-run bootstrap:** if no users exist, the first registration creates the initial `ADMIN`. After that, registration is admin-gated (no open public signup).
- **Required env:** `JWT_SECRET` (fail fast on startup if unset — like BGT does). Document this clearly so it isn't a surprise crash.
- **Ratings are per-user**, so the JWT subject scopes every rating read/write.

---

## 7. Internationalization (i18n)

- **Frontend:** `react-i18next`. All user-facing strings come from locale JSON files under `src/locales/<lang>/<namespace>.json`. No hardcoded strings in components.
- **Namespaces:** split by area (`common`, `games`, `sessions`, `players`, `dashboard`, `settings`) and lazy-load.
- **Language switching:** runtime switch persisted to the user's `locale` field and to `localStorage` for pre-login.
- **Ship languages:** `en` (source) + `nb` (Norwegian Bokmål) at minimum. Structure so adding a language is "drop in a folder of JSON."
- **Backend:** keep API responses data-only (no localized prose); the frontend localizes. Enum values returned as stable codes (`OWNED`), localized labels live in the frontend.
- **Formatting:** use `Intl` for dates/numbers/currency; currency symbol/code is an instance setting (default `NOK`/`kr`).
- **Translation management (optional):** Crowdin integration for community translations (BGT uses this).

---

## 8. Deployment

### 8.1 Container topology

Two containers via Docker Compose:

- **`app`** — combined Node/Express API + served React static bundle. Exposes one HTTP port (default **5470**, configurable).
- **`db`** — `postgres:16-alpine`, data persisted to a named volume / bind mount.

### 8.2 Volumes

- `./images:/app/images` — uploaded cover art & avatars & session photos.
- `./logs:/app/logs` — app logs.
- `./postgres-data:/var/lib/postgresql/data` — DB data.

### 8.3 Environment variables (`app`)

| Var                  | Required | Default    | Purpose                              |
| -------------------- | -------- | ---------- | ------------------------------------ |
| `DB_HOST`            | yes      | `db`       | Postgres host (compose service name) |
| `DB_PORT`            | no       | `5432`     |                                      |
| `DB_USER`            | yes      | —          |                                      |
| `DB_PASSWORD`        | yes      | —          |                                      |
| `DB_NAME`            | yes      | `tabletop` |                                      |
| `JWT_SECRET`         | **yes**  | —          | **fail fast if unset**               |
| `JWT_REFRESH_SECRET` | yes      | —          |                                      |
| `PORT`               | no       | `5470`     | app HTTP port                        |
| `TZ`                 | no       | `UTC`      | timezone                             |
| `DEFAULT_CURRENCY`   | no       | `NOK`      | instance currency code               |
| `DEFAULT_LOCALE`     | no       | `en`       | fallback UI language                 |
| `BGG_SYNC_ENABLED`   | no       | `false`    | master switch for §9                 |
| `BGG_SYNC_PROVIDER`  | no       | `csv`      | `csv` \| `xmlapi`                    |
| `BGG_API_TOKEN`      | no       | —          | only if provider=`xmlapi`            |

### 8.4 Example `docker-compose.yml`

```yaml
services:
  app:
    image: ghcr.io/<owner>/boardgame-tracker:latest # pin a version in production
    container_name: boardgame-tracker
    restart: unless-stopped
    depends_on:
      db:
        condition: service_healthy
    ports:
      - '5470:5470'
    volumes:
      - ./images:/app/images
      - ./logs:/app/logs
    environment:
      - DB_HOST=db
      - DB_USER=tabletop
      - DB_PASSWORD=__CHANGEME__
      - DB_NAME=tabletop
      - DB_PORT=5432
      - JWT_SECRET=__CHANGEME_64_HEX__
      - JWT_REFRESH_SECRET=__CHANGEME_64_HEX__
      - TZ=Europe/Oslo
      - DEFAULT_CURRENCY=NOK
      - DEFAULT_LOCALE=nb
    healthcheck:
      test: ['CMD', 'curl', '-f', 'http://localhost:5470/api/health']
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 15s

  db:
    image: postgres:16-alpine
    container_name: boardgame-tracker-db
    restart: unless-stopped
    volumes:
      - ./postgres-data:/var/lib/postgresql/data
    environment:
      - POSTGRES_DB=tabletop
      - POSTGRES_USER=tabletop
      - POSTGRES_PASSWORD=__CHANGEME__
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U tabletop -d tabletop']
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 10s
```

### 8.5 Migrations

- Prisma migrations run automatically on app startup (`prisma migrate deploy`) before the server binds.
- Seed script creates default categories and (on first run) prompts/admits the first admin.

---

## 9. BGG Rating Sync (pluggable, ship disabled)

**Context:** BoardGameGeek closed its XML API behind **registration + a Bearer token** (effective ~July 2025), with manual approval that can take a week or more. A personal tracker therefore should **not** hard-depend on it. This spec makes BGG sync optional and abstracted so it can be wired up later without touching the schema.

### 9.1 Design

- Define a `BggRatingProvider` interface:
  ```ts
  interface BggRatingProvider {
    // returns { bggId, rating, rank } for the given bgg ids (or all known)
    fetchRatings(bggIds: number[]): Promise<BggRating[]>;
  }
  ```
- **Two implementations:**
  1. **`CsvDumpProvider` (default, no token):** downloads BGG's public ranks CSV data dump
     (`boardgamegeek.com/data_dumps/bg_ranks`), parses it, and matches rows to local games by `bgg_id`.
     Not real-time but requires no authentication. Good enough for "what's this game's rating/rank."
  2. **`XmlApiProvider` (optional, token-gated):** calls the BGG XML API2 `thing` endpoint with
     `Authorization: Bearer <BGG_API_TOKEN>`. Only used when an approved token is configured.
- Selected via `BGG_SYNC_PROVIDER`. Master switch `BGG_SYNC_ENABLED=false` by default.

### 9.2 Behaviour

- Sync writes only `bgg_rating`, `bgg_rank`, `bgg_synced_at` on Game/Expansion. These fields are
  **read-only in the UI** (clearly distinguished from the user's own rating).
- Trigger: admin-initiated (`POST /api/sync/bgg`) and/or a scheduled job (cron-style, configurable).
- Games with no `bgg_id` are skipped. The UI offers an optional "BGG ID" field on the game form so
  users can opt a game into sync.
- Rate-limit / back off politely; cache the CSV dump locally and refresh at most daily.

### 9.3 v1 scope

- Ship the **schema fields**, the **provider interface**, the **`/api/sync/bgg` stub**, and a UI
  "BGG ID" input — but the actual fetch can be a no-op/`CsvDumpProvider` stub. This is the
  "seams in place, wire up later" approach the project owner requested.

---

## 10. Validation & Integrity Rules

1. An `Expansion.game_id` must reference an existing Game.
2. Every `ExpansionSession.expansion_id` must belong to the same game as the session's `game_id` — enforce in API; optionally a DB trigger.
3. A session must have **at least one** `PlayerSession`.
4. `won = true` is allowed for multiple players (cooperative games / ties) — do **not** hard-constrain to a single winner.
5. Ratings constrained to 1.0–10.0.
6. `min_players ≤ max_players`, `min_playtime ≤ max_playtime`, `min_age ≥ 0` where present.
7. Deleting a Game cascades to its Expansions, Sessions, ratings, and join rows.
8. Deleting a Person cascades their `PlayerSession` rows but must not delete the Sessions themselves.
9. Currency stored per-game but defaults to the instance `DEFAULT_CURRENCY`.

---

## 11. Suggested Build Order

1. **Scaffold** — repo, Docker Compose, Prisma schema (§3), migrations, `/api/health`.
2. **Auth** — users, roles, JWT, first-run admin bootstrap (§6).
3. **Games CRUD + image upload** — including categories and OWNED/WISHLIST.
4. **Expansions** — the BGT gap; full CRUD on the game detail page.
5. **People CRUD.**
6. **Sessions** — the core flow: game + expansions + players + scores.
7. **Ratings** — both `UserGameRating` and `UserSessionRating`.
8. **Dashboard + stats endpoints.**
9. **i18n** — externalize strings, add `nb`, language switcher.
10. **Polish** — wishlist view, shelf-of-shame derived view, export/import.
11. **v2 seams** — BGG sync provider interface + stub (§9), loans, game nights.

---

## 12. Open Source & Repo Hygiene

- **License:** MIT (matches the genre; permissive for a portfolio project).
- **README:** quick-start compose, env table, screenshots, feature list, BGG-sync caveat.
- **CI:** GitHub Actions — lint, test, build, push image to GHCR on tagged release.
- **Versioning:** semver tags; publish image tags per release (do **not** rely on `latest` only — pin in prod).
- **CONTRIBUTING.md** + issue templates; optional Crowdin for translations.
- **Healthcheck endpoint** and structured logs for operability.

---

_End of specification._
