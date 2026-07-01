import type { JSX } from 'react';
import { useState } from 'react';
import { StarRow } from './StarRow.js';
import { t } from '../lib/strings.js';

interface Props {
  label: string;
  value: number | null;
  /** When set, the card is editable and calls this on save. */
  onSave?: (rating: number) => Promise<void>;
  /** Small caption under the value (e.g. "over 24 partier" or "rang #312"). */
  caption?: string;
  /** Highlight border (used for the user's own rating). */
  highlight?: boolean;
  /** Render the value muted (used for read-only BGG/aggregate). */
  muted?: boolean;
  testId?: string;
}

/**
 * A rating tile. Read-only by default; when `onSave` is provided it can be
 * edited via a 1–10 slider. Used for the user's game/session rating, the average
 * session rating, and the (read-only) BGG rating.
 */
export function RatingCard({
  label,
  value,
  onSave,
  caption,
  highlight,
  muted,
  testId,
}: Props): JSX.Element {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? 7);
  const [saving, setSaving] = useState(false);

  async function save(): Promise<void> {
    if (!onSave) return;
    setSaving(true);
    try {
      await onSave(Math.round(draft * 10) / 10);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className={`rounded-2xl border bg-card px-4 py-3.5 ${
        highlight ? 'border-accent' : 'border-border'
      }`}
      data-testid={testId}
    >
      <div className="mb-1.5 text-[11px] font-medium text-muted">{label}</div>

      {editing ? (
        <div className="flex flex-col gap-2">
          <div className="flex items-baseline gap-1">
            <span className="font-display text-[22px] font-semibold text-accent-text">
              {draft.toFixed(1)}
            </span>
            <span className="text-[12px] text-muted">{t.rating.ofTen}</span>
          </div>
          <input
            type="range"
            min={1}
            max={10}
            step={0.5}
            value={draft}
            onChange={(e) => setDraft(Number(e.target.value))}
            aria-label={label}
            className="w-full accent-[color:var(--accent)]"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="rounded-lg bg-accent px-3 py-1.5 text-[12px] font-semibold text-on-accent disabled:opacity-60"
            >
              {t.rating.save}
            </button>
            <button
              type="button"
              onClick={() => {
                setDraft(value ?? 7);
                setEditing(false);
              }}
              className="rounded-lg border border-border px-3 py-1.5 text-[12px] font-semibold text-muted2"
            >
              {t.rating.cancel}
            </button>
          </div>
        </div>
      ) : (
        <>
          {value == null ? (
            <div className="flex items-baseline gap-2">
              <span className="text-[13px] text-muted">{t.rating.notRated}</span>
            </div>
          ) : (
            <div className="flex items-baseline gap-1">
              <span
                className={`font-display text-[26px] font-semibold ${
                  muted ? 'text-muted2' : highlight ? 'text-accent-text' : 'text-text'
                }`}
              >
                {value.toFixed(1)}
              </span>
              <span className="text-[12px] text-muted">{t.rating.ofTen}</span>
            </div>
          )}
          {value != null && !muted && (
            <div className="mt-1.5">
              <StarRow value={value} />
            </div>
          )}
          {caption && <div className="mt-1.5 text-[11px] text-muted">{caption}</div>}
          {onSave && (
            <button
              type="button"
              onClick={() => {
                setDraft(value ?? 7);
                setEditing(true);
              }}
              className="mt-2 text-[12px] font-semibold text-accent-text"
            >
              {t.rating.rate}
            </button>
          )}
        </>
      )}
    </div>
  );
}
