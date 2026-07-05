# Admin User Management — Design

Closes backlog item #4 (`docs/review/2026-07-02-spec-gap-todo.md`, P1). Gives admins a UI and
API to list, create, re-role, password-reset, and delete user accounts (spec §6: "ADMIN can
create/manage users"). Creating users already half-exists via `POST /api/auth/register`; this
adds the missing list/update/delete surface and a client UI.

## Scope

**In:** list users, create user (explicit role), change role, reset password, delete user — all
admin-only. A "Users" section on the existing Settings page.

**Out:** linking a `User` to a `Person` (player) record; self-service password reset; email
flows; pagination (household-scale user counts are tiny).

## Backend — `apps/server/src/modules/users/`

New feature module, mounted at `/api/users` in `app.ts` (uses `deps.tokens` and
`deps.defaultLocale`). Every route is `requireAuth(tokens)` + `requireRole('ADMIN')`.

`/api/auth/register` is left untouched — it still serves the first-run create-admin screen and
the (now redundant) admin-gated register path. The new UI uses `/api/users`.

### Endpoints

| Method + path           | Body                                      | Result                         |
| ----------------------- | ----------------------------------------- | ------------------------------ |
| `GET /api/users`        | —                                         | `UserPublic[]` (ordered by id) |
| `POST /api/users`       | `adminCreateUserSchema`                   | `201 UserPublic`               |
| `PATCH /api/users/:id`  | `updateUserSchema` (role and/or password) | `200 UserPublic`               |
| `DELETE /api/users/:id` | —                                         | `204`                          |

### `service.ts` — logic + guards (throw `HttpError`)

- `listUsers()` → all users mapped to `UserPublic`.
- `createUser(input)` — hash password (`hashPassword` from auth service), create with explicit
  `role`; `locale` defaults to `defaultLocale`. Duplicate username → `409`.
- `updateUser(id, input, actingUserId)`:
  - Load target; missing → `404`.
  - If demoting an ADMIN to MEMBER **and** they are the last ADMIN → `409 "Cannot demote the last
admin"`. (`prisma.user.count({ where: { role: 'ADMIN' } })`.)
  - Apply `role` and/or a re-hashed `password`.
  - If password or role changed, `tokenVersion: { increment: 1 }` so the target's outstanding
    refresh tokens are revoked (password change is a security must; role bump makes the new role
    take effect on next refresh rather than lingering for the access-token TTL).
- `deleteUser(id, actingUserId)`:
  - Missing → `404`.
  - Deleting yourself → `409 "Cannot delete your own account"` (avoids locking out mid-session).
  - Deleting the last ADMIN → `409 "Cannot delete the last admin"`.
  - Otherwise delete. (`User.personId` is `SetNull` per schema; a linked Person survives.)

`actingUserId` comes from `req.user!.sub`.

### `routes.ts`

Mirrors `people/routes.ts`: `parseId` helper, zod `.parse(req.body)` at the route, delegate to
service, `.catch(next)`. `requireRole('ADMIN')` applied to the whole router via `router.use`.

## Shared contract — `packages/shared/src/auth.ts`

- `adminCreateUserSchema` = `{ username(3–50), password(8–200), role: Role, email?: email,
locale?(2–10) }`.
- `updateUserSchema` = `{ role?: Role, password?(8–200) }` refined so at least one key is present
  (`"Provide a role or a password"`).
- Reuse existing `userPublicSchema` / `UserPublic` for responses.

Export both new schemas + inferred types from `auth.ts` (already re-exported by `index.ts`).

## Frontend — `apps/client/src/pages/Settings.tsx` + `lib/users-api.ts`

New admin-only **Users** section, rendered after the existing admin sections, using the same
`Section`/`Row` primitives already in `Settings.tsx`.

- `lib/users-api.ts` — TanStack Query hooks over `apiFetch`, keyed `['users']`, mutations
  invalidate `['users']`:
  - `useUsers()`, `useCreateUser()`, `useUpdateUser(id)`, `useDeleteUser()`.
- List rows: username, email (muted, or "—"), role badge, locale. Per-row actions:
  - **Role** toggle (ADMIN/MEMBER `Segment`, reusing the component in `Settings.tsx`).
  - **Reset password** button → small inline modal (new-password + confirm), calls
    `useUpdateUser` with `{ password }`.
  - **Delete** button → confirm modal, calls `useDeleteUser`.
- **Add user** button → create modal (username, password, email?, role) → `useCreateUser`.
- Client-side guards mirror the server: the delete and demote controls are disabled for the
  current user's own row and, for delete/demote, when the target is the only ADMIN (computed from
  the loaded list). Server errors (e.g. race on last-admin) surface via the modal/row.
- All copy via a new `settings.users` string group added to the `Strings` type (`nb.ts`) and both
  `nb.ts` + `en.ts`. No hardcoded literals.

Modals follow the lightweight pattern already used in the client (a fixed overlay + card, like
`GameFormModal`), kept small and local to Settings.

## Testing (TDD)

- `apps/server/test/users.int.test.ts` (Supertest + Postgres, `resetDb` between):
  - member token → `403` on every `/api/users` route; unauthenticated → `401`.
  - admin lists users; create returns `201` with the requested role and no `passwordHash`.
  - create with duplicate username → `409`.
  - change role MEMBER→ADMIN and back; demoting the last admin → `409`.
  - reset password: login with the new password works; the target's previously issued refresh
    token is rejected (`tokenVersion` bumped).
  - delete a member → `204`; deleting self → `409`; deleting the last admin → `409`.
- `packages/shared` — a small test that `updateUserSchema` rejects an empty body and
  `adminCreateUserSchema` requires a role.
- Client — a `users-api`/Settings test following existing client test patterns (hook shape /
  section renders for admin, hidden for member).

## Files

```
packages/shared/src/auth.ts                         (edit: 2 schemas)
apps/server/src/modules/users/service.ts            (new)
apps/server/src/modules/users/routes.ts             (new)
apps/server/src/app.ts                              (edit: mount /users)
apps/server/test/users.int.test.ts                  (new)
packages/shared/test/*                              (edit/new: schema test)
apps/client/src/lib/users-api.ts                    (new)
apps/client/src/pages/Settings.tsx                  (edit: Users section + modals)
apps/client/src/lib/strings/nb.ts                   (edit: Strings type + copy)
apps/client/src/lib/strings/en.ts                   (edit: copy)
apps/client/test/*                                  (new: settings/users test)
```
