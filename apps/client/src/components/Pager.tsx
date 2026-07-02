import type { JSX } from 'react';
import { Icon } from './Icon.js';
import { t } from '../lib/strings.js';

interface Props {
  page: number;
  pageSize: number;
  total: number;
  onPage: (page: number) => void;
}

/** Prev/next pager with an "X–Y of Z" summary. Hidden when everything fits. */
export function Pager({ page, pageSize, total, onPage }: Props): JSX.Element | null {
  const pages = Math.ceil(total / pageSize);
  if (pages <= 1) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className="mt-5 flex items-center justify-center gap-3" data-testid="pager">
      <button
        type="button"
        onClick={() => onPage(page - 1)}
        disabled={page <= 1}
        aria-label={t.pager.prev}
        className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted2 disabled:opacity-40"
      >
        <Icon name="chevron_left" size={18} />
      </button>
      <span className="text-[12.5px] text-muted">
        {from}–{to} {t.pager.of} {total}
      </span>
      <button
        type="button"
        onClick={() => onPage(page + 1)}
        disabled={page >= pages}
        aria-label={t.pager.next}
        className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted2 disabled:opacity-40"
      >
        <Icon name="chevron_right" size={18} />
      </button>
    </div>
  );
}
