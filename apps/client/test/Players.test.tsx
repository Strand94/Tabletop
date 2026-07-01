import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { PersonDto } from '@tabletop/shared';
import { Players } from '../src/pages/Players.js';

vi.mock('../src/lib/auth.js', () => ({
  useAuth: () => ({ user: { id: 1, username: 'maya', role: 'ADMIN' }, loading: false }),
}));

const people: PersonDto[] = [
  {
    id: 1,
    name: 'Maya',
    imagePath: null,
    account: { userId: 1, username: 'maya', role: 'ADMIN' },
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 2,
    name: 'Jonas',
    imagePath: null,
    account: null,
    createdAt: '2026-01-01T00:00:00.000Z',
  },
];

function renderWith(data: PersonDto[]) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => data,
    }),
  );
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <Players />
    </QueryClientProvider>,
  );
}

describe('Players', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('renders a card per person with account/guest labels', async () => {
    renderWith(people);
    expect(await screen.findByText('Maya')).toBeInTheDocument();
    expect(screen.getByText('Jonas')).toBeInTheDocument();
    expect(screen.getByText('Admin · konto')).toBeInTheDocument();
    expect(screen.getByText('Gjest')).toBeInTheDocument();
    expect(screen.getAllByTestId('person-card')).toHaveLength(2);
  });

  it('shows an empty state when there are no people', async () => {
    renderWith([]);
    expect(await screen.findByTestId('players-empty')).toBeInTheDocument();
  });
});
