# First-Run Admin & Playerless-Session Flag Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a fresh install create its first admin through the UI, and visibly flag sessions that have ended up with zero players.

**Architecture:** Two independent slices. (1) A public `GET /api/auth/setup-status` endpoint tells the client whether any user exists; the Login page switches to a "create admin" form when none does, reusing the existing first-run bootstrap in `POST /api/auth/register`, then auto-logs-in. (2) Playerless sessions are already permitted by the `Person`→`PlayerSession` cascade (spec §10.8); we only add a UI flag on the sessions list and detail — no schema or API change.

**Tech Stack:** Express + zod + Prisma (server), React + TanStack Query + react-i18next-style `t` strings + Vitest/Testing-Library (client), Supertest for API integration tests.

## Global Constraints

- **Shared contract first:** any API shape lives in `packages/shared` as a zod schema + inferred type; server and client import from `@tabletop/shared`. (CLAUDE.md)
- **No hardcoded user-facing strings:** every UI string goes through `apps/client/src/lib/strings/nb.ts` (canonical shape — `Strings` type) and `en.ts`. Both files must stay key-complete or `en.ts` fails to typecheck.
- **Lint is zero-warning; pre-commit runs eslint + prettier + typecheck.** Do not bypass with `--no-verify`.
- **Integration tests** (`*.int.test.ts`) need `RUN_DB_TESTS=1` and a reachable `DATABASE_URL`; run serially.
- **TDD:** failing test first, minimal implementation, green, commit. Conventional Commits, one logical change per commit.
- **Auth gating unchanged:** `setup-status` is public (like `login`/`register`); it sits under the existing `authLimiter`.

---

## Feature 1 — First-run create-admin

### Task 1: `setup-status` shared schema + endpoint

**Files:**

- Modify: `packages/shared/src/auth.ts` (append schema + type)
- Modify: `apps/server/src/modules/auth/routes.ts` (add route inside `createAuthRouter`)
- Test: `apps/server/test/auth.int.test.ts` (add cases to the existing `describe('auth flow')`)

**Interfaces:**

- Consumes: `prisma.user.count()`, existing `createAuthRouter(deps)`.
- Produces:
  - `setupStatusSchema` / `SetupStatus = { needsSetup: boolean }` exported from `@tabletop/shared`.
  - Route `GET /api/auth/setup-status` → `200 { needsSetup: boolean }`, no auth required. `needsSetup` is `true` iff zero users exist.

- [ ] **Step 1: Write the failing tests**

Add to `apps/server/test/auth.int.test.ts`, inside `describe('auth flow', ...)`:

```ts
it('reports needsSetup=true when no users exist', async () => {
  const res = await request(app).get('/api/auth/setup-status');
  expect(res.status).toBe(200);
  expect(res.body).toEqual({ needsSetup: true });
});

it('reports needsSetup=false once a user exists', async () => {
  await request(app).post('/api/auth/register').send({ username: 'maya', password: 'supersecret' });
  const res = await request(app).get('/api/auth/setup-status');
  expect(res.status).toBe(200);
  expect(res.body).toEqual({ needsSetup: false });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `RUN_DB_TESTS=1 DATABASE_URL=postgresql://tabletop:changeme@localhost:5432/tabletop npx vitest run --project server apps/server/test/auth.int.test.ts -t "needsSetup"`
Expected: FAIL — `setup-status` returns 404 (route not mounted).

- [ ] **Step 3: Add the shared schema**

Append to `packages/shared/src/auth.ts`:

```ts
/** First-run setup probe: true when no user account exists yet. */
export const setupStatusSchema = z.object({
  needsSetup: z.boolean(),
});
export type SetupStatus = z.infer<typeof setupStatusSchema>;
```

`packages/shared/src/index.ts` re-exports `./auth.js` already (verify it has `export * from './auth.js';`; if not, add it).

- [ ] **Step 4: Add the route**

In `apps/server/src/modules/auth/routes.ts`, inside `createAuthRouter`, add before `router.post('/register', ...)`:

