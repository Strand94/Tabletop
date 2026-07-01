import type { JSX } from 'react';
import { useState, type FormEvent } from 'react';
import type { CreateExpansionInput, ExpansionDto } from '@tabletop/shared';
import { useCreateExpansion, useUpdateExpansion } from '../lib/expansions-api.js';
import { Icon } from './Icon.js';
import { t } from '../lib/strings.js';

interface Props {
  gameId: number;
  expansion?: ExpansionDto;
  onClose: () => void;
}

interface FormState {
  title: string;
  releaseYear: string;
  minPlayers: string;
  maxPlayers: string;
  minPlaytime: string;
  maxPlaytime: string;
  minAge: string;
  weight: string;
  price: string;
  description: string;
}

function initialState(exp?: ExpansionDto): FormState {
  return {
    title: exp?.title ?? '',
    releaseYear: exp?.releaseYear?.toString() ?? '',
    minPlayers: exp?.minPlayers?.toString() ?? '',
    maxPlayers: exp?.maxPlayers?.toString() ?? '',
    minPlaytime: exp?.minPlaytime?.toString() ?? '',
    maxPlaytime: exp?.maxPlaytime?.toString() ?? '',
    minAge: exp?.minAge?.toString() ?? '',
    weight: exp?.weight?.toString() ?? '',
    price: exp?.price?.toString() ?? '',
    description: exp?.description ?? '',
  };
}

function num(value: string): number | undefined {
  if (value.trim() === '') return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
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

/** Modal to create or edit an expansion on a game. */
export function ExpansionFormModal({ gameId, expansion, onClose }: Props): JSX.Element {
  const editing = Boolean(expansion);
  const [form, setForm] = useState<FormState>(() => initialState(expansion));
  const [error, setError] = useState<string | null>(null);
  const create = useCreateExpansion(gameId);
  const update = useUpdateExpansion(gameId, expansion?.id ?? 0);
  const pending = create.isPending || update.isPending;

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
    const payload: CreateExpansionInput = {
      title: form.title.trim(),
      releaseYear: num(form.releaseYear),
      minPlayers: num(form.minPlayers),
      maxPlayers: num(form.maxPlayers),
      minPlaytime: num(form.minPlaytime),
      maxPlaytime: num(form.maxPlaytime),
      minAge: num(form.minAge),
      weight: num(form.weight),
      price: num(form.price),
      description: form.description.trim() || undefined,
    };
    try {
      if (editing) await update.mutateAsync(payload);
      else await create.mutateAsync(payload);
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
      <div className="flex max-h-full w-[520px] max-w-full flex-col overflow-hidden rounded-2xl border border-border bg-bg shadow-2xl">
        <div className="flex items-center justify-between border-b border-hairline px-6 py-4">
          <div className="font-display text-[17px] font-semibold">
            {editing ? t.expansions.editTitle : t.expansions.createTitle}
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
          <Field label={t.expansions.name}>
            <input
              aria-label={t.expansions.name}
              value={form.title}
              onChange={(e) => set('title', e.target.value)}
              className={inputClass}
              required
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label={t.gameForm.minPlayers}>
              <input
                inputMode="numeric"
                value={form.minPlayers}
                onChange={(e) => set('minPlayers', e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label={t.gameForm.maxPlayers}>
              <input
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
            <Field label={t.gameForm.price}>
              <input
                inputMode="decimal"
                value={form.price}
                onChange={(e) => set('price', e.target.value)}
                className={inputClass}
              />
            </Field>
          </div>

          <Field label={t.gameForm.description}>
            <textarea
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              rows={2}
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
