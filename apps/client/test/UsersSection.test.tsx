import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { UserPublic } from '@tabletop/shared';
import { LocaleProvider } from '../src/lib/i18n.js';
import { ThemeProvider } from '../src/lib/theme.js';
import { Settings } from '../src/pages/Settings.js';

const users: UserPublic[] = [
  { id: 1, username: 'maya', email: 'maya@example.com', role: 'ADMIN', locale: 'nb' },
  { id: 2, username: 'lars', email: null, role: 'MEMBER', locale: 'en' },
];

const authMock = vi.hoisted(() => ({
  value: { user: { id: 1, username: 'maya', role: 'ADMIN' }, loading: false } as {
    user: { id: number; username: string; role: string } | null;
    loading: boolean;
  },
}));

vi.mock('../src/lib/auth.js', () => ({
  useAuth: () => authMock.value,
}));

function jsonResponse(body: unknown) {
  return {
    ok: true,
    status: 200,
    headers: new Headers({ 'content-type': 'application/json' }),
    json: async () => body,
  };
}

function stubFetch() {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      if (String(url).includes('/api/users')) return jsonResponse(users);
      // The admin Settings page also renders category/location sections, which
      // expect array responses.
      if (String(url).includes('/api/categories') || String(url).includes('/api/locations')) {
        return jsonResponse([]);
      }
      return jsonResponse({});
    }),
  );
}

function renderSettings() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <LocaleProvider>
        <ThemeProvider>
          <Settings />
        </ThemeProvider>
      </LocaleProvider>
    </QueryClientProvider>,
  );
}

describe('Settings — Users section', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    stubFetch();
    authMock.value = {
      user: { id: 1, username: 'maya', role: 'ADMIN' },
      loading: false,
    };
  });

  it('renders the Users section and user list for an admin', async () => {
    renderSettings();
    expect(screen.getByText('Brukere')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('maya')).toBeInTheDocument());
    expect(screen.getByText('lars')).toBeInTheDocument();
    // Own row is tagged and its delete control is disabled.
    expect(screen.getByText('deg')).toBeInTheDocument();
  });

  it('hides the Users section for a member', () => {
    authMock.value = {
      user: { id: 2, username: 'lars', role: 'MEMBER' },
      loading: false,
    };
    renderSettings();
    expect(screen.queryByText('Brukere')).not.toBeInTheDocument();
    expect(screen.queryByText('Legg til bruker')).not.toBeInTheDocument();
  });
});
