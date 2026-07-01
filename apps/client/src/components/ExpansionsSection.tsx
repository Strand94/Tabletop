import { useState } from 'react';
import type { ExpansionDto } from '@tabletop/shared';
import { useAuth } from '../lib/auth.js';
import { useDeleteExpansion, useExpansions } from '../lib/expansions-api.js';
import { ExpansionFormModal } from './ExpansionFormModal.js';
import { Icon } from './Icon.js';
import { playersLabel, playtimeLabel, priceLabel } from '../lib/format.js';
import { t } from '../lib/strings.js';

const cover =
  'repeating-linear-gradient(135deg, var(--ph1), var(--ph1) 4px, var(--ph2) 4px, var(--ph2) 8px)';

function metaLine(exp: ExpansionDto, currency: string): string {
  return [
    exp.releaseYear?.toString(),
    playersLabel(exp) ? `${playersLabel(exp)} spillere` : '',
    playtimeLabel(exp),
    priceLabel(exp.price, currency),
  ]
    .filter(Boolean)
    .join(' · ');
}

/** Expansions list + add/edit/delete for a game (spec §4.1 item 3). */
export function ExpansionsSection({
  gameId,
  currency,
}: {
  gameId: number;
  currency: string;
}): JSX.Element {
  const { user } = useAuth();
  const { data: expansions = [] } = useExpansions(gameId);
  const del = useDeleteExpansion(gameId);
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<ExpansionDto | null>(null);
  const isAdmin = user?.role === 'ADMIN';

  return (
    <div className="mt-6">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-[15px] font-semibold">
          {t.expansions.title} <span className="font-medium text-muted">{expansions.length}</span>
        </div>
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 text-[12px] font-semibold text-accent-text"
        >
          <Icon name="add" size={16} />
          {t.expansions.add}
        </button>
      </div>

      {expansions.length === 0 ? (
        <p className="text-[12.5px] text-muted" data-testid="expansions-empty">
          {t.expansions.empty}
        </p>
      ) : (
        <div className="flex flex-col gap-2.5">
          {expansions.map((exp) => (
            <div
              key={exp.id}
              className="flex items-center gap-3.5 rounded-xl border border-border bg-card px-3.5 py-3"
              data-testid="expansion-row"
            >
              <div className="h-[46px] w-9 flex-none rounded" style={{ background: cover }} />
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-semibold">{exp.title}</div>
                <div className="mt-0.5 text-[11.5px] text-muted">{metaLine(exp, currency)}</div>
              </div>
              <span className="flex items-center gap-1 text-[11px] text-muted">
                <Icon name="casino" size={15} className="text-accent" />
                {t.expansions.usedIn} {exp.sessionCount}
              </span>
              <button
                type="button"
                onClick={() => setEditing(exp)}
                aria-label={`${t.gameDetail.edit} ${exp.title}`}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted2"
              >
                <Icon name="edit" size={15} />
              </button>
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm(t.expansions.confirmDelete)) del.mutate(exp.id);
                  }}
                  aria-label={`${t.expansions.delete} ${exp.title}`}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted2"
                >
                  <Icon name="delete" size={15} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {showCreate && <ExpansionFormModal gameId={gameId} onClose={() => setShowCreate(false)} />}
      {editing && (
        <ExpansionFormModal gameId={gameId} expansion={editing} onClose={() => setEditing(null)} />
      )}
    </div>
  );
}
