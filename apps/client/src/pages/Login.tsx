import type { JSX } from 'react';
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth.js';
import { t } from '../lib/strings.js';

/** Login screen. On success, routes to the dashboard. */
export function Login(): JSX.Element {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent): Promise<void> {
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

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg p-6 text-text">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-8 shadow-xl">
        <div className="mb-6 flex items-center gap-2.5">
          <span className="text-3xl leading-none text-accent">⚄</span>
          <span className="font-display text-2xl font-semibold tracking-tight">{t.appName}</span>
        </div>
        <h1 className="m-0 font-display text-lg font-semibold">{t.login.title}</h1>
        <p className="mb-5 mt-1 text-[13px] text-muted">{t.login.subtitle}</p>

        <form onSubmit={onSubmit} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1.5 text-[12.5px] font-semibold text-muted2">
            {t.login.username}
            <input
              type="text"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              className="rounded-lg border border-border bg-input px-3 py-2.5 text-[13px] text-text outline-none focus:border-accent"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-[12.5px] font-semibold text-muted2">
            {t.login.password}
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="rounded-lg border border-border bg-input px-3 py-2.5 text-[13px] text-text outline-none focus:border-accent"
            />
          </label>

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
            {submitting ? t.login.loading : t.login.submit}
          </button>
        </form>
      </div>
    </div>
  );
}
