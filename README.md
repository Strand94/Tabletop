# Tabletop

> A self-hosted, open-source board game collection and play-session tracker.

Track your board game **collection** (with rich, BGG-like metadata entered manually),
manage **expansions** as first-class objects, log **play sessions** (players, scores,
winners, duration, location), and keep **two kinds of personal rating** — one for a game
overall and one for an individual play. Multi-user with roles, fully translatable UI,
and an optional, pluggable BGG rating sync that can be wired up later.

Runs as **two containers** (app + PostgreSQL) on a home NAS or server.

> **Status:** early development. The first milestone is `v0.1.0-mvp` (auth + games +
> collection + a basic dashboard). See [the build plan](docs/superpowers/plans/2026-06-30-tabletop-mvp-slice.md)
> and [design spec](docs/superpowers/specs/2026-06-30-tabletop-tracker-design.md).

## Quick start (Docker)

```bash
cp .env.example .env
# Edit .env: set DB_PASSWORD and generate two secrets:
#   openssl rand -hex 32   # -> JWT_SECRET
#   openssl rand -hex 32   # -> JWT_REFRESH_SECRET
# Run from the repo root so --env-file picks up the root .env:
docker compose --env-file .env -f docker/docker-compose.yml up -d --build
```

> The container derives its database URL from `DB_HOST=db`; the `DATABASE_URL`
> in `.env` (pointing at `localhost`) is only used for local, non-Docker development.

The app is served on `http://localhost:5444`. The **first account you register becomes the
admin**; afterwards registration is admin-gated.

## Local development

```bash
npm install
npm run dev        # start the API + client in watch mode
npm test           # unit tests (Vitest)
npm run lint       # ESLint
npm run typecheck  # tsc --noEmit across workspaces
```

This is an npm-workspaces monorepo:

| Path              | Responsibility                                                         |
| ----------------- | ---------------------------------------------------------------------- |
| `apps/server`     | Express + Prisma API; also serves the built client bundle under `/`.   |
| `apps/client`     | React + Vite + TypeScript UI (Radix UI + Tailwind, react-i18next).     |
| `packages/shared` | zod schemas + inferred types — the single source of truth for the API. |
| `prisma`          | Database schema, migrations, seed.                                     |
| `docker`          | Dockerfile + docker-compose.                                           |

## Configuration

All configuration is via environment variables (see [`.env.example`](.env.example)):

| Var                  | Required | Default            | Purpose                           |
| -------------------- | -------- | ------------------ | --------------------------------- |
| `DB_HOST`            | yes      | `db`               | Postgres host                     |
| `DB_PORT`            | no       | `5432`             | Postgres port                     |
| `DB_USER`            | yes      | —                  | Postgres user                     |
| `DB_PASSWORD`        | yes      | —                  | Postgres password                 |
| `DB_NAME`            | yes      | `boardgametracker` | Database name                     |
| `JWT_SECRET`         | **yes**  | —                  | Access-token secret (fail-fast)   |
| `JWT_REFRESH_SECRET` | **yes**  | —                  | Refresh-token secret (fail-fast)  |
| `PORT`               | no       | `5444`             | App HTTP port                     |
| `TZ`                 | no       | `UTC`              | Timezone                          |
| `DEFAULT_CURRENCY`   | no       | `NOK`              | Instance currency code            |
| `DEFAULT_LOCALE`     | no       | `en`               | Fallback UI language              |
| `BGG_SYNC_ENABLED`   | no       | `false`            | Master switch for BGG rating sync |
| `BGG_SYNC_PROVIDER`  | no       | `csv`              | `csv` \| `xmlapi`                 |
| `BGG_API_TOKEN`      | no       | —                  | Only if provider is `xmlapi`      |

## CI/CD

Every pull request runs the full gauntlet in GitHub Actions: ESLint + Prettier, TypeScript
typecheck, Vitest unit tests, Supertest integration tests (against a Postgres service),
Playwright end-to-end tests, `npm audit`, **Trivy** (deps/config/secret scan), **CodeQL** and
**Semgrep** (SAST), and **Gitleaks** (secret scan). Dependabot keeps dependencies current.

Tagging a release (`git tag v0.2.0 && git push --tags`) builds the image, scans it with Trivy,
and pushes semver-tagged images to **GHCR** (`ghcr.io/strand94/tabletop`). Pin a version in
production rather than relying on `latest`.

## License

[MIT](LICENSE).
