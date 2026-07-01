import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import type { DashboardStats } from '@tabletop/shared';
import { Dashboard } from '../src/pages/Dashboard.js';

const stats: DashboardStats = {
  gamesOwned: 12,
  wishlist: 3,
  sessions: 40,
  players: 5,
  expansions: 7,
  collectionValue: 5400,
  avgPrice: 450,
  currency: 'NOK',
  mostPlayed: [{ gameId: 1, title: 'Crimson Frontier', plays: 9 }],
  topPlayers: [{ personId: 1, name: 'Maya', plays: 10, wins: 7, winRate: 0.7 }],
  sessionsPerDay: Array.from({ length: 14 }, (_, i) => ({
    date: `2026-06-${String(i + 1).padStart(2, '0')}`,
    count: i,
  })),
  recentSessions: [
    {
      id: 5,
      gameId: 1,
      gameTitle: 'Crimson Frontier',
      start: '2026-06-24T18:00:00.000Z',
      durationMinutes: 125,
      winners: ['Maya'],
    },
  ],
};

describe('Dashboard', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string) => {
        const body = url.includes('/stats/dashboard') ? stats : [];
        return Promise.resolve({
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => body,
        });
      }),
    );
  });

  it('renders KPIs and the stats widgets', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <Dashboard />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(await screen.findByText('Mest spilt')).toBeInTheDocument();
    expect(screen.getByText('Toppspillere — seiersandel')).toBeInTheDocument();
    expect(screen.getByText('Partier — siste 14 dager')).toBeInTheDocument();
    // Top player win share.
    expect(screen.getByText('70%')).toBeInTheDocument();
    // Most-played game appears (also in recent sessions).
    expect(screen.getAllByText('Crimson Frontier').length).toBeGreaterThan(0);
  });
});
