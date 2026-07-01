import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useGame } from '../lib/games-api.js';
import { useLogPlay } from '../lib/log-play.js';
import { useRateGame } from '../lib/ratings-api.js';
import { GameFormModal } from '../components/GameFormModal.js';
import { ExpansionsSection } from '../components/ExpansionsSection.js';
import { RatingCard } from '../components/RatingCard.js';
import { Icon } from '../components/Icon.js';
import { playersLabel, playtimeLabel, priceLabel } from '../lib/format.js';
import { t } from '../lib/strings.js';

const cover =
  'repeating-linear-gradient(135deg, var(--ph1), var(--ph1) 6px, var(--ph2) 6px, var(--ph2) 12px)';

function Meta({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div>
      <div className="text-[11px] font-medium text-muted">{label}</div>
      <div className="mt-0.5 font-display text-[15px] font-semibold">{value || '—'}</div>
    </div>
  );
}

/** Game detail screen. Ratings/expansions/history fill in during later stages. */
export function GameDetail(): JSX.Element {
  const { id } = useParams();
  const gameId = Number(id);
  const { data: game, isLoading, isError } = useGame(gameId);
  const { openLogPlay } = useLogPlay();
  const rateGame = useRateGame(gameId);
  const [editing, setEditing] = useState(false);

  if (isLoading) return <p className="p-7 text-[13px] text-muted">{t.common.loading}</p>;
  if (isError || !game)
    return <p className="p-7 text-[13px] text-muted">{t.gameDetail.notFound}</p>;

  return (
    <div className="px-7 pb-8 pt-4">
      <Link
        to="/collection"
        className="mb-4 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-muted2 no-underline"
      >
        <Icon name="arrow_back" size={17} />
        {t.gameDetail.back}
      </Link>

      <div className="grid grid-cols-[280px_1fr] gap-7">
        {/* Left: cover + actions */}
        <div>
          <div
            className="aspect-[3/4] w-full rounded-2xl border border-border"
            style={game.imagePath ? undefined : { background: cover }}
          >
            {game.imagePath && (
              <img src={game.imagePath} alt="" className="h-full w-full rounded-2xl object-cover" />
            )}
          </div>
          <button
            type="button"
            onClick={() => openLogPlay(game.id)}
            className="mt-3.5 flex w-full items-center justify-center gap-1.5 rounded-xl bg-accent py-2.5 text-[13px] font-semibold text-on-accent"
          >
            <Icon name="casino" size={18} />
            {t.sessions.logPlay}
          </button>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-xl border border-border bg-card py-2.5 text-[12.5px] font-semibold text-muted2"
          >
            <Icon name="edit" size={17} />
            {t.gameDetail.edit}
          </button>
        </div>

        {/* Right: details */}
        <div className="min-w-0">
          <h2 className="m-0 font-display text-[26px] font-semibold tracking-tight">
            {game.title}
          </h2>
          {game.categories.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {game.categories.map((c) => (
                <span
                  key={c.id}
                  className="rounded-full bg-accent-soft px-3 py-1.5 text-[11.5px] font-semibold text-accent-text"
                >
                  {c.name}
                </span>
              ))}
            </div>
          )}

          {/* Ratings row: your rating (editable), avg session rating, BGG (read-only) */}
          <div className="mt-5 grid grid-cols-3 gap-3">
            <RatingCard
              label={t.rating.yourGameRating}
              value={game.myRating}
              highlight
              testId="your-game-rating"
              onSave={async (rating) => {
                await rateGame.mutateAsync({ rating });
              }}
            />
            <RatingCard
              label={t.rating.avgSessionRating}
              value={game.avgSessionRating}
              caption={
                game.sessionRatingCount > 0
                  ? t.rating.overSessions.replace('{n}', String(game.sessionRatingCount))
                  : undefined
              }
            />
            <RatingCard
              label={t.rating.bgg}
              value={game.bggRating}
              muted
              caption={game.bggRank ? `rang #${game.bggRank}` : t.rating.readOnly}
            />
          </div>

          <div className="mt-4 grid grid-cols-3 gap-x-6 gap-y-3.5 rounded-2xl border border-border bg-card px-5 py-4">
            <Meta label={t.gameDetail.players} value={playersLabel(game)} />
            <Meta label={t.gameDetail.playtime} value={playtimeLabel(game)} />
            <Meta label={t.gameDetail.age} value={game.minAge ? `${game.minAge}+` : ''} />
            <Meta label={t.gameDetail.complexity} value={game.weight ? `${game.weight} / 5` : ''} />
            <Meta label={t.gameDetail.released} value={game.releaseYear?.toString() ?? ''} />
            <Meta label={t.gameDetail.price} value={priceLabel(game.price, game.currency)} />
          </div>

          {game.description && (
            <p className="mx-0.5 mt-4 text-[13px] leading-relaxed text-muted2">
              {game.description}
            </p>
          )}

          <ExpansionsSection gameId={game.id} currency={game.currency} />
        </div>
      </div>

      {editing && <GameFormModal game={game} onClose={() => setEditing(false)} />}
    </div>
  );
}