```ts
router.get('/setup-status', (_req, res, next) => {
  void (async () => {
    const userCount = await prisma.user.count();
    res.json({ needsSetup: userCount === 0 });
  })().catch(next);
});
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `RUN_DB_TESTS=1 DATABASE_URL=postgresql://tabletop:changeme@localhost:5432/tabletop npx vitest run --project server apps/server/test/auth.int.test.ts -t "needsSetup"`
Expected: PASS (both cases).

- [ ] **Step 6: Typecheck the shared package export**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/shared/src/auth.ts packages/shared/src/index.ts apps/server/src/modules/auth/routes.ts apps/server/test/auth.int.test.ts
git commit -m "feat(auth): add public setup-status endpoint for first-run detection"
```

---

### Task 2: Create-admin strings

**Files:**

- Modify: `apps/client/src/lib/strings/nb.ts` (canonical `Strings` shape — add keys under `login`)
- Modify: `apps/client/src/lib/strings/en.ts` (mirror the same keys)

**Interfaces:**

- Produces new `t.login` keys used by Task 3: `setupTitle`, `setupSubtitle`, `confirmPassword`, `createAdmin`, `creating`, `passwordTooShort`, `passwordMismatch`, `setupError`.

- [ ] **Step 1: Add keys to the canonical `nb.ts`**

In `apps/client/src/lib/strings/nb.ts`, extend the `login:` object with (Norwegian Bokmål):

```ts
    setupTitle: 'Opprett administrator',
    setupSubtitle: 'Første gang – lag den første kontoen',
    confirmPassword: 'Bekreft passord',
    createAdmin: 'Opprett administrator',
    creating: 'Oppretter…',
    passwordTooShort: 'Passordet må ha minst 8 tegn',
    passwordMismatch: 'Passordene er ikke like',
    setupError: 'Kunne ikke opprette kontoen',
```

- [ ] **Step 2: Add the same keys to `en.ts`**

In `apps/client/src/lib/strings/en.ts`, extend the `login:` object:

```ts
    setupTitle: 'Create admin',
    setupSubtitle: 'First run — set up the first account',
    confirmPassword: 'Confirm password',
    createAdmin: 'Create admin',
    creating: 'Creating…',
    passwordTooShort: 'Password must be at least 8 characters',
    passwordMismatch: 'Passwords do not match',
    setupError: 'Could not create the account',
```

- [ ] **Step 3: Typecheck (proves both locales are key-complete)**

Run: `npm run typecheck`
Expected: PASS. (If a key is missing from `en.ts`, `en: Strings` fails here.)

- [ ] **Step 4: Commit**

```bash
git add apps/client/src/lib/strings/nb.ts apps/client/src/lib/strings/en.ts
git commit -m "feat(i18n): add create-admin strings"
```

---

### Task 3: Login page — create-admin mode

**Files:**

- Modify: `apps/client/src/pages/Login.tsx` (full rewrite below)
- Test: `apps/client/test/Login.test.tsx` (create)

**Interfaces:**

- Consumes: `GET /api/auth/setup-status` (Task 1), `t.login.*` (Task 2), `useAuth().login`, `apiFetch`.
- Behaviour: on mount, fetch setup status. If `needsSetup`, render the create-admin form (username, password, confirm) → `POST /api/auth/register` → then `login(username, password)` → navigate `/`. Otherwise render the existing sign-in form unchanged. Client-side validation: password ≥ 8 chars, confirm matches.

- [ ] **Step 1: Write the failing test**

Create `apps/client/test/Login.test.tsx`:

```tsx
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { Login } from '../src/pages/Login.js';

const login = vi.fn().mockResolvedValue(undefined);
vi.mock('../src/lib/auth.js', () => ({ useAuth: () => ({ login }) }));

function stubSetupStatus(needsSetup: boolean) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ needsSetup }),
    }),
  );
}

function renderLogin() {
  return render(
    <MemoryRouter>
      <Login />
    </MemoryRouter>,
  );
}

