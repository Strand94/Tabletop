import type { JSX } from 'react';
import { Link } from 'react-router-dom';
import { useSessions } from '../lib/sessions-api.js';
import { durationLabel, shortDate, winnersLabel } from '../lib/datetime.js';
import { t } from '../lib/strings.js';

/** Recent plays of a game, shown on its detail page. */
export function GamePlayHistory({ gameId }: { gameId: number }): JSX.Element {
  const { data: sessions = [] } = useSessions({ game: gameId });

  return (
    <div className="mt-6">
      <div className="mb-3 text-[15px] font-semibold">
        {t.gameDetail.playHistory}{' '}
        <span className="font-medium text-muted">
          {sessions.length} {t.gameDetail.plays}
        </span>
      </div>
      {sessions.length === 0 ? (
        <p className="text-[12.5px] text-muted" data-testid="play-history-empty">
          {t.gameDetail.noPlays}
        </p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          {sessions.slice(0, 8).map((s, i) => (
            <Link
              key={s.id}
              to={`/sessions/${s.id}`}
              className={`flex items-center gap-3 px-4 py-3 no-underline text-text ${
                i < Math.min(sessions.length, 8) - 1 ? 'border-b border-hairline' : ''
              }`}
            >
              <div className="w-10 flex-none text-center">
                <div className="font-display text-[15px] font-semibold">
                  {new Date(s.start).getDate()}
                </div>
                <div className="text-[10px] text-muted">{shortDate(s.start).split(' ')[1]}</div>
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[12.5px] font-semibold">
                  {winnersLabel(s.players)} · {s.players.length} spillere
                </div>
                <div className="text-[11px] text-muted">
                  {s.expansions.length > 0
                    ? s.expansions.map((e) => e.title).join(', ')
                    : t.sessions.baseGame}
                  {s.durationMinutes != null && ` · ${durationLabel(s.durationMinutes)}`}
                  {s.location && ` · ${s.location.name}`}
                </div>
              </div>
              {s.myRating != null && (
                <span className="font-display text-[12px] font-semibold text-accent-text">
                  ★ {s.myRating.toFixed(1)}
                </span>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
