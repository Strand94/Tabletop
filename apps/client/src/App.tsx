import { useEffect, useState } from 'react';

type Health = 'checking' | 'ok' | 'error';

/**
 * Placeholder application root. Proves the client build is served and can reach
 * the API. The real app shell (sidebar, routing, auth) lands in Stage 2.
 */
export function App(): JSX.Element {
  const [health, setHealth] = useState<Health>('checking');

  useEffect(() => {
    let active = true;
    fetch('/api/health')
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('bad status'))))
      .then((body: { status?: string }) => {
        if (active) setHealth(body.status === 'ok' ? 'ok' : 'error');
      })
      .catch(() => {
        if (active) setHealth('error');
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div
      data-theme="light"
      className="flex min-h-screen flex-col items-center justify-center gap-3 bg-bg text-text"
    >
      <div className="flex items-center gap-3">
        <span className="text-3xl text-accent leading-none">⚄</span>
        <span className="font-display text-2xl font-semibold tracking-tight">Tabletop</span>
      </div>
      <p className="text-sm text-muted">Self-hosted board game tracker</p>
      <p className="text-xs text-faint" data-testid="health-status">
        API: {health}
      </p>
    </div>
  );
}
