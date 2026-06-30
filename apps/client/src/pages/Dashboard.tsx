import { Link } from 'react-router-dom';
import type { DashboardStats } from '@tabletop/shared';
import { useDashboardStats } from '../lib/stats-api.js';
import { useGames } from '../lib/games-api.js';
import { Icon } from '../components/Icon.js';
import { numberLabel, playersLabel, playtimeLabel } from '../lib/format.js';
import { t } from '../lib/strings.js';

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
  const { data: recent = [] } = useGames({ sort: 'createdAt', order: 'desc' });

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
        <CollectionDonut stats={stats} />

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
                    className="h-11 w-8 flex-none rounded"
                    style={{
                      background:
                        'repeating-linear-gradient(135deg, var(--ph1), var(--ph1) 4px, var(--ph2) 4px, var(--ph2) 8px)',
                    }}
                  />
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
                    {game.collectionStatus === 'OWNED' ? t.collection.owned : t.collection.wishlist}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
