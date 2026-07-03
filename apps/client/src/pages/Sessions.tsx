import type { JSX } from 'react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useSessions } from '../lib/sessions-api.js';
import { useLogPlay } from '../lib/log-play.js';
import { Icon } from '../components/Icon.js';
import { Pager } from '../components/Pager.js';
import { durationLabel, shortDate, winnersLabel } from '../lib/datetime.js';
import { t } from '../lib/strings.js';

const cover =
  'repeating-linear-gradient(135deg, var(--ph1), var(--ph1) 4px, var(--ph2) 4px, var(--ph2) 8px)';

/** Sessions list: a table of logged plays, most recent first. */
export function Sessions(): JSX.Element {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useSessions({ page });
  const sessions = data?.items ?? [];
  const { openLogPlay } = useLogPlay();

  return (
    <div className="px-7 pb-8 pt-5">
      <div className="mb-4 flex items-center">
        <button
          type="button"
          onClick={() => openLogPlay()}
          className="ml-auto flex items-center gap-1.5 rounded-lg bg-accent px-3.5 py-2 text-[13px] font-semibold text-on-accent"
        >
          <Icon name="add" size={18} />
          {t.sessions.logPlay}
        </button>
      </div>

      {isLoading ? (
        <p className="text-[13px] text-muted">{t.common.loading}</p>
      ) : sessions.length === 0 ? (
        <p className="text-[13px] text-muted" data-testid="sessions-empty">
          {t.sessions.empty}
        </p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <div className="grid grid-cols-[1.6fr_.9fr_1fr_.8fr_.9fr] gap-3.5 border-b border-border px-4 py-3 text-[10.5px] font-semibold uppercase tracking-wide text-muted">
            <span>{t.sessions.colGame}</span>
            <span>{t.sessions.colPlayers}</span>
            <span>{t.sessions.colWinner}</span>
            <span>{t.sessions.colDuration}</span>
            <span>{t.sessions.colLocation}</span>
          </div>
          {sessions.map((s) => (
            <Link
              key={s.id}
              to={`/sessions/${s.id}`}
              className="grid grid-cols-[1.6fr_.9fr_1fr_.8fr_.9fr] items-center gap-3.5 border-b border-hairline px-4 py-3 no-underline text-text last:border-b-0"
              data-testid="session-row"
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <div
                  className="h-[38px] w-[30px] flex-none rounded"
                  style={{ background: cover }}
                />
                <div className="min-w-0">
                  <div className="truncate text-[12.5px] font-semibold">{s.gameTitle}</div>
                  <div className="text-[10.5px] text-muted">{shortDate(s.start)}</div>
                </div>
              </div>
              {s.players.length === 0 ? (
                <span className="justify-self-start rounded bg-chip px-1.5 py-0.5 text-[9.5px] font-bold text-muted2">
                  {t.sessions.playerless}
                </span>
              ) : (
                <span className="text-[12px] text-muted2">{s.players.length}</span>
              )}
              <span className="truncate text-[12px] font-semibold">{winnersLabel(s.players)}</span>
              <span className="text-[12px] text-muted2">{durationLabel(s.durationMinutes)}</span>
              <span className="truncate text-[12px] text-muted2">{s.location?.name ?? '—'}</span>
            </Link>
          ))}
        </div>
      )}

      {data && (
        <Pager page={data.page} pageSize={data.pageSize} total={data.total} onPage={setPage} />
      )}
    </div>
  );
}
