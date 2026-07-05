import type { JSX, FormEvent } from 'react';
import { useState } from 'react';
import type { AdminCreateUserInput, Role, UserPublic } from '@tabletop/shared';
import { useAuth } from '../lib/auth.js';
import { useTheme } from '../lib/theme.js';
import { useLocale, type LocaleSetter } from '../lib/i18n.js';
import { apiFetch, ApiError } from '../lib/api.js';
import { useBggCatalogRefresh } from '../lib/bgg-api.js';
import { useCreateUser, useDeleteUser, useUpdateUser, useUsers } from '../lib/users-api.js';
import { Icon } from '../components/Icon.js';
import { t } from '../lib/strings.js';
import type { Locale } from '../lib/strings.js';

function errorMessage(err: unknown): string {
  return err instanceof ApiError ? err.message : t.common.error;
}

function Section({ title, children }: { title: string; children: React.ReactNode }): JSX.Element {
  return (
    <div className="mb-4">
      <div className="mb-2 px-0.5 font-mono text-[11px] font-semibold uppercase tracking-wider text-muted">
        {title}
      </div>
      <div className="rounded-2xl border border-border bg-card px-5">{children}</div>
    </div>
  );
}

function Row({
  title,
  hint,
  children,
  last,
}: {
  title: string;
  hint?: string;
  children?: React.ReactNode;
  last?: boolean;
}): JSX.Element {
  return (
    <div className={`flex items-center gap-4 py-4 ${last ? '' : 'border-b border-hairline'}`}>
      <div className="flex-1">
        <div className="text-[13.5px] font-semibold">{title}</div>
        {hint && <div className="mt-0.5 text-[11.5px] text-muted">{hint}</div>}
      </div>
      {children}
    </div>
  );
}

