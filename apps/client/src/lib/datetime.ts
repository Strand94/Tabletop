/** Format a duration in minutes as "2t 05m" / "48m" (Norwegian short form). */
export function durationLabel(minutes: number | null): string {
  if (minutes == null) return '';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  return `${h}t ${m.toString().padStart(2, '0')}m`;
}

/** Format an ISO datetime as a short local date, e.g. "24. jun". */
export function shortDate(iso: string, locale = 'nb-NO'): string {
  return new Date(iso).toLocaleDateString(locale, { day: '2-digit', month: 'short' });
}

/** Format an ISO datetime as a full local date + time. */
export function longDateTime(iso: string, locale = 'nb-NO'): string {
  return new Date(iso).toLocaleString(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Convert an ISO datetime to the value a `datetime-local` input expects. */
export function toDatetimeLocal(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Convert a `datetime-local` value to an ISO string with offset. */
export function fromDatetimeLocal(value: string): string {
  return new Date(value).toISOString();
}

/** Winners' display name(s) for a session, or "—". */
export function winnersLabel(players: { name: string; won: boolean }[]): string {
  const winners = players.filter((p) => p.won).map((p) => p.name);
  return winners.length ? winners.join(', ') : '—';
}
