import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { GameDto } from '@tabletop/shared';
import { GameCard } from '../src/components/GameCard.js';

const game: GameDto = {
  id: 7,
  title: 'Crimson Frontier',
  imagePath: null,
  releaseYear: 2021,
  minPlayers: 1,
  maxPlayers: 4,
  minPlaytime: 60,
  maxPlaytime: 90,
  minAge: 12,
  weight: 3.4,
  description: null,
  type: 'BOARD_GAME',
  price: 649,
  currency: 'NOK',
  collectionStatus: 'OWNED',
  dateAdded: null,
  bggId: null,
  bggRating: null,
  bggRank: null,
  bggSyncedAt: null,
  categories: [{ id: 1, name: 'Strategi' }],
  myRating: null,
  avgSessionRating: null,
  sessionRatingCount: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

function renderCard(g: GameDto) {
  return render(
    <MemoryRouter>
      <GameCard game={g} />
    </MemoryRouter>,
  );
}

describe('GameCard', () => {
  it('shows title, meta, year, and an OWNED badge linking to the detail page', () => {
    renderCard(game);
    expect(screen.getByText('Crimson Frontier')).toBeInTheDocument();
    expect(screen.getByText(/1–4 · 60–90m/)).toBeInTheDocument();
    expect(screen.getByText('2021')).toBeInTheDocument();
    expect(screen.getByText('EID')).toBeInTheDocument();
    expect(screen.getByTestId('game-card')).toHaveAttribute('href', '/collection/7');
  });

  it('shows a WISHLIST badge for wishlist games', () => {
    renderCard({ ...game, collectionStatus: 'WISHLIST' });
    expect(screen.getByText('ØNSKE')).toBeInTheDocument();
  });

  it('shows the game weight (complexity) to one decimal', () => {
    renderCard(game);
    expect(screen.getByText('3.4')).toBeInTheDocument();
  });

  it('hides the weight when absent', () => {
    renderCard({ ...game, weight: null });
    expect(screen.queryByText('3.4')).not.toBeInTheDocument();
  });

  it('shows the user rating badge when present', () => {
    renderCard({ ...game, myRating: 8.6 });
    const badge = screen.getByTestId('card-rating');
    expect(badge).toHaveTextContent('8.6');
  });

  it('hides the rating badge when unrated', () => {
    renderCard({ ...game, myRating: null });
    expect(screen.queryByTestId('card-rating')).not.toBeInTheDocument();
  });

  it('shows the BGG rating badge when present', () => {
    renderCard({ ...game, bggRating: 7.83 });
    const badge = screen.getByTestId('card-bgg-rating');
    expect(badge).toHaveTextContent('BGG');
    expect(badge).toHaveTextContent('7.8');
  });

  it('hides the BGG rating badge when absent', () => {
    renderCard({ ...game, bggRating: null });
    expect(screen.queryByTestId('card-bgg-rating')).not.toBeInTheDocument();
  });

  it('shows both the user rating and BGG rating badges together', () => {
    renderCard({ ...game, myRating: 9, bggRating: 7.83 });
    expect(screen.getByTestId('card-rating')).toBeInTheDocument();
    expect(screen.getByTestId('card-bgg-rating')).toBeInTheDocument();
  });
});
