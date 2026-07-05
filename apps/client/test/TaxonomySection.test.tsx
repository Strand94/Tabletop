import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { CategoryDto, LocationDto } from '@tabletop/shared';
import { LocaleProvider } from '../src/lib/i18n.js';
import { ThemeProvider } from '../src/lib/theme.js';
import { Settings } from '../src/pages/Settings.js';

const categories: CategoryDto[] = [
  { id: 1, name: 'Strategy' },
  { id: 2, name: 'Party' },
];
const locations: LocationDto[] = [
  { id: 1, name: 'Living room', address: 'Home' },
  { id: 2, name: 'Cabin', address: null },
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
      if (String(url).includes('/api/categories')) return jsonResponse(categories);
      if (String(url).includes('/api/locations')) return jsonResponse(locations);
      return jsonResponse([]);
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

describe('Settings — Categories & Locations sections', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    stubFetch();
    authMock.value = { user: { id: 1, username: 'maya', role: 'ADMIN' }, loading: false };
  });

  it('renders both sections and their items for an admin', async () => {
    renderSettings();
    // Norwegian is the default locale.
    expect(screen.getByText('Kategorier')).toBeInTheDocument();
    expect(screen.getByText('Steder')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('Strategy')).toBeInTheDocument());
    expect(screen.getByText('Party')).toBeInTheDocument();
    expect(screen.getByText('Living room')).toBeInTheDocument();
    expect(screen.getByText('Cabin')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Legg til kategori' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Legg til sted' })).toBeInTheDocument();
  });

  it('hides both sections for a member', () => {
    authMock.value = { user: { id: 2, username: 'lars', role: 'MEMBER' }, loading: false };
    renderSettings();
    expect(screen.queryByText('Kategorier')).not.toBeInTheDocument();
    expect(screen.queryByText('Steder')).not.toBeInTheDocument();
  });
});
