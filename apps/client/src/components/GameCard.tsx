import type { JSX } from 'react';
import { Link } from 'react-router-dom';
import type { GameDto } from '@tabletop/shared';
import { Icon } from './Icon.js';
import { playersLabel, playtimeLabel } from '../lib/format.js';
import { t } from '../lib/strings.js';

const placeholderCover =
  'repeating-linear-gradient(135deg, var(--ph1), var(--ph1) 5px, var(--ph2) 5px, var(--ph2) 10px)';

/** Collection grid card: cover, status badge, title, players/time/year. */
export function GameCard({ game }: { game: GameDto }): JSX.Element {
  const owned = game.collectionStatus === 'OWNED';
  const meta = [playersLabel(game), playtimeLabel(game)].filter(Boolean).join(' · ');

  return (
    <Link
      to={`/collection/${game.id}`}
      className="overflow-hidden rounded-xl border border-border bg-card no-underline text-text"
      data-testid="game-card"
    >
      <div
        className="relative h-[150px]"
        style={game.imagePath ? undefined : { background: placeholderCover }}
      >
        {game.imagePath && (
          <img src={game.imagePath} alt="" className="h-full w-full object-cover" loading="lazy" />
        )}
        <span
          className={`absolute left-2 top-2 rounded px-1.5 py-[3px] text-[9.5px] font-bold tracking-wide ${
            owned ? 'bg-accent-soft text-accent-text' : 'bg-chip text-muted2'
          }`}
        >
          {owned ? t.collection.owned : t.collection.wishlist}
        </span>
        {game.myRating != null && (
          <span
            className="absolute bottom-2 right-2 flex items-center gap-1 rounded-md bg-black/55 px-1.5 py-[3px] font-display text-[11px] font-semibold text-white"
            data-testid="card-rating"
          >
            <Icon name="star" size={13} className="text-star" />
            {game.myRating.toFixed(1)}
          </span>
        )}
      </div>
      <div className="px-3 py-2.5">
        <div className="truncate text-[13px] font-semibold">{game.title}</div>
        <div className="mt-0.5 text-[11px] text-muted">
          {meta}
          {game.releaseYear ? (
            <>
              {meta ? ' · ' : ''}
              <span className="text-faint">{game.releaseYear}</span>
            </>
          ) : null}
        </div>
      </div>
    </Link>
  );
}
