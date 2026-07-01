import { useMemo, useState } from 'react';
import type { CreateSessionInput, GameDto } from '@tabletop/shared';
import { useGames } from '../lib/games-api.js';
import { useExpansions } from '../lib/expansions-api.js';
import { usePeople } from '../lib/people-api.js';
import { useCreateSession, useLocations } from '../lib/sessions-api.js';
import { fromDatetimeLocal, toDatetimeLocal } from '../lib/datetime.js';
import { Icon } from './Icon.js';
import { t } from '../lib/strings.js';

interface Props {
  onClose: () => void;
  initialGameId?: number;
  onSaved?: (sessionId: number) => void;
}

interface PlayerRow {
  personId: number;
  include: boolean;
  score: string;
  won: boolean;
  firstPlay: boolean;
}

const inputClass =
  'w-full rounded-lg border border-border bg-input px-3 py-2 text-[13px] text-text outline-none focus:border-accent';

/** Three-step wizard to log a play: pick game → players/expansions → details. */
export function LogPlayModal({ onClose, initialGameId, onSaved }: Props): JSX.Element {
  const [step, setStep] = useState(1);
  const [gameId, setGameId] = useState<number | undefined>(initialGameId);
  const [gameQuery, setGameQuery] = useState('');
  const [expansionIds, setExpansionIds] = useState<number[]>([]);
  const [players, setPlayers] = useState<Record<number, PlayerRow>>({});
  const [start, setStart] = useState(() => toDatetimeLocal(new Date().toISOString()));
  const [end, setEnd] = useState('');
  const [locationId, setLocationId] = useState<number | ''>('');
  const [comment, setComment] = useState('');
  const [error, setError] = useState<string | null>(null);

  const { data: games = [] } = useGames();
  const { data: expansions = [] } = useExpansions(gameId ?? 0);
  const { data: people = [] } = usePeople();
  const { data: locations = [] } = useLocations();
  const createSession = useCreateSession();

  const filteredGames = useMemo(
    () => games.filter((g) => g.title.toLowerCase().includes(gameQuery.trim().toLowerCase())),
    [games, gameQuery],
  );
  const selectedGame = games.find((g) => g.id === gameId);
  const includedPlayers = Object.values(players).filter((p) => p.include);

  function togglePlayer(personId: number): void {
    setPlayers((prev) => {
      const cur = prev[personId] ?? {
        personId,
        include: false,
        score: '',
        won: false,
        firstPlay: false,
      };
      return { ...prev, [personId]: { ...cur, include: !cur.include } };
    });
  }

  function patchPlayer(personId: number, patch: Partial<PlayerRow>): void {
    setPlayers((prev) => ({
      ...prev,
      [personId]: { ...(prev[personId] as PlayerRow), ...patch },
    }));
  }

  function goNext(): void {
    setError(null);
    if (step === 1 && !gameId) {
      setError(t.logPlay.pickGame);
      return;
    }
    if (step === 2 && includedPlayers.length === 0) {
      setError(t.logPlay.pickPlayers);
      return;
    }
    setStep((s) => Math.min(3, s + 1));
  }

  async function save(): Promise<void> {
    if (!gameId || includedPlayers.length === 0) return;
    setError(null);
    const payload: CreateSessionInput = {
      gameId,
      start: fromDatetimeLocal(start),
      end: end ? fromDatetimeLocal(end) : null,
      locationId: locationId === '' ? null : locationId,
      comment: comment.trim() || null,
      expansionIds,
      players: includedPlayers.map((p) => ({
        personId: p.personId,
        score: p.score.trim() === '' ? null : Number(p.score),
        won: p.won,
        firstPlay: p.firstPlay,
      })),
    };
    try {
      const created = await createSession.mutateAsync(payload);
      onSaved?.(created.id);
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
      <div className="flex max-h-full w-[580px] max-w-full flex-col overflow-hidden rounded-2xl border border-border bg-bg shadow-2xl">
        <div className="flex items-center justify-between border-b border-hairline px-6 py-4">
          <div className="font-display text-[17px] font-semibold">{t.logPlay.title}</div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t.logPlay.cancel}
            className="flex h-[30px] w-[30px] items-center justify-center rounded-lg border border-border text-muted2"
          >
            <Icon name="close" size={18} />
          </button>
        </div>

        {/* Stepper */}
        <div className="flex items-center gap-2 border-b border-hairline px-6 py-3.5">
          {[
            { n: 1, label: t.logPlay.step1 },
            { n: 2, label: t.logPlay.step2 },
            { n: 3, label: t.logPlay.step3 },
          ].map((s, i) => (
            <div key={s.n} className="flex flex-1 items-center gap-2">
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full font-display text-[12px] font-semibold ${
                  step >= s.n ? 'bg-accent text-on-accent' : 'bg-chip text-muted'
                }`}
              >
                {s.n}
              </span>
              <span className="text-[12.5px] font-semibold text-muted2">{s.label}</span>
              {i < 2 && <span className="h-px flex-1 bg-border" />}
            </div>
          ))}
        </div>

        <div className="scr flex-1 overflow-y-auto px-6 py-5">
          {step === 1 && (
            <div>
              <div className="mb-3.5 flex items-center gap-2 rounded-lg border border-border bg-input px-3 py-2.5 text-muted">
                <Icon name="search" size={18} />
                <input
                  value={gameQuery}
                  onChange={(e) => setGameQuery(e.target.value)}
                  placeholder={t.logPlay.searchGame}
                  aria-label={t.logPlay.searchGame}
                  className="w-full bg-transparent text-[13px] text-text outline-none placeholder:text-muted"
                />
              </div>
              {games.length === 0 ? (
                <p className="text-[13px] text-muted">{t.logPlay.noGames}</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {filteredGames.map((g: GameDto) => {
                    const selected = g.id === gameId;
                    return (
                      <button
                        type="button"
                        key={g.id}
                        onClick={() => {
                          setGameId(g.id);
                          setExpansionIds([]);
                        }}
                        className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left ${
                          selected ? 'border-accent bg-accent-soft' : 'border-border bg-card'
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="text-[13px] font-semibold">{g.title}</div>
                        </div>
                        <Icon
                          name={selected ? 'check_circle' : 'radio_button_unchecked'}
                          size={20}
                          className={selected ? 'text-accent' : 'text-faint'}
                        />
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {step === 2 && (
            <div>
              {expansions.length > 0 && (
                <>
                  <div className="mb-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted">
                    {t.logPlay.expansionsUsed}
                  </div>
                  <div className="mb-5 flex flex-wrap gap-2">
                    {expansions.map((exp) => {
                      const on = expansionIds.includes(exp.id);
                      return (
                        <button
                          type="button"
                          key={exp.id}
                          onClick={() =>
                            setExpansionIds((ids) =>
                              on ? ids.filter((x) => x !== exp.id) : [...ids, exp.id],
                            )
                          }
                          className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-[12.5px] font-semibold ${
                            on
                              ? 'border-accent bg-accent-soft text-accent-text'
                              : 'border-border bg-card text-muted2'
                          }`}
                        >
                          <Icon name={on ? 'check_box' : 'check_box_outline_blank'} size={16} />
                          {exp.title}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}

              <div className="mb-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted">
                {t.logPlay.playersResult}
              </div>
              {people.length === 0 ? (
                <p className="text-[13px] text-muted">{t.logPlay.noPeople}</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {people.map((person) => {
                    const row = players[person.id];
                    const included = row?.include ?? false;
                    return (
                      <div
                        key={person.id}
                        className={`rounded-xl border px-3 py-2.5 ${
                          included ? 'border-accent bg-accent-soft' : 'border-border bg-card'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => togglePlayer(person.id)}
                            aria-label={person.name}
                            className="flex items-center gap-2"
                          >
                            <Icon
                              name={included ? 'check_box' : 'check_box_outline_blank'}
                              size={18}
                              className={included ? 'text-accent' : 'text-faint'}
                            />
                            <span className="text-[12.5px] font-semibold">{person.name}</span>
                          </button>
                          {included && row && (
                            <div className="ml-auto flex items-center gap-2">
                              <input
                                aria-label={`${t.logPlay.score} ${person.name}`}
                                inputMode="numeric"
                                value={row.score}
                                onChange={(e) => patchPlayer(person.id, { score: e.target.value })}
                                placeholder={t.logPlay.score}
                                className="w-16 rounded-lg border border-border bg-input px-2 py-1.5 text-center text-[13px] text-text outline-none focus:border-accent"
                              />
                              <button
                                type="button"
                                onClick={() =>
                                  patchPlayer(person.id, { firstPlay: !row.firstPlay })
                                }
                                className={`rounded-md px-2 py-1.5 text-[10px] font-bold ${
                                  row.firstPlay
                                    ? 'bg-accent-soft text-accent-text'
                                    : 'bg-chip text-muted'
                                }`}
                              >
                                {t.logPlay.firstPlay}
                              </button>
                              <button
                                type="button"
                                onClick={() => patchPlayer(person.id, { won: !row.won })}
                                className={`flex items-center gap-1 rounded-md px-2.5 py-1.5 text-[10.5px] font-bold ${
                                  row.won
                                    ? 'bg-accent text-on-accent'
                                    : 'border border-border bg-input text-muted2'
                                }`}
                              >
                                <Icon name="emoji_events" size={14} />
                                {t.logPlay.winner}
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-1.5 text-[11.5px] font-semibold text-muted2">
                  {t.logPlay.start}
                  <input
                    type="datetime-local"
                    aria-label={t.logPlay.start}
                    value={start}
                    onChange={(e) => setStart(e.target.value)}
                    className={inputClass}
                  />
                </label>
                <label className="flex flex-col gap-1.5 text-[11.5px] font-semibold text-muted2">
                  {t.logPlay.end}
                  <input
                    type="datetime-local"
                    aria-label={t.logPlay.end}
                    value={end}
                    onChange={(e) => setEnd(e.target.value)}
                    className={inputClass}
                  />
                </label>
              </div>
              {locations.length > 0 && (
                <label className="flex flex-col gap-1.5 text-[11.5px] font-semibold text-muted2">
                  {t.logPlay.location}
                  <select
                    value={locationId}
                    onChange={(e) =>
                      setLocationId(e.target.value === '' ? '' : Number(e.target.value))
                    }
                    className={inputClass}
                  >
                    <option value="">{t.logPlay.noLocation}</option>
                    {locations.map((loc) => (
                      <option key={loc.id} value={loc.id}>
                        {loc.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <label className="flex flex-col gap-1.5 text-[11.5px] font-semibold text-muted2">
                {t.logPlay.comment}
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={3}
                  className={`${inputClass} resize-none`}
                />
              </label>
              {selectedGame && (
                <div className="rounded-lg bg-accent-soft px-3 py-2.5 text-[12px] font-semibold text-accent-text">
                  {selectedGame.title} · {includedPlayers.length} spillere
                  {expansionIds.length > 0 ? ` · ${expansionIds.length} utvidelser` : ''}
                </div>
              )}
            </div>
          )}

          {error && (
            <p role="alert" className="mt-3 text-[12.5px] font-semibold text-[#c8453a]">
              {error}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 border-t border-hairline px-6 py-3.5">
          {step > 1 && (
            <button
              type="button"
              onClick={() => setStep((s) => Math.max(1, s - 1))}
              className="px-3 py-2 text-[13px] font-semibold text-muted2"
            >
              {t.logPlay.back}
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="ml-auto rounded-lg border border-border bg-card px-4 py-2 text-[13px] font-semibold text-muted2"
          >
            {t.logPlay.cancel}
          </button>
          {step < 3 ? (
            <button
              type="button"
              onClick={goNext}
              className="rounded-lg bg-accent px-4 py-2 text-[13px] font-semibold text-on-accent"
            >
              {t.logPlay.next}
            </button>
          ) : (
            <button
              type="button"
              onClick={save}
              disabled={createSession.isPending}
              className="rounded-lg bg-accent px-4 py-2 text-[13px] font-semibold text-on-accent disabled:opacity-60"
            >
              {createSession.isPending ? t.logPlay.saving : t.logPlay.save}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
