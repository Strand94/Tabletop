import { useNavigate, useParams } from 'react-router-dom';
import { useDeleteSession, useSession } from '../lib/sessions-api.js';
import { useAuth } from '../lib/auth.js';
import { Icon } from '../components/Icon.js';
import { durationLabel, longDateTime } from '../lib/datetime.js';
import { t } from '../lib/strings.js';

const cover =
  'repeating-linear-gradient(135deg, var(--ph1), var(--ph1) 5px, var(--ph2) 5px, var(--ph2) 10px)';
const avatar =
  'repeating-linear-gradient(135deg, var(--av1), var(--av1) 4px, var(--av2) 4px, var(--av2) 8px)';

/** Session detail: players + result, expansions, comment, photos. */
export function SessionDetail(): JSX.Element {
  const { id } = useParams();
  const sessionId = Number(id);
  const { data: session, isLoading, isError } = useSession(sessionId);
  const del = useDeleteSession();
  const navigate = useNavigate();
  const { user } = useAuth();

  if (isLoading) return <p className="p-7 text-[13px] text-muted">{t.common.loading}</p>;
  if (isError || !session)
    return <p className="p-7 text-[13px] text-muted">{t.sessions.notFound}</p>;

  // Rank players by score (winners first, then by score desc).
  const ranked = [...session.players].sort((a, b) => {
    if (a.won !== b.won) return a.won ? -1 : 1;
    return (b.score ?? -Infinity) - (a.score ?? -Infinity);
  });

  async function onDelete(): Promise<void> {
    if (!window.confirm(t.players.confirmDelete)) return;
    await del.mutateAsync(sessionId);
    navigate('/sessions');
  }

  return (
    <div className="px-7 pb-8 pt-4">
      <button
        type="button"
        onClick={() => navigate('/sessions')}
        className="mb-4 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-muted2"
      >
        <Icon name="arrow_back" size={17} />
        {t.sessions.back}
      </button>

      <div className="grid grid-cols-[1.5fr_1fr] gap-6">
        <div className="flex flex-col gap-4">
          {/* Header */}
          <div className="flex items-center gap-4 rounded-2xl border border-border bg-card px-5 py-4">
            <div className="h-[68px] w-[54px] flex-none rounded-lg" style={{ background: cover }} />
            <div className="min-w-0">
              <h2 className="m-0 font-display text-[20px] font-semibold tracking-tight">
                {session.gameTitle}
              </h2>
              <div className="mt-1 text-[12.5px] text-muted">
                {longDateTime(session.start)}
                {session.durationMinutes != null && ` · ${durationLabel(session.durationMinutes)}`}
                {session.location && (
                  <>
                    {' · '}
                    <b className="text-muted2">{session.location.name}</b>
                  </>
                )}
              </div>
              {session.expansions.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {session.expansions.map((exp) => (
                    <span
                      key={exp.id}
                      className="rounded-full bg-accent-soft px-2.5 py-1 text-[11px] font-semibold text-accent-text"
                    >
                      + {exp.title}
                    </span>
                  ))}
                </div>
              )}
            </div>
            {(user?.role === 'ADMIN' || user?.role === 'MEMBER') && (
              <button
                type="button"
                onClick={onDelete}
                aria-label={t.players.delete}
                className="ml-auto flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted2"
              >
                <Icon name="delete" size={16} />
              </button>
            )}
          </div>

          {/* Players table */}
          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            <div className="grid grid-cols-[1.4fr_.9fr_.7fr_.9fr] gap-3 border-b border-border px-4 py-3 text-[10.5px] font-semibold uppercase tracking-wide text-muted">
              <span>{t.sessions.colPlayers}</span>
              <span>{t.sessions.color}</span>
              <span className="text-right">{t.sessions.score}</span>
              <span className="text-right">{t.sessions.result}</span>
            </div>
            {ranked.map((p, i) => (
              <div
                key={p.personId}
                className={`grid grid-cols-[1.4fr_.9fr_.7fr_.9fr] items-center gap-3 border-b border-hairline px-4 py-3 last:border-b-0 ${
                  p.won ? 'bg-accent-soft' : ''
                }`}
                data-testid="session-player"
              >
                <div className="flex items-center gap-2.5">
                  <div className="h-7 w-7 flex-none rounded-full" style={{ background: avatar }} />
                  <span className="text-[12.5px] font-semibold">{p.name}</span>
                  {p.firstPlay && (
                    <span className="rounded bg-accent-soft px-1.5 py-0.5 text-[9.5px] font-bold text-accent-text">
                      {t.sessions.firstPlay}
                    </span>
                  )}
                </div>
                <span className="text-[12px] text-muted2">{p.color ?? '—'}</span>
                <span className="text-right font-display text-[14px] font-semibold">
                  {p.score ?? '—'}
                </span>
                <span className="text-right">
                  {p.won ? (
                    <span className="rounded-full bg-accent px-2.5 py-1 text-[10.5px] font-bold text-on-accent">
                      {t.sessions.won}
                    </span>
                  ) : (
                    <span className="text-[12px] text-muted">{i + 1}.</span>
                  )}
                </span>
              </div>
            ))}
          </div>

          {session.comment && (
            <div className="rounded-2xl border border-border bg-card px-5 py-4">
              <div className="mb-1.5 text-[11px] font-semibold text-muted">
                {t.sessions.comment}
              </div>
              <p className="m-0 text-[13px] leading-relaxed text-muted2">{session.comment}</p>
            </div>
          )}
        </div>

        {/* Right column — rating placeholder (Stage 7) + photos */}
        <div className="flex flex-col gap-4">
          <div className="rounded-2xl border border-dashed border-border bg-card px-5 py-4 text-[12.5px] text-muted">
            Din vurdering av kvelden kommer snart.
          </div>
          {session.images.length > 0 && (
            <div className="rounded-2xl border border-border bg-card px-5 py-4">
              <div className="mb-2.5 text-[11px] font-semibold text-muted">{t.sessions.photos}</div>
              <div className="grid grid-cols-2 gap-2.5">
                {session.images.map((img) => (
                  <img
                    key={img.id}
                    src={img.imagePath}
                    alt=""
                    className="aspect-[4/3] w-full rounded-lg object-cover"
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
