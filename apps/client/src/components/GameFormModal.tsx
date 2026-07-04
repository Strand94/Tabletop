import type { JSX } from 'react';
import { useState, type FormEvent } from 'react';
import type { BggCatalogHitDto, CreateGameInput, GameDto } from '@tabletop/shared';
import { bggUrl } from '@tabletop/shared';
import { useCategories, useCreateGame, useUpdateGame } from '../lib/games-api.js';
import { useBggCatalogSearch, hitToFormPatch } from '../lib/bgg-api.js';
import { Icon } from './Icon.js';
import { t } from '../lib/strings.js';

interface Props {
  onClose: () => void;
  onSaved?: (game: GameDto) => void;
  game?: GameDto;
}

interface FormState {
  title: string;
  releaseYear: string;
  minPlayers: string;
  maxPlayers: string;
  minPlaytime: string;
  maxPlaytime: string;
  minAge: string;
  bggId: string;
  weight: string;
  price: string;
  description: string;
  status: 'OWNED' | 'WISHLIST';
  bggId: string;
  imagePath: string;
}

function initialState(game?: GameDto): FormState {
  return {
    title: game?.title ?? '',
    releaseYear: game?.releaseYear?.toString() ?? '',
    minPlayers: game?.minPlayers?.toString() ?? '',
    maxPlayers: game?.maxPlayers?.toString() ?? '',
    minPlaytime: game?.minPlaytime?.toString() ?? '',
    maxPlaytime: game?.maxPlaytime?.toString() ?? '',
    minAge: game?.minAge?.toString() ?? '',
    bggId: game?.bggId?.toString() ?? '',
    weight: game?.weight?.toString() ?? '',
    price: game?.price?.toString() ?? '',
    description: game?.description ?? '',
    status: game?.collectionStatus ?? 'OWNED',
    bggId: game?.bggId?.toString() ?? '',
    imagePath: game?.imagePath ?? '',
  };
}

