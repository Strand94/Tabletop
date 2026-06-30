import { useMemo, useState } from 'react';
import type { CollectionStatus } from '@tabletop/shared';
import { useCategories, useGames, type GamesFilter } from '../lib/games-api.js';
import { GameCard } from '../components/GameCard.js';
import { GameFormModal } from '../components/GameFormModal.js';
import { Icon } from '../components/Icon.js';
import { t } from '../lib/strings.js';

type StatusTab = 'ALL' | CollectionStatus;

/** Collection screen: status tabs, category chips, search, and the game grid. */
export function Collection(): JSX.Element {
  const [tab, setTab] = useState<StatusTab>('ALL');
  const [category, setCategory] = useState<number | undefined>();
  const [q, setQ] = useState('');
  const [showForm, setShowForm] = useState(false);

  const filter = useMemo<GamesFilter>(
    () => ({
      status: tab === 'ALL' ? undefined : tab,
      category,
      q: q.trim() || undefined,
    }),
    [tab, category, q],
  );

  const { data: games = [], isLoading } = useGames(filter);
  const { data: categories = [] } = useCategories();

  const tabs: { key: StatusTab; label: string }[] = [
    { key: 'ALL', label: t.collection.all },
    { key: 'OWNED', label: t.collection.ownedFilter },
    { key: 'WISHLIST', label: t.collection.wishlistFilter },
  ];

  return (
    <div className="px-7 pb-8 pt-5">
      {/* Filter bar */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex gap-0.5 rounded-xl border border-border bg-card p-[3px]">
          {tabs.map((it) => (
            <button
              key={it.key}
              type="button"
              onClick={() => setTab(it.key)}
              className={`rounded-lg px-3 py-1.5 text-[12.5px] font-semibold ${
                tab === it.key ? 'bg-accent text-on-accent' : 'text-muted2'
              }`}
            >
              {it.label}
            </button>
          ))}
        </div>

        {categories.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {categories.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategory((cur) => (cur === c.id ? undefined : c.id))}
                className={`rounded-full border px-3 py-1.5 text-[12px] font-medium ${
                  category === c.id
                    ? 'border-accent bg-accent-soft text-accent-text'
                    : 'border-border bg-card text-muted2'
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>
        )}

        <div className="ml-auto flex items-center gap-2">
          <div className="flex items-center gap-2 rounded-lg border border-border bg-input px-3 py-2 text-muted">
            <Icon name="search" size={17} />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t.collection.searchPlaceholder}
              aria-label={t.collection.searchPlaceholder}
              className="w-40 bg-transparent text-[13px] text-text outline-none placeholder:text-muted"
            />
          </div>
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 rounded-lg bg-accent px-3.5 py-2 text-[13px] font-semibold text-on-accent"
          >
            <Icon name="add" size={18} />
            {t.collection.newGame}
          </button>
        </div>
      </div>

      {/* Grid */}
      {isLoading ? (
        <p className="text-[13px] text-muted">{t.common.loading}</p>
      ) : games.length === 0 ? (
        <p className="text-[13px] text-muted" data-testid="collection-empty">
          {t.collection.empty}
        </p>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(176px,1fr))] gap-4">
          {games.map((game) => (
            <GameCard key={game.id} game={game} />
          ))}
        </div>
      )}

      {showForm && <GameFormModal onClose={() => setShowForm(false)} />}
    </div>
  );
}
