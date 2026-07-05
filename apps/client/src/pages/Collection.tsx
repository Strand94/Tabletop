import type { JSX } from 'react';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { CollectionStatus } from '@tabletop/shared';
import { useCategories, useGames, type GamesFilter } from '../lib/games-api.js';
import { GameCard } from '../components/GameCard.js';
import { GameFormModal } from '../components/GameFormModal.js';
import { Pager } from '../components/Pager.js';
import { Icon } from '../components/Icon.js';
import { t } from '../lib/strings.js';

type StatusTab = 'ALL' | CollectionStatus;
type GameSort =
  | 'title'
  | 'releaseYear'
  | 'dateAdded'
  | 'createdAt'
  | 'myRating'
  | 'bggRating'
  | 'bggRank'
  | 'weight';

// Ratings read best-first (desc); rank is best-first ascending (rank 1 on top).
const DESC_BY_DEFAULT = new Set<GameSort>(['myRating', 'bggRating']);

/** Collection screen: status tabs, category chips, search, and the game grid. */
export function Collection(): JSX.Element {
  const [searchParams, setSearchParams] = useSearchParams();
  const shelf = searchParams.get('shelf') === '1';
  const [tab, setTab] = useState<StatusTab>('ALL');
  const [category, setCategory] = useState<number | undefined>();
  const [q, setQ] = useState('');
  // Preserve the prior default collection ordering (title A–Z); the sort control
  // adds options without silently reordering existing collections.
  const [sort, setSort] = useState<GameSort>('title');
  const [order, setOrder] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);

  const filter = useMemo<GamesFilter>(
    () => ({
      status: shelf ? undefined : tab === 'ALL' ? undefined : tab,
      category,
      q: q.trim() || undefined,
      sort,
      order,
      neverPlayed: shelf || undefined,
      page,
    }),
    [tab, category, q, sort, order, shelf, page],
  );

  const { data, isLoading } = useGames(filter);
  const games = data?.items ?? [];
  const { data: categories = [] } = useCategories();

  const tabs: { key: StatusTab; label: string }[] = [
    { key: 'ALL', label: t.collection.all },
    { key: 'OWNED', label: t.collection.ownedFilter },
    { key: 'WISHLIST', label: t.collection.wishlistFilter },
  ];

  const sortOptions: { value: GameSort; label: string }[] = [
    { value: 'title', label: t.gameForm.title },
    { value: 'releaseYear', label: t.gameForm.releaseYear },
    { value: 'dateAdded', label: t.dashboard.recentlyAdded },
    { value: 'myRating', label: t.collection.sortMyRating },
    { value: 'bggRating', label: t.collection.sortBggRating },
    { value: 'bggRank', label: t.collection.sortBggRank },
    { value: 'weight', label: t.collection.sortWeight },
  ];

  function changeSort(next: GameSort): void {
    setSort(next);
    setOrder(DESC_BY_DEFAULT.has(next) ? 'desc' : 'asc');
    setPage(1);
  }

  return (
    <div className="px-7 pb-8 pt-5">
      {shelf && (
        <div className="mb-4 flex items-center gap-3 rounded-xl border border-accent bg-accent-soft px-4 py-3">
          <Icon name="weekend" size={18} className="text-accent-text" />
          <div className="flex-1">
            <div className="text-[13px] font-semibold text-accent-text">{t.shelfOfShame.title}</div>
            <div className="text-[11.5px] text-muted2">{t.shelfOfShame.body}</div>
          </div>
          <button
            type="button"
            onClick={() => {
              setSearchParams({});
              setPage(1);
            }}
            className="rounded-lg border border-border bg-card px-3 py-1.5 text-[12px] font-semibold text-muted2"
          >
            {t.collection.all}
          </button>
        </div>
      )}
      {/* Filter bar */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex gap-0.5 rounded-xl border border-border bg-card p-[3px]">
          {tabs.map((it) => (
            <button
              key={it.key}
              type="button"
              onClick={() => {
                setTab(it.key);
                setPage(1);
              }}
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
                onClick={() => {
                  setCategory((cur) => (cur === c.id ? undefined : c.id));
                  setPage(1);
                }}
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
          <select
            value={sort}
            onChange={(e) => changeSort(e.target.value as GameSort)}
            aria-label={t.collection.sortLabel}
            className="rounded-lg border border-border bg-input px-3 py-2 text-[13px] font-semibold text-muted2 outline-none focus:border-accent"
          >
            {sortOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <div className="flex items-center gap-2 rounded-lg border border-border bg-input px-3 py-2 text-muted">
            <Icon name="search" size={17} />
            <input
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
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
        <>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(176px,1fr))] gap-4">
            {games.map((game) => (
              <GameCard key={game.id} game={game} />
            ))}
          </div>
          {data && (
            <Pager page={data.page} pageSize={data.pageSize} total={data.total} onPage={setPage} />
          )}
        </>
      )}

      {showForm && <GameFormModal onClose={() => setShowForm(false)} />}
    </div>
  );
}
