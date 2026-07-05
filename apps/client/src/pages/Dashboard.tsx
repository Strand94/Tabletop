import type { JSX } from 'react';
import { Link } from 'react-router-dom';
import type { DashboardStats } from '@tabletop/shared';
import { useDashboardStats } from '../lib/stats-api.js';
import { useGames } from '../lib/games-api.js';
import { Icon } from '../components/Icon.js';
import { numberLabel, playersLabel, playtimeLabel } from '../lib/format.js';
import { durationLabel, shortDate } from '../lib/datetime.js';
import { t } from '../lib/strings.js';

function SessionsChart({ data }: { data: DashboardStats['sessionsPerDay'] }): JSX.Element {
  const max = Math.max(1, ...data.map((d) => d.count));
  const total = data.reduce((sum, d) => sum + d.count, 0);
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-baseline justify-between">
        <div className="text-[14px] font-semibold">{t.dashboard.sessions14d}</div>
        <div className="text-[12px] text-muted">
          <b className="font-display text-text">{total}</b> {t.dashboard.sessionsSuffix}
        </div>
      </div>
      <div className="mt-4 flex h-[118px] items-end gap-[7px]">
        {data.map((d) => (
          <div key={d.date} className="flex h-full flex-1 flex-col justify-end" title={d.date}>
            <div
              className={`rounded-t ${d.count === max && max > 0 ? 'bg-accent' : 'bg-track'}`}
              style={{ height: `${(d.count / max) * 100}%` }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function MostPlayed({ items }: { items: DashboardStats['mostPlayed'] }): JSX.Element {
  const max = Math.max(1, ...items.map((i) => i.plays));
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-4 text-[14px] font-semibold">{t.dashboard.mostPlayed}</div>
      {items.length === 0 ? (
        <p className="text-[12px] text-muted">{t.dashboard.noSessions}</p>
      ) : (
        <div className="flex flex-col gap-3.5">
          {items.map((g) => (
            <Link
              key={g.gameId}
              to={`/collection/${g.gameId}`}
              className="flex items-center gap-2.5 no-underline text-text"
            >
              <div className="min-w-0 flex-1">
                <div className="truncate text-[12.5px] font-semibold">{g.title}</div>
                <div className="mt-1.5 h-[5px] overflow-hidden rounded bg-track">
                  <div
                    className="h-full bg-accent"
                    style={{ width: `${(g.plays / max) * 100}%` }}
                  />
                </div>
              </div>
              <span className="font-display text-[13px] font-semibold">{g.plays}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function RecentSessionsCard({ items }: { items: DashboardStats['recentSessions'] }): JSX.Element {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-2.5 text-[14px] font-semibold">{t.dashboard.recentSessions}</div>
      {items.length === 0 ? (
        <p className="text-[12px] text-muted">{t.dashboard.noSessions}</p>
      ) : (
        items.map((s, i) => (
          <Link
            key={s.id}
            to={`/sessions/${s.id}`}
            className={`flex items-center gap-2.5 py-2.5 no-underline text-text ${
              i < items.length - 1 ? 'border-b border-hairline' : ''
            }`}
          >
            <div className="min-w-0 flex-1">
              <div className="truncate text-[12.5px] font-semibold">{s.gameTitle}</div>
              <div className="text-[11px] text-muted">
                {s.winners.length ? `${s.winners.join(', ')} ${t.dashboard.won}` : '—'}
                {s.durationMinutes != null && ` · ${durationLabel(s.durationMinutes)}`}
              </div>
            </div>
            <span className="text-[11px] text-faint">{shortDate(s.start)}</span>
          </Link>
        ))
      )}
    </div>
  );
}

function TopPlayers({ items }: { items: DashboardStats['topPlayers'] }): JSX.Element {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-4 text-[14px] font-semibold">{t.dashboard.topPlayers}</div>
      {items.length === 0 ? (
        <p className="text-[12px] text-muted">{t.dashboard.noSessions}</p>
      ) : (
        <div className="flex flex-col gap-3.5">
          {items.map((p) => {
            const pct = Math.round(p.winRate * 100);
            return (
              <div key={p.personId} className="flex items-center gap-2.5">
                <div className="min-w-0 flex-1">
                  <div className="flex justify-between">
                    <span className="text-[12.5px] font-semibold">{p.name}</span>
                    <span className="font-display text-[12px] font-semibold text-accent-text">
                      {pct}%
                    </span>
                  </div>
                  <div className="mt-1.5 h-[5px] overflow-hidden rounded bg-track">
                    <div className="h-full bg-accent" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  icon,
  value,
  hint,
}: {
  label: string;
  icon: string;
  value: string;
  hint?: string;
}): JSX.Element {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <span className="text-[11.5px] font-medium text-muted">{label}</span>
        <Icon name={icon} size={17} className="text-accent" />
      </div>
      <div className="mt-2 font-display text-[27px] font-semibold tracking-tight">{value}</div>
      {hint && <div className="mt-1 text-[11px] text-muted">{hint}</div>}
    </div>
  );
}

function CollectionDonut({ stats }: { stats: DashboardStats }): JSX.Element {
  const total = stats.gamesOwned + stats.wishlist;
  const ownedPct = total === 0 ? 0 : (stats.gamesOwned / total) * 100;
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-1.5 text-[14px] font-semibold">{t.dashboard.collection}</div>
      <div className="flex items-center gap-5">
        <div className="relative h-[118px] w-[118px] flex-none">
          <div
            className="h-full w-full rounded-full"
            style={{
              background: `conic-gradient(var(--accent) 0 ${ownedPct}%, var(--track) ${ownedPct}% 100%)`,
            }}
          />
          <div className="absolute inset-[17px] flex flex-col items-center justify-center rounded-full bg-card">
            <div className="font-display text-[25px] font-semibold tracking-tight">{total}</div>
            <div className="text-[10.5px] text-muted">{t.dashboard.titles}</div>
          </div>
        </div>
        <div className="flex flex-1 flex-col gap-3">
          <Legend color="var(--accent)" label={t.dashboard.owned} value={stats.gamesOwned} />
          <Legend color="var(--track)" label={t.dashboard.wishlist} value={stats.wishlist} />
          <div className="flex items-center gap-2 border-t border-hairline pt-2.5">
            <Icon name="payments" size={15} className="text-accent" />
            <span className="text-[12px] text-muted2">{t.dashboard.value}</span>
            <b className="ml-auto font-display text-[13px]">
              {numberLabel(stats.collectionValue)}{' '}
              {stats.currency === 'NOK' ? 'kr' : stats.currency}
            </b>
          </div>
        </div>
      </div>
    </div>
  );
}

function Legend({
  color,
  label,
  value,
}: {
  color: string;
  label: string;
  value: number;
}): JSX.Element {
  return (
    <div className="flex items-center gap-2">
      <span className="h-2.5 w-2.5 rounded" style={{ background: color }} />
      <span className="text-[12px] text-muted2">{label}</span>
      <b className="ml-auto font-display text-[14px]">{value}</b>
    </div>
  );
}

/** Dashboard: headline counters, collection breakdown, recently added. */
export function Dashboard(): JSX.Element {
  const { data: stats, isLoading } = useDashboardStats();
  const { data: recentPage } = useGames({ sort: 'createdAt', order: 'desc', pageSize: 5 });
  const recent = recentPage?.items ?? [];

  if (isLoading || !stats) {
    return <p className="p-7 text-[13px] text-muted">{t.common.loading}</p>;
  }

  const currencySuffix = stats.currency === 'NOK' ? 'kr' : stats.currency;

  return (
    <div className="px-7 pb-8 pt-[22px]">
      <div className="mb-4 grid grid-cols-2 gap-3.5 md:grid-cols-3 xl:grid-cols-6">
        <StatCard
          label={t.dashboard.gamesOwned}
          icon="grid_view"
          value={String(stats.gamesOwned)}
        />
        <StatCard label={t.dashboard.sessions} icon="casino" value={String(stats.sessions)} />
        <StatCard
          label={t.dashboard.players}
          icon="group"
          value={String(stats.players)}
          hint={t.dashboard.household}
        />
        <StatCard
          label={t.dashboard.collectionValue}
          icon="payments"
          value={numberLabel(stats.collectionValue)}
          hint={currencySuffix}
        />
        <StatCard
          label={t.dashboard.expansions}
          icon="extension"
          value={String(stats.expansions)}
        />
        <StatCard
          label={t.dashboard.avgPrice}
          icon="sell"
          value={numberLabel(Math.round(stats.avgPrice))}
          hint={t.dashboard.perGame}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.6fr_1fr]">
        <div className="flex flex-col gap-4">
          <SessionsChart data={stats.sessionsPerDay} />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <MostPlayed items={stats.mostPlayed} />
            <RecentSessionsCard items={stats.recentSessions} />
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <CollectionDonut stats={stats} />
          <TopPlayers items={stats.topPlayers} />

          <div className="rounded-2xl border border-border bg-card p-5">
            <div className="mb-3 text-[14px] font-semibold">{t.dashboard.recentlyAdded}</div>
            {recent.length === 0 ? (
              <p className="text-[12.5px] text-muted">{t.dashboard.empty}</p>
            ) : (
              <div className="flex flex-col gap-2.5">
                {recent.slice(0, 5).map((game) => (
                  <Link
                    key={game.id}
                    to={`/collection/${game.id}`}
                    className="flex items-center gap-3 no-underline text-text"
                  >
                    <div
                      className="h-11 w-8 flex-none overflow-hidden rounded bg-chip"
                      style={
                        game.imagePath
                          ? undefined
                          : {
                              background:
                                'repeating-linear-gradient(135deg, var(--ph1), var(--ph1) 4px, var(--ph2) 4px, var(--ph2) 8px)',
                            }
                      }
                    >
                      {game.imagePath && (
                        <img
                          src={game.imagePath}
                          alt=""
                          className="h-full w-full object-contain"
                          loading="lazy"
                        />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[12.5px] font-semibold">
                        {game.title}{' '}
                        {game.releaseYear && (
                          <span className="font-normal text-faint">{game.releaseYear}</span>
                        )}
                      </div>
                      <div className="text-[11px] text-muted">
                        {[playersLabel(game), playtimeLabel(game)].filter(Boolean).join(' · ')}
                      </div>
                    </div>
                    <span
                      className={`rounded px-1.5 py-[3px] text-[10px] font-semibold ${
                        game.collectionStatus === 'OWNED'
                          ? 'bg-accent-soft text-accent-text'
                          : 'bg-chip text-muted2'
                      }`}
                    >
                      {game.collectionStatus === 'OWNED'
                        ? t.collection.owned
                        : t.collection.wishlist}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
