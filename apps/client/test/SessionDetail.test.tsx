import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import type { SessionDto } from '@tabletop/shared';
import { SessionDetail } from '../src/pages/SessionDetail.js';
import { setActiveTable } from '../src/lib/strings.js';

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
  beforeEach(() => {
    vi.restoreAllMocks();
    setActiveTable('en');
  });

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
