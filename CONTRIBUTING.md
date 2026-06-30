# Contributing to Tabletop

Thanks for your interest! This document covers how to get set up and the conventions we follow.

## Development setup

```bash
npm install          # installs all workspaces
npm run dev          # API + client in watch mode
```

You need Node.js >= 20 and Docker (for the local Postgres used by integration tests).

## Project layout

This is an npm-workspaces monorepo. See the table in the [README](README.md#local-development).
Key principle: **`packages/shared` holds the zod schemas that define the API contract.** Both
the server (validation) and client (typed calls) import from it, so the contract cannot drift.

## Commands

| Command             | What it does                     |
| ------------------- | -------------------------------- |
| `npm run lint`      | ESLint (zero warnings allowed)   |
| `npm run format`    | Prettier write                   |
| `npm run typecheck` | `tsc --noEmit` across workspaces |
| `npm test`          | Vitest unit tests                |
| `npm run build`     | Build all workspaces             |

## Conventions

- **Commits:** Conventional-Commits style prefixes — `feat:`, `fix:`, `chore:`, `test:`,
  `ci:`, `docs:`, `refactor:`. Keep each commit focused (one logical change).
- **Tests:** TDD where there is logic. Unit tests with Vitest; API integration tests with
  Supertest against a real Postgres; end-to-end with Playwright. Don't merge red.
- **Validation:** all API input/output is validated with zod schemas from `@tabletop/shared`.
  Cross-entity integrity rules live in the service layer, not controllers.
- **i18n:** no hardcoded user-facing strings — everything goes through react-i18next.
- **Pre-commit:** a husky hook runs lint-staged (eslint --fix + prettier) and typecheck.

## Pull requests

1. Branch off `main`.
2. Make sure `npm run lint`, `npm run typecheck`, and `npm test` pass.
3. CI (lint, typecheck, tests, audit, secret scan) must be green.
4. Fill in the PR template.

By contributing you agree your contributions are licensed under the [MIT License](LICENSE).