describe('Login', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    login.mockClear();
  });

  it('shows the create-admin form on first run', async () => {
    stubSetupStatus(true);
    renderLogin();
    expect(await screen.findByRole('button', { name: 'Create admin' })).toBeInTheDocument();
    expect(screen.getByLabelText('Confirm password')).toBeInTheDocument();
  });

  it('shows the normal sign-in form when a user already exists', async () => {
    stubSetupStatus(false);
    renderLogin();
    expect(await screen.findByRole('button', { name: 'Sign in' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Confirm password')).not.toBeInTheDocument();
  });

  it('blocks mismatched passwords on the create-admin form', async () => {
    stubSetupStatus(true);
    renderLogin();
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText('Username'), 'maya');
    await user.type(screen.getByLabelText('Password'), 'supersecret');
    await user.type(screen.getByLabelText('Confirm password'), 'different1');
    await user.click(screen.getByRole('button', { name: 'Create admin' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Passwords do not match');
    expect(login).not.toHaveBeenCalled();
  });
});
```

> Note: strings resolve to English in tests because the default locale is `en`. If the test runner defaults to `nb`, assert on the `nb` strings instead.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run apps/client/test/Login.test.tsx`
Expected: FAIL — current `Login` never renders a create-admin form.

- [ ] **Step 3: Rewrite `Login.tsx`**

Replace the whole file `apps/client/src/pages/Login.tsx` with:

```tsx
import type { JSX } from 'react';
import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import type { SetupStatus } from '@tabletop/shared';
import { useAuth } from '../lib/auth.js';
import { apiFetch } from '../lib/api.js';
import { t } from '../lib/strings.js';

type Mode = 'loading' | 'login' | 'setup';

/** Login screen. On first run (no users yet) it becomes a create-admin form. */
export function Login(): JSX.Element {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>('loading');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    apiFetch<SetupStatus>('/api/auth/setup-status')
      .then((s) => {
        if (active) setMode(s.needsSetup ? 'setup' : 'login');
      })
      .catch(() => {
        if (active) setMode('login');
      });
    return () => {
      active = false;
    };
  }, []);

  async function onSignIn(e: FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(username, password);
      navigate('/');
    } catch {
      setError(t.login.error);
    } finally {
      setSubmitting(false);
    }
  }

  async function onCreateAdmin(e: FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError(t.login.passwordTooShort);
      return;
    }
    if (password !== confirm) {
      setError(t.login.passwordMismatch);
      return;
    }
    setSubmitting(true);
    try {
      await apiFetch('/api/auth/register', {
        method: 'POST',
        body: { username, password },
      });
      await login(username, password);
      navigate('/');
    } catch {
      setError(t.login.setupError);
    } finally {
      setSubmitting(false);
    }
  }

  const isSetup = mode === 'setup';
  const inputClass =
    'rounded-lg border border-border bg-input px-3 py-2.5 text-[13px] text-text outline-none focus:border-accent';
  const labelClass = 'flex flex-col gap-1.5 text-[12.5px] font-semibold text-muted2';

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg p-6 text-text">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-8 shadow-xl">
        <div className="mb-6 flex items-center gap-2.5">
          <span className="text-3xl leading-none text-accent">⚄</span>
          <span className="font-display text-2xl font-semibold tracking-tight">{t.appName}</span>
        </div>
        <h1 className="m-0 font-display text-lg font-semibold">
          {isSetup ? t.login.setupTitle : t.login.title}
        </h1>
        <p className="mb-5 mt-1 text-[13px] text-muted">
          {isSetup ? t.login.setupSubtitle : t.login.subtitle}
        </p>

        {mode === 'loading' ? (
          <p className="text-[13px] text-muted">{t.common.loading}</p>
        ) : (
          <form onSubmit={isSetup ? onCreateAdmin : onSignIn} className="flex flex-col gap-3">
            <label className={labelClass}>
              {t.login.username}
              <input
                type="text"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className={inputClass}
              />
            </label>
            <label className={labelClass}>
              {t.login.password}
              <input
                type="password"
                autoComplete={isSetup ? 'new-password' : 'current-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className={inputClass}
              />
            </label>
            {isSetup && (
              <label className={labelClass}>
                {t.login.confirmPassword}
                <input
                  type="password"
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  className={inputClass}
                />
              </label>
            )}

            {error && (
              <p role="alert" className="m-0 text-[12.5px] font-semibold text-[#c8453a]">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="mt-1 rounded-lg bg-accent px-4 py-2.5 text-[13px] font-semibold text-on-accent disabled:opacity-60"
            >
              {isSetup
                ? submitting
                  ? t.login.creating
                  : t.login.createAdmin
                : submitting
                  ? t.login.loading
                  : t.login.submit}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run apps/client/test/Login.test.tsx`
Expected: PASS (3 cases).

- [ ] **Step 5: Lint + typecheck**

Run: `npm run lint && npm run typecheck`
Expected: PASS, zero warnings.

- [ ] **Step 6: Commit**

```bash
git add apps/client/src/pages/Login.tsx apps/client/test/Login.test.tsx
git commit -m "feat(auth): first-run create-admin flow on the login screen"
```

---

## Feature 2 — Flag playerless sessions

Sessions with zero players can only arise when a person is deleted (the `PlayerSession`
cascade removes their row — spec §10.8), because create/update both enforce ≥1 player.
We surface this state; we do not block it.

### Task 4: Playerless strings

**Files:**

- Modify: `apps/client/src/lib/strings/nb.ts` (add keys under `sessions`)
- Modify: `apps/client/src/lib/strings/en.ts` (mirror)

**Interfaces:**

- Produces `t.sessions.playerless` (short badge) and `t.sessions.playerlessWarning` (banner sentence), used by Tasks 5 and 6.

- [ ] **Step 1: Add keys to `nb.ts`** — extend the `sessions:` object:

```ts
    playerless: 'Ingen spillere',
    playerlessWarning: 'Denne økten har ingen spillere – trolig fordi en spiller ble slettet.',
```

- [ ] **Step 2: Add the same keys to `en.ts`** — extend the `sessions:` object:

```ts
    playerless: 'No players',
    playerlessWarning: 'This session has no players — likely because a player was deleted.',
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/client/src/lib/strings/nb.ts apps/client/src/lib/strings/en.ts
git commit -m "feat(i18n): add playerless-session strings"
```

---

### Task 5: Flag playerless rows in the sessions list

**Files:**

- Modify: `apps/client/src/pages/Sessions.tsx:66` (the players-count cell)
- Test: `apps/client/test/Sessions.test.tsx` (add a case)

**Interfaces:**

- Consumes: `SessionDto.players`, `t.sessions.playerless` (Task 4).

- [ ] **Step 1: Write the failing test**

Add to `apps/client/test/Sessions.test.tsx` inside `describe('Sessions', ...)`:

```ts
it('flags a session that has no players', async () => {
  renderWith([{ ...session, players: [] }]);
  expect(await screen.findByText('No players')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run apps/client/test/Sessions.test.tsx -t "no players"`
Expected: FAIL — the cell renders the number `0`, not the badge.

- [ ] **Step 3: Update the players cell**

In `apps/client/src/pages/Sessions.tsx`, replace the players-count span (currently
`<span className="text-[12px] text-muted2">{s.players.length}</span>`) with:

```tsx
{
  s.players.length === 0 ? (
    <span className="justify-self-start rounded bg-chip px-1.5 py-0.5 text-[9.5px] font-bold text-muted2">
      {t.sessions.playerless}
    </span>
  ) : (
    <span className="text-[12px] text-muted2">{s.players.length}</span>
  );
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run apps/client/test/Sessions.test.tsx`
Expected: PASS (all cases, including the existing two).

- [ ] **Step 5: Commit**

```bash
git add apps/client/src/pages/Sessions.tsx apps/client/test/Sessions.test.tsx
git commit -m "feat(sessions): flag playerless sessions in the list"
```

---

### Task 6: Warning banner on the session detail page

**Files:**

- Modify: `apps/client/src/pages/SessionDetail.tsx` (insert a banner before the "Players table" block, ~line 97)
- Test: `apps/client/test/SessionDetail.test.tsx` (create)

**Interfaces:**

- Consumes: `SessionDto.players`, `t.sessions.playerlessWarning` (Task 4), `useSession`, `useAuth`.

- [ ] **Step 1: Write the failing test**

Create `apps/client/test/SessionDetail.test.tsx`:

```tsx
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import type { SessionDto } from '@tabletop/shared';
import { SessionDetail } from '../src/pages/SessionDetail.js';

const base: SessionDto = {
  id: 1,
  gameId: 7,
  gameTitle: 'Crimson Frontier',
  start: '2026-06-24T18:00:00.000Z',
  end: '2026-06-24T20:05:00.000Z',
  durationMinutes: 125,
  comment: null,
  location: null,
  expansions: [],
  players: [{ personId: 1, name: 'Maya', score: 92, won: true, firstPlay: false, color: null }],
  images: [],
  myRating: null,
  createdAt: '2026-06-24T20:10:00.000Z',
};

vi.mock('../src/lib/auth.js', () => ({ useAuth: () => ({ user: { role: 'ADMIN' } }) }));
vi.mock('../src/lib/ratings-api.js', () => ({
  useRateSession: () => ({ mutateAsync: vi.fn() }),
}));

let sessionData: SessionDto;
vi.mock('../src/lib/sessions-api.js', () => ({
  useSession: () => ({ data: sessionData, isLoading: false, isError: false }),
  useDeleteSession: () => ({ mutateAsync: vi.fn() }),
}));

function renderDetail() {
  return render(
    <MemoryRouter initialEntries={['/sessions/1']}>
      <Routes>
        <Route path="/sessions/:id" element={<SessionDetail />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('SessionDetail', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('shows a warning when the session has no players', () => {
    sessionData = { ...base, players: [] };
    renderDetail();
    expect(screen.getByRole('alert')).toHaveTextContent('This session has no players');
  });

  it('shows no warning when the session has players', () => {
    sessionData = base;
    renderDetail();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run apps/client/test/SessionDetail.test.tsx`
Expected: FAIL — no `alert` element is rendered.

- [ ] **Step 3: Insert the banner**

In `apps/client/src/pages/SessionDetail.tsx`, directly above the `{/* Players table */}`
comment (the `<div className="overflow-hidden rounded-2xl border border-border bg-card">`
that opens the players table), insert:

```tsx
{
  session.players.length === 0 && (
    <div
      role="alert"
      className="rounded-2xl border border-[#c8453a]/40 bg-[#c8453a]/10 px-5 py-3 text-[12.5px] font-semibold text-[#c8453a]"
    >
      {t.sessions.playerlessWarning}
    </div>
  );
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run apps/client/test/SessionDetail.test.tsx`
Expected: PASS (both cases).

- [ ] **Step 5: Lint + typecheck + full client tests**

Run: `npm run lint && npm run typecheck && npx vitest run --project client`
Expected: PASS, zero warnings.

- [ ] **Step 6: Commit**

```bash
git add apps/client/src/pages/SessionDetail.tsx apps/client/test/SessionDetail.test.tsx
git commit -m "feat(sessions): warn on the detail page when a session has no players"
```

---

## Final verification

- [ ] **Full unit suite:** `npm test` → PASS
- [ ] **Integration (with DB):** `RUN_DB_TESTS=1 DATABASE_URL=postgresql://tabletop:changeme@localhost:5432/tabletop npx vitest run --project server` → PASS
- [ ] **Lint + typecheck:** `npm run lint && npm run typecheck` → PASS, zero warnings
- [ ] Manual smoke (optional): with an empty DB, `npm run dev`, open the client → the login screen shows "Create admin"; submit → lands on the dashboard as ADMIN.

---

## Self-review notes

- **Spec coverage:** #1 (first-admin onboarding, spec §6/§8.5) → Tasks 1–3. #10 (playerless-session flag, spec §10.3/§10.8 tension, decided "allow + flag") → Tasks 4–6. Both slices produce working, independently testable software.
- **Out of scope (separate plans):** #2 BGG-ID field, #4 general user-management UI, #3 sessions-per-day timezone, #6 rating sort, #7 category/location creation UI. See `docs/review/2026-07-02-spec-gap-todo.md`.
- **Type consistency:** `SetupStatus`/`setupStatusSchema` defined in Task 1 and consumed in Task 3; `t.login.*` and `t.sessions.*` keys defined in Tasks 2/4 before use in Tasks 3/5/6.
