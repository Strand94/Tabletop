import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import type { SessionDto } from '@tabletop/shared';
import { Sessions } from '../src/pages/Sessions.js';
import { setActiveTable } from '../src/lib/strings.js';

vi.mock('../src/lib/log-play.js', () => ({ useLogPlay: () => ({ openLogPlay: vi.fn() }) }));

const session: SessionDto = {
  id: 1,
  gameId: 7,
  gameTitle: 'Crimson Frontier',
  start: '2026-06-24T18:00:00.000Z',
  end: '2026-06-24T20:05:00.000Z',
  durationMinutes: 125,
  comment: null,
  location: { id: 1, name: 'Stua' },
  expansions: [],
  players: [
    { personId: 1, name: 'Maya', score: 92, won: true, firstPlay: false, color: null },
    { personId: 2, name: 'Theo', score: 74, won: false, firstPlay: true, color: null },
  ],
  images: [],
  myRating: null,
  createdAt: '2026-06-24T20:10:00.000Z',
};

function renderWith(data: SessionDto[]) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ items: data, total: data.length, page: 1, pageSize: 25 }),
    }),
  );
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <Sessions />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('Sessions', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('renders a row per session with winner and duration', async () => {
    renderWith([session]);
    expect(await screen.findByText('Crimson Frontier')).toBeInTheDocument();
    expect(screen.getByText('Maya')).toBeInTheDocument();
    expect(screen.getByText('2t 05m')).toBeInTheDocument();
    expect(screen.getByText('Stua')).toBeInTheDocument();
    expect(screen.getByTestId('session-row')).toHaveAttribute('href', '/sessions/1');
  });

  it('shows an empty state when there are no sessions', async () => {
    renderWith([]);
    expect(await screen.findByTestId('sessions-empty')).toBeInTheDocument();
  });

  it('flags a session that has no players', async () => {
    setActiveTable('en');
    renderWith([{ ...session, players: [] }]);
    expect(await screen.findByText('No players')).toBeInTheDocument();
  });
});