function Segment<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}): JSX.Element {
  return (
    <div className="flex gap-1 rounded-lg bg-chip p-[3px]">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`rounded-md px-3.5 py-1.5 text-[12.5px] font-semibold ${
            value === o.value ? 'bg-card text-text' : 'text-muted'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

async function persistLocale(locale: Locale, setLocale: LocaleSetter): Promise<void> {
  setLocale(locale);
  // Best-effort: persist the preference to the user record too.
  try {
    await apiFetch('/api/auth/me', { method: 'PATCH', body: { locale } });
  } catch {
    // Non-fatal — the device localStorage preference still applies.
  }
}

/** Download an authenticated export as a file. */
async function downloadExport(format: 'json' | 'csv'): Promise<void> {
  const data = await apiFetch<unknown>(`/api/export/${format}`);
  const blob =
    format === 'json'
      ? new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      : new Blob([String(data)], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = format === 'json' ? 'tabletop-export.json' : 'tabletop-games.csv';
  a.click();
  URL.revokeObjectURL(url);
}

/** Settings: appearance, language, and v2 seams (BGG sync + export) as stubs. */
export function Settings(): JSX.Element {
  const { user } = useAuth();
  const { theme, toggle } = useTheme();
  const { locale, setLocale } = useLocale();
  const isAdmin = user?.role === 'ADMIN';
  const refresh = useBggCatalogRefresh();
  const refreshStatus = refresh.isPending
    ? undefined
    : refresh.error
      ? refresh.error instanceof ApiError
        ? refresh.error.message
        : t.settings.refreshFailed
      : refresh.data
        ? refresh.data.status === 'refreshed'
          ? t.settings.catalogUpdated.replace('{n}', String(refresh.data.count))
          : t.settings.catalogUpToDate
        : undefined;

  return (
    <div className="max-w-[760px] px-7 pb-9 pt-[22px]">
      <Section title={t.settings.appearance}>
        <Row title={t.settings.theme} hint={t.settings.themeHint} last>
          <Segment
            options={[
              { value: 'light', label: t.settings.light },
              { value: 'dark', label: t.settings.dark },
            ]}
            value={theme}
            onChange={(v) => {
              if (v !== theme) toggle();
            }}
          />
        </Row>
      </Section>

      <Section title={t.settings.general}>
        <Row title={t.settings.language} hint={t.settings.languageHint} last>
          <Segment
            options={[
              { value: 'nb', label: t.language.nb },
              { value: 'en', label: t.language.en },
            ]}
            value={locale}
            onChange={(v) => void persistLocale(v, setLocale)}
          />
        </Row>
      </Section>

      <Section title={t.settings.bggSync}>
        <Row title={t.settings.enableSync} hint={t.settings.syncHint} last={!isAdmin}>
          <div className="flex items-center gap-2">
            <span className="rounded bg-chip px-2 py-1 text-[9.5px] font-bold text-muted2">
              {t.settings.offByDefault}
            </span>
            <div className="relative h-[25px] w-11 rounded-full bg-track opacity-60">
              <span className="absolute left-[3px] top-[3px] h-[19px] w-[19px] rounded-full bg-card shadow" />
            </div>
          </div>
        </Row>
        {isAdmin && (
          <Row title={t.settings.refreshCatalog} hint={t.settings.refreshCatalogHint} last>
            <div className="flex items-center gap-3">
              {refreshStatus && <span className="text-[11.5px] text-muted">{refreshStatus}</span>}
              <button
                type="button"
                disabled={refresh.isPending}
                onClick={() => refresh.mutate()}
                className="flex items-center gap-1.5 rounded-lg border border-border bg-input px-3 py-2 text-[12.5px] font-semibold text-muted2 disabled:opacity-60"
              >
                <Icon name="sync" size={16} className={refresh.isPending ? 'animate-spin' : ''} />
                {t.settings.refreshCatalog}
              </button>
            </div>
          </Row>
        )}
      </Section>

      {isAdmin && (
        <Section title={t.settings.data}>
          <Row title={t.settings.exportCollection} hint={t.settings.exportHint} last>
            <div className="flex gap-2">
              {(['json', 'csv'] as const).map((fmt) => (
                <button
                  key={fmt}
                  type="button"
                  onClick={() => void downloadExport(fmt)}
                  className="flex items-center gap-1.5 rounded-lg border border-border bg-input px-3 py-2 text-[12.5px] font-semibold text-muted2"
                >
                  <Icon name="download" size={16} />
                  {fmt.toUpperCase()}
                </button>
              ))}
            </div>
          </Row>
        </Section>
      )}

      {isAdmin && <UsersSection currentUserId={user?.id ?? null} />}
    </div>
  );
}

// Resolved per render (not at module load) so the labels follow locale changes.
function roleOptions(): { value: Role; label: string }[] {
  return [
    { value: 'ADMIN', label: t.roles.ADMIN },
    { value: 'MEMBER', label: t.roles.MEMBER },
  ];
}

/** Admin-only user management: list, re-role, reset password, delete, add. */
function UsersSection({ currentUserId }: { currentUserId: number | null }): JSX.Element {
  const { data: users = [] } = useUsers();
  const [creating, setCreating] = useState(false);
  const [resetting, setResetting] = useState<UserPublic | null>(null);
  const [deleting, setDeleting] = useState<UserPublic | null>(null);

  const adminCount = users.filter((u) => u.role === 'ADMIN').length;

  return (
    <>
      <Section title={t.settings.users.title}>
        {users.length === 0 ? (
          <Row title={t.settings.users.empty} last />
        ) : (
          users.map((u, i) => {
            const isSelf = u.id === currentUserId;
            const isOnlyAdmin = u.role === 'ADMIN' && adminCount <= 1;
            return (
              <UserRow
                key={u.id}
                user={u}
                isSelf={isSelf}
                isOnlyAdmin={isOnlyAdmin}
                last={i === users.length - 1}
                onResetPassword={() => setResetting(u)}
                onDelete={() => setDeleting(u)}
              />
            );
          })
        )}
      </Section>

      <div className="mb-4 flex justify-end">
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-[12.5px] font-semibold text-on-accent"
        >
          <Icon name="person_add" size={16} />
          {t.settings.users.addUser}
        </button>
      </div>

      {creating && <CreateUserModal onClose={() => setCreating(false)} />}
      {resetting && <ResetPasswordModal user={resetting} onClose={() => setResetting(null)} />}
      {deleting && <DeleteUserModal user={deleting} onClose={() => setDeleting(null)} />}
    </>
  );
}

function UserRow({
  user,
  isSelf,
  isOnlyAdmin,
  last,
  onResetPassword,
  onDelete,
}: {
  user: UserPublic;
  isSelf: boolean;
  isOnlyAdmin: boolean;
  last: boolean;
  onResetPassword: () => void;
  onDelete: () => void;
}): JSX.Element {
  const updateUser = useUpdateUser(user.id);
  const [error, setError] = useState<string | null>(null);
  // Demoting is blocked for yourself and for the only remaining admin.
  const demoteDisabled = isSelf || isOnlyAdmin;
  const deleteDisabled = isSelf || isOnlyAdmin;

  function changeRole(role: Role): void {
    if (role === user.role) return;
    if (role === 'MEMBER' && demoteDisabled) return;
    setError(null);
    updateUser.mutate({ role }, { onError: (err) => setError(errorMessage(err)) });
  }

  return (
    <div className={`flex items-center gap-4 py-4 ${last ? '' : 'border-b border-hairline'}`}>
      <div className="flex-1">
        <div className="flex items-center gap-2 text-[13.5px] font-semibold">
          {user.username}
          {isSelf && (
            <span className="rounded bg-chip px-1.5 py-0.5 text-[9.5px] font-bold text-muted2">
              {t.settings.users.you}
            </span>
          )}
        </div>
        <div className="mt-0.5 text-[11.5px] text-muted">
          {user.email ?? t.settings.users.noEmail} · {user.locale}
        </div>
        {error && (
          <div role="alert" className="mt-1 text-[11.5px] font-semibold text-[#c8453a]">
            {error}
          </div>
        )}
      </div>
      <div className="flex items-center gap-2">
        <div className="flex gap-1 rounded-lg bg-chip p-[3px]">
          {roleOptions().map((o) => {
            const active = user.role === o.value;
            const disabled = o.value === 'MEMBER' && demoteDisabled;
            return (
              <button
                key={o.value}
                type="button"
                disabled={disabled || updateUser.isPending}
                onClick={() => changeRole(o.value)}
                className={`rounded-md px-3 py-1.5 text-[12px] font-semibold disabled:opacity-40 ${
                  active ? 'bg-card text-text' : 'text-muted'
                }`}
              >
                {o.label}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={onResetPassword}
          aria-label={t.settings.users.resetPassword}
          title={t.settings.users.resetPassword}
          className="flex h-[34px] w-[34px] items-center justify-center rounded-lg border border-border text-muted2"
        >
          <Icon name="key" size={16} />
        </button>
        <button
          type="button"
          disabled={deleteDisabled}
          onClick={onDelete}
          aria-label={t.settings.users.delete}
          title={t.settings.users.delete}
          className="flex h-[34px] w-[34px] items-center justify-center rounded-lg border border-border text-muted2 disabled:opacity-40"
        >
          <Icon name="delete" size={16} />
        </button>
      </div>
    </div>
  );
}

/** Fixed overlay + card, mirroring GameFormModal's lightweight modal pattern. */
function ModalShell({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center bg-black/40 p-6 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
    >
      <div className="flex max-h-full w-[420px] max-w-full flex-col overflow-hidden rounded-2xl border border-border bg-bg shadow-2xl">
        <div className="flex items-center justify-between border-b border-hairline px-6 py-4">
          <div className="font-display text-[17px] font-semibold">{title}</div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t.settings.users.cancel}
            className="flex h-[30px] w-[30px] items-center justify-center rounded-lg border border-border text-muted2"
          >
            <Icon name="close" size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ModalField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <label className="flex flex-col gap-1.5 text-[11.5px] font-semibold text-muted2">
      {label}
      {children}
    </label>
  );
}

const modalInputClass =
  'w-full rounded-lg border border-border bg-input px-3 py-2 text-[13px] text-text outline-none focus:border-accent';

function CreateUserModal({ onClose }: { onClose: () => void }): JSX.Element {
  const createUser = useCreateUser();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [role, setRole] = useState<Role>('MEMBER');
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);
    if (username.trim() === '') {
      setError(t.settings.users.usernameRequired);
      return;
    }
    if (password.length < 8) {
      setError(t.settings.users.passwordTooShort);
      return;
    }
    if (password !== confirm) {
      setError(t.settings.users.passwordMismatch);
      return;
    }
    const payload: AdminCreateUserInput = {
      username: username.trim(),
      password,
      role,
      ...(email.trim() ? { email: email.trim() } : {}),
    };
    try {
      await createUser.mutateAsync(payload);
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <ModalShell title={t.settings.users.createTitle} onClose={onClose}>
      <form onSubmit={onSubmit} className="flex flex-col gap-4 overflow-y-auto px-6 py-5">
        <ModalField label={t.settings.users.username}>
          <input
            aria-label={t.settings.users.username}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className={modalInputClass}
            required
          />
        </ModalField>
        <ModalField label={t.settings.users.emailOptional}>
          <input
            type="email"
            aria-label={t.settings.users.email}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={modalInputClass}
          />
        </ModalField>
        <ModalField label={t.settings.users.password}>
          <input
            type="password"
            aria-label={t.settings.users.password}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={modalInputClass}
            required
          />
        </ModalField>
        <ModalField label={t.settings.users.confirmPassword}>
          <input
            type="password"
            aria-label={t.settings.users.confirmPassword}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className={modalInputClass}
            required
          />
        </ModalField>
        <ModalField label={t.settings.users.role}>
          <div className="flex gap-1 rounded-lg bg-chip p-1">
            {roleOptions().map((o) => (
              <button
                type="button"
                key={o.value}
                onClick={() => setRole(o.value)}
                className={`flex-1 rounded-md px-3 py-1.5 text-[12.5px] font-semibold ${
                  role === o.value ? 'bg-card text-text' : 'text-muted'
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </ModalField>
        {error && (
          <p role="alert" className="m-0 text-[12.5px] font-semibold text-[#c8453a]">
            {error}
          </p>
        )}
        <ModalFooter
          onClose={onClose}
          pending={createUser.isPending}
          submitLabel={t.settings.users.create}
          pendingLabel={t.settings.users.creating}
        />
      </form>
    </ModalShell>
  );
}

function ResetPasswordModal({
  user,
  onClose,
}: {
  user: UserPublic;
  onClose: () => void;
}): JSX.Element {
  const updateUser = useUpdateUser(user.id);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError(t.settings.users.passwordTooShort);
      return;
    }
    if (password !== confirm) {
      setError(t.settings.users.passwordMismatch);
      return;
    }
    try {
      await updateUser.mutateAsync({ password });
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <ModalShell title={t.settings.users.resetPasswordTitle} onClose={onClose}>
      <form onSubmit={onSubmit} className="flex flex-col gap-4 overflow-y-auto px-6 py-5">
        <p className="m-0 text-[12.5px] text-muted">
          {t.settings.users.resetPasswordHint.replace('{name}', user.username)}
        </p>
        <ModalField label={t.settings.users.password}>
          <input
            type="password"
            aria-label={t.settings.users.password}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={modalInputClass}
            required
          />
        </ModalField>
        <ModalField label={t.settings.users.confirmPassword}>
          <input
            type="password"
            aria-label={t.settings.users.confirmPassword}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className={modalInputClass}
            required
          />
        </ModalField>
        {error && (
          <p role="alert" className="m-0 text-[12.5px] font-semibold text-[#c8453a]">
            {error}
          </p>
        )}
        <ModalFooter
          onClose={onClose}
          pending={updateUser.isPending}
          submitLabel={t.settings.users.save}
          pendingLabel={t.settings.users.saving}
        />
      </form>
    </ModalShell>
  );
}

