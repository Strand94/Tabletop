import { useMemo, useState, type JSX } from 'react';
import { bggUrl } from '@tabletop/shared';
import { useBggCatalogSearch, useBggImport } from '../lib/bgg-api.js';
import { t } from '../lib/strings.js';

export function BrowseBgg(): JSX.Element {
  const [q, setQ] = useState('');
  const { data: hits = [] } = useBggCatalogSearch(q);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const importGames = useBggImport();
  const ids = useMemo(() => [...selected], [selected]);

  function toggle(id: number): void {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  return (
    <div className="flex flex-col gap-4 p-6">
      <h1 className="font-display text-[20px] font-semibold">{t.browseBgg.title}</h1>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={t.browseBgg.searchPlaceholder}
        className="w-full rounded-lg border border-border bg-input px-3 py-2 text-[13px]"
      />
      {q.trim() === '' ? (
        <p className="text-[13px] text-muted2">{t.browseBgg.empty}</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {hits.map((hit) => (
            <li
              key={hit.bggId}
              className="flex items-center gap-3 rounded-lg border border-border px-3 py-2"
            >
              <input
                type="checkbox"
                checked={selected.has(hit.bggId)}
                onChange={() => toggle(hit.bggId)}
              />
              {hit.thumbnail && (
                <img src={hit.thumbnail} alt="" className="h-8 w-8 rounded object-cover" />
              )}
              <span className="flex-1 text-[13px]">
                {hit.name}
                {hit.year ? ` (${hit.year})` : ''}
                {hit.rank ? ` · #${hit.rank}` : ''}
              </span>
              <a
                href={bggUrl(hit.bggId)}
                target="_blank"
                rel="noreferrer"
                className="text-[11px] font-semibold text-accent-text"
              >
                ↗
              </a>
            </li>
          ))}
        </ul>
      )}
      <button
        type="button"
        disabled={ids.length === 0 || importGames.isPending}
        onClick={() =>
          importGames.mutate({ bggIds: ids }, { onSuccess: () => setSelected(new Set()) })
        }
        className="self-start rounded-lg bg-accent px-4 py-2 text-[13px] font-semibold text-on-accent disabled:opacity-60"
      >
        {t.browseBgg.add}
      </button>
      {importGames.data && (
        <p className="text-[13px] text-muted2">
          {t.browseBgg.imported
            .replace('{{created}}', String(importGames.data.created))
            .replace('{{skipped}}', String(importGames.data.skipped))}
        </p>
      )}
    </div>
  );
}
