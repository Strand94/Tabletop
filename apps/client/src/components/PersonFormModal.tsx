import { useState, type FormEvent } from 'react';
import type { CreatePersonInput, PersonDto } from '@tabletop/shared';
import { useCreatePerson, useUpdatePerson } from '../lib/people-api.js';
import { Icon } from './Icon.js';
import { t } from '../lib/strings.js';

interface Props {
  person?: PersonDto;
  onClose: () => void;
}

/** Modal to create or edit a player. Account linking is managed elsewhere. */
export function PersonFormModal({ person, onClose }: Props): JSX.Element {
  const editing = Boolean(person);
  const [name, setName] = useState(person?.name ?? '');
  const [error, setError] = useState<string | null>(null);
  const create = useCreatePerson();
  const update = useUpdatePerson(person?.id ?? 0);
  const pending = create.isPending || update.isPending;

  async function onSubmit(e: FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);
    if (name.trim() === '') {
      setError(t.players.name);
      return;
    }
    const payload: CreatePersonInput = { name: name.trim() };
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
      <div className="w-[440px] max-w-full rounded-2xl border border-border bg-bg shadow-2xl">
        <div className="flex items-center justify-between border-b border-hairline px-6 py-4">
          <div className="font-display text-[17px] font-semibold">
            {editing ? t.players.editTitle : t.players.createTitle}
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
        <form onSubmit={onSubmit} className="flex flex-col gap-4 px-6 py-5">
          <label className="flex flex-col gap-1.5 text-[11.5px] font-semibold text-muted2">
            {t.players.name}
            <input
              aria-label={t.players.name}
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full rounded-lg border border-border bg-input px-3 py-2 text-[13px] text-text outline-none focus:border-accent"
            />
          </label>
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