function DeleteUserModal({
  user,
  onClose,
}: {
  user: UserPublic;
  onClose: () => void;
}): JSX.Element {
  const deleteUser = useDeleteUser();
  const [error, setError] = useState<string | null>(null);

  async function onConfirm(): Promise<void> {
    setError(null);
    try {
      await deleteUser.mutateAsync(user.id);
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <ModalShell title={t.settings.users.deleteTitle} onClose={onClose}>
      <div className="flex flex-col gap-4 px-6 py-5">
        <p className="m-0 text-[13px] text-text">
          {t.settings.users.confirmDelete.replace('{name}', user.username)}
        </p>
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
            {t.settings.users.cancel}
          </button>
          <button
            type="button"
            disabled={deleteUser.isPending}
            onClick={() => void onConfirm()}
            className="rounded-lg bg-[#c8453a] px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-60"
          >
            {deleteUser.isPending ? t.settings.users.saving : t.settings.users.delete}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

function ModalFooter({
  onClose,
  pending,
  submitLabel,
  pendingLabel,
}: {
  onClose: () => void;
  pending: boolean;
  submitLabel: string;
  pendingLabel: string;
}): JSX.Element {
  return (
    <div className="flex items-center justify-end gap-2 border-t border-hairline pt-4">
      <button
        type="button"
        onClick={onClose}
        className="rounded-lg border border-border bg-card px-4 py-2 text-[13px] font-semibold text-muted2"
      >
        {t.settings.users.cancel}
      </button>
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-accent px-4 py-2 text-[13px] font-semibold text-on-accent disabled:opacity-60"
      >
        {pending ? pendingLabel : submitLabel}
      </button>
    </div>
  );
}