function num(value: string): number | undefined {
  if (value.trim() === '') return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

/** Modal form for creating or editing a game. */
export function GameFormModal({ onClose, onSaved, game }: Props): JSX.Element {
  const editing = Boolean(game);
  const [form, setForm] = useState<FormState>(() => initialState(game));
  const [categoryIds, setCategoryIds] = useState<number[]>(game?.categories.map((c) => c.id) ?? []);
  const [error, setError] = useState<string | null>(null);
  const { data: categories = [] } = useCategories();
  const createGame = useCreateGame();
  const updateGame = useUpdateGame(game?.id ?? 0);
  const pending = createGame.isPending || updateGame.isPending;
  const [bggQuery, setBggQuery] = useState('');
  const { data: hits = [] } = useBggCatalogSearch(bggQuery);

  function applyHit(hit: BggCatalogHitDto): void {
    const patch = hitToFormPatch(hit);
    setForm((f) => ({
      ...f,
      title: patch.title,
      releaseYear: patch.releaseYear,
      bggId: String(patch.bggId),
      imagePath: patch.imagePath ?? '',
    }));
    setBggQuery('');
  }

  function set(key: keyof FormState, value: string): void {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function onSubmit(e: FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);
    if (form.title.trim() === '') {
      setError(t.gameForm.required);
      return;
    }
    const payload: CreateGameInput = {
      title: form.title.trim(),
      releaseYear: num(form.releaseYear),
      minPlayers: num(form.minPlayers),
      maxPlayers: num(form.maxPlayers),
      minPlaytime: num(form.minPlaytime),
      maxPlaytime: num(form.maxPlaytime),
      minAge: num(form.minAge),
      bggId: num(form.bggId),
      weight: num(form.weight),
      price: num(form.price),
      description: form.description.trim() || undefined,
      collectionStatus: form.status,
      categoryIds,
      bggId: num(form.bggId),
      imagePath: form.imagePath.trim() || undefined,
    };
    try {
      const saved = editing
        ? await updateGame.mutateAsync(payload)
        : await createGame.mutateAsync(payload);
      onSaved?.(saved);
      onClose();
    } catch {
      setError(t.common.error);
    }
  }

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center bg-black/40 p-6 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
    >
      <div className="flex max-h-full w-[560px] max-w-full flex-col overflow-hidden rounded-2xl border border-border bg-bg shadow-2xl">
        <div className="flex items-center justify-between border-b border-hairline px-6 py-4">
          <div className="font-display text-[17px] font-semibold">
            {editing ? t.gameForm.editTitle : t.gameForm.createTitle}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t.gameForm.cancel}
            className="flex h-[30px] w-[30px] items-center justify-center rounded-lg border border-border text-muted2"
          >
            <Icon name="close" size={18} />
          </button>
        </div>

        <form onSubmit={onSubmit} className="flex flex-col gap-4 overflow-y-auto px-6 py-5">
          {!editing && (
            <Field label={t.gameForm.bggSearch}>
              <input
                aria-label={t.gameForm.bggSearch}
                value={bggQuery}
                onChange={(e) => setBggQuery(e.target.value)}
                placeholder={t.gameForm.bggSearchPlaceholder}
                className={inputClass}
              />
              {bggQuery.trim() !== '' && (
                <ul className="mt-1 max-h-56 overflow-y-auto rounded-lg border border-border bg-card">
                  {hits.length === 0 && (
                    <li className="px-3 py-2 text-[12px] text-muted2">{t.gameForm.bggNoResults}</li>
                  )}
                  {hits.map((hit) => (
                    <li key={hit.bggId} className="flex items-center gap-2 px-2 py-1.5">
                      <button
                        type="button"
                        onClick={() => applyHit(hit)}
                        className="flex flex-1 items-center gap-2 text-left"
                      >
                        {hit.thumbnail && (
                          <img
                            src={hit.thumbnail}
                            alt=""
                            className="h-8 w-8 rounded object-cover"
                          />
                        )}
                        <span className="text-[13px]">
                          {hit.name}
                          {hit.year ? ` (${hit.year})` : ''}
                          {hit.rank ? ` · #${hit.rank}` : ''}
                        </span>
                      </button>
                      <a
                        href={bggUrl(hit.bggId)}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] font-semibold text-accent-text"
                      >
                        {t.gameForm.bggViewOnBgg} ↗
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </Field>
          )}

          <Field label={t.gameForm.title}>
            <input
              aria-label={t.gameForm.title}
              value={form.title}
              onChange={(e) => set('title', e.target.value)}
              className={inputClass}
              required
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label={t.gameForm.minPlayers}>
              <input
                aria-label={t.gameForm.minPlayers}
                inputMode="numeric"
                value={form.minPlayers}
                onChange={(e) => set('minPlayers', e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label={t.gameForm.maxPlayers}>
              <input
                aria-label={t.gameForm.maxPlayers}
                inputMode="numeric"
                value={form.maxPlayers}
                onChange={(e) => set('maxPlayers', e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label={t.gameForm.minPlaytime}>
              <input
                inputMode="numeric"
                value={form.minPlaytime}
                onChange={(e) => set('minPlaytime', e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label={t.gameForm.maxPlaytime}>
              <input
                inputMode="numeric"
                value={form.maxPlaytime}
                onChange={(e) => set('maxPlaytime', e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label={t.gameForm.releaseYear}>
              <input
                inputMode="numeric"
                value={form.releaseYear}
                onChange={(e) => set('releaseYear', e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label={t.gameForm.minAge}>
              <input
                inputMode="numeric"
                value={form.minAge}
                onChange={(e) => set('minAge', e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label={t.gameForm.weight}>
              <input
                inputMode="decimal"
                value={form.weight}
                onChange={(e) => set('weight', e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label={t.gameForm.price}>
              <input
                inputMode="decimal"
                value={form.price}
                onChange={(e) => set('price', e.target.value)}
                className={inputClass}
              />
            </Field>
          </div>

          <Field label={t.gameForm.bggId}>
            <input
              aria-label={t.gameForm.bggId}
              inputMode="numeric"
              value={form.bggId}
              onChange={(e) => set('bggId', e.target.value)}
              className={inputClass}
            />
          </Field>

          <Field label={t.gameForm.status}>
            <div className="flex gap-1 rounded-lg bg-chip p-1">
              {(['OWNED', 'WISHLIST'] as const).map((s) => (
                <button
                  type="button"
                  key={s}
                  onClick={() => set('status', s)}
                  className={`flex-1 rounded-md px-3 py-1.5 text-[12.5px] font-semibold ${
                    form.status === s ? 'bg-card text-text' : 'text-muted'
                  }`}
                >
                  {s === 'OWNED' ? t.collection.ownedFilter : t.collection.wishlistFilter}
                </button>
              ))}
            </div>
          </Field>

          {categories.length > 0 && (
            <Field label={t.gameForm.categories}>
              <div className="flex flex-wrap gap-2">
                {categories.map((c) => {
                  const selected = categoryIds.includes(c.id);
                  return (
                    <button
                      type="button"
                      key={c.id}
                      onClick={() =>
                        setCategoryIds((ids) =>
                          selected ? ids.filter((x) => x !== c.id) : [...ids, c.id],
                        )
                      }
                      className={`rounded-full border px-3 py-1.5 text-[12px] font-medium ${
                        selected
                          ? 'border-accent bg-accent-soft text-accent-text'
                          : 'border-border bg-card text-muted2'
                      }`}
                    >
                      {c.name}
                    </button>
                  );
                })}
              </div>
            </Field>
          )}

          <Field label={t.gameForm.description}>
            <textarea
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              rows={3}
              className={`${inputClass} resize-none`}
            />
          </Field>

          {error && (
            <p role="alert" className="m-0 text-[12.5px] font-semibold text-[#c8453a]">
              {error}
            </p>
          )}

          <div className="flex items-center justify-end gap-2 border-t border-hairline pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-border bg-card px-4 py-2 text-[13px] font-semibold text-muted2"
            >
              {t.gameForm.cancel}
            </button>
            <button
              type="submit"
              disabled={pending}
              className="rounded-lg bg-accent px-4 py-2 text-[13px] font-semibold text-on-accent disabled:opacity-60"
            >
              {pending ? t.gameForm.saving : t.gameForm.save}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const inputClass =
  'w-full rounded-lg border border-border bg-input px-3 py-2 text-[13px] text-text outline-none focus:border-accent';

function Field({ label, children }: { label: string; children: React.ReactNode }): JSX.Element {
  return (
    <label className="flex flex-col gap-1.5 text-[11.5px] font-semibold text-muted2">
      {label}
      {children}
    </label>
  );
}
