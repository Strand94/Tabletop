import type { JSX } from 'react';
import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import type { SetupStatus } from '@tabletop/shared';
import { useAuth } from '../lib/auth.js';
import { apiFetch } from '../lib/api.js';
import { t } from '../lib/strings.js';

type Mode = 'loading' | 'login' | 'setup';

/** Login screen. On first run (no users yet) it becomes a create-admin form. */
export function Login(): JSX.Element {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>('loading');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    apiFetch<SetupStatus>('/api/auth/setup-status')
      .then((s) => {
        if (active) setMode(s.needsSetup ? 'setup' : 'login');
      })
      .catch(() => {
        if (active) setMode('login');
      });
    return () => {
      active = false;
    };
  }, []);

  async function onSignIn(e: FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(username, password);
      navigate('/');
    } catch {
      setError(t.login.error);
    } finally {
      setSubmitting(false);
    }
  }

  async function onCreateAdmin(e: FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError(t.login.passwordTooShort);
      return;
    }
    if (password !== confirm) {
      setError(t.login.passwordMismatch);
      return;
    }
    setSubmitting(true);
    try {
      await apiFetch('/api/auth/register', {
        method: 'POST',
        body: { username, password },
      });
      await login(username, password);
      navigate('/');
    } catch {
      setError(t.login.setupError);
    } finally {
      setSubmitting(false);
    }
  }

  const isSetup = mode === 'setup';
  const inputClass =
    'rounded-lg border border-border bg-input px-3 py-2.5 text-[13px] text-text outline-none focus:border-accent';
  const labelClass = 'flex flex-col gap-1.5 text-[12.5px] font-semibold text-muted2';

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg p-6 text-text">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-8 shadow-xl">
        <div className="mb-6 flex items-center gap-2.5">
          <span className="text-3xl leading-none text-accent">⚄</span>
          <span className="font-display text-2xl font-semibold tracking-tight">{t.appName}</span>
        </div>
        <h1 className="m-0 font-display text-lg font-semibold">
          {isSetup ? t.login.setupTitle : t.login.title}
        </h1>
        <p className="mb-5 mt-1 text-[13px] text-muted">
          {isSetup ? t.login.setupSubtitle : t.login.subtitle}
        </p>

        {mode === 'loading' ? (
          <p className="text-[13px] text-muted">{t.common.loading}</p>
        ) : (
          <form onSubmit={isSetup ? onCreateAdmin : onSignIn} className="flex flex-col gap-3">
            <label className={labelClass}>
              {t.login.username}
              <input
                type="text"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className={inputClass}
              />
            </label>
            <label className={labelClass}>
              {t.login.password}
              <input
                type="password"
                autoComplete={isSetup ? 'new-password' : 'current-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className={inputClass}
              />
            </label>
            {isSetup && (
              <label className={labelClass}>
                {t.login.confirmPassword}
                <input
                  type="password"
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  className={inputClass}
                />
              </label>
            )}

            {error && (
              <p role="alert" className="m-0 text-[12.5px] font-semibold text-[#c8453a]">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="mt-1 rounded-lg bg-accent px-4 py-2.5 text-[13px] font-semibold text-on-accent disabled:opacity-60"
            >
              {isSetup
                ? submitting
                  ? t.login.creating
                  : t.login.createAdmin
                : submitting
                  ? t.login.loading
                  : t.login.submit}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
