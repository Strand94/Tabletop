import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ExpansionDto } from '@tabletop/shared';
import { ExpansionsSection } from '../src/components/ExpansionsSection.js';

// Stub the auth hook so the section renders as an admin.
vi.mock('../src/lib/auth.js', () => ({
  useAuth: () => ({ user: { id: 1, username: 'maya', role: 'ADMIN' }, loading: false }),
}));

const expansion: ExpansionDto = {
  id: 3,
  gameId: 7,
  title: 'Frostmark',
  imagePath: null,
  releaseYear: 2022,
  minPlayers: null,
  maxPlayers: 5,
  minPlaytime: null,
  maxPlaytime: null,
  minAge: null,
  weight: null,
  description: null,
  price: 249,
  dateAdded: null,
  bggId: null,
  bggRating: null,
  bggRank: null,
  bggSyncedAt: null,
  sessionCount: 11,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

function renderWithClient(ui: React.ReactElement, expansions: ExpansionDto[]) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => expansions,
    }),
  );
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

describe('ExpansionsSection', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('renders expansion rows with the used-in count', async () => {
    renderWithClient(<ExpansionsSection gameId={7} currency="NOK" />, [expansion]);
    expect(await screen.findByText('Frostmark')).toBeInTheDocument();
    expect(screen.getByText(/brukt i 11/)).toBeInTheDocument();
    expect(screen.getByTestId('expansion-row')).toBeInTheDocument();
  });

  it('shows an empty state when there are no expansions', async () => {
    renderWithClient(<ExpansionsSection gameId={7} currency="NOK" />, []);
    expect(await screen.findByTestId('expansions-empty')).toBeInTheDocument();
  });
});
