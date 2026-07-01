import { useState } from 'react';
import type { PersonDto } from '@tabletop/shared';
import { useAuth } from '../lib/auth.js';
import { useDeletePerson, usePeople } from '../lib/people-api.js';
import { PersonFormModal } from '../components/PersonFormModal.js';
import { Icon } from '../components/Icon.js';
import { t } from '../lib/strings.js';

const avatar =
  'repeating-linear-gradient(135deg, var(--av1), var(--av1) 5px, var(--av2) 5px, var(--av2) 10px)';

function accountLabel(person: PersonDto): string {
  if (!person.account) return t.players.guest;
  const role = person.account.role === 'ADMIN' ? t.roles.ADMIN : t.roles.MEMBER;
  return `${role} · ${t.players.account}`;
}

/** Players page: cards for each person. Per-player stats arrive in Stage 8. */
export function Players(): JSX.Element {
  const { user } = useAuth();
  const { data: people = [], isLoading } = usePeople();
  const del = useDeletePerson();
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<PersonDto | null>(null);
  const isAdmin = user?.role === 'ADMIN';
  const withAccounts = people.filter((p) => p.account).length;

  return (
    <div className="px-7 pb-8 pt-5">
      <div className="mb-4 flex items-center">
        <div className="text-[12.5px] text-muted">
          {people.length} {t.players.countSuffix} · {withAccounts} {t.players.withAccounts}
        </div>
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="ml-auto flex items-center gap-1.5 rounded-lg bg-accent px-3.5 py-2 text-[13px] font-semibold text-on-accent"
        >
          <Icon name="person_add" size={18} />
          {t.players.add}
        </button>
      </div>

      {isLoading ? (
        <p className="text-[13px] text-muted">{t.common.loading}</p>
      ) : people.length === 0 ? (
        <p className="text-[13px] text-muted" data-testid="players-empty">
          {t.players.empty}
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {people.map((person) => (
            <div
              key={person.id}
              className="rounded-2xl border border-border bg-card p-[18px]"
              data-testid="person-card"
            >
              <div className="flex items-center gap-3">
                <div
                  className="h-[46px] w-[46px] flex-none rounded-full"
                  style={{ background: avatar }}
                />
                <div className="min-w-0 flex-1">
                  <div className="text-[15px] font-semibold">{person.name}</div>
                  <div
                    className={`text-[11px] font-semibold ${
                      person.account?.role === 'ADMIN' ? 'text-accent-text' : 'text-muted'
                    }`}
                  >
                    {accountLabel(person)}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setEditing(person)}
                  aria-label={`${t.gameDetail.edit} ${person.name}`}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted2"
                >
                  <Icon name="edit" size={15} />
                </button>
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm(t.players.confirmDelete)) del.mutate(person.id);
                    }}
                    aria-label={`${t.players.delete} ${person.name}`}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted2"
                  >
                    <Icon name="delete" size={15} />
                  </button>
                )}
              </div>
              <div className="mt-3.5 border-t border-hairline pt-3 text-[11.5px] text-muted">
                {t.players.noSessions}
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreate && <PersonFormModal onClose={() => setShowCreate(false)} />}
      {editing && <PersonFormModal person={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
