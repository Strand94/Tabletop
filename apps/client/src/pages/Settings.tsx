import type { JSX } from 'react';
import { useAuth } from '../lib/auth.js';
import { useTheme } from '../lib/theme.js';
import { useLocale, type LocaleSetter } from '../lib/i18n.js';
import { apiFetch } from '../lib/api.js';
import { Icon } from '../components/Icon.js';
import { t } from '../lib/strings.js';
import type { Locale } from '../lib/strings.js';

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
  children: React.ReactNode;
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
        <Row title={t.settings.enableSync} hint={t.settings.syncHint} last>
          <div className="flex items-center gap-2">
            <span className="rounded bg-chip px-2 py-1 text-[9.5px] font-bold text-muted2">
              {t.settings.offByDefault}
            </span>
            <div className="relative h-[25px] w-11 rounded-full bg-track opacity-60">
              <span className="absolute left-[3px] top-[3px] h-[19px] w-[19px] rounded-full bg-card shadow" />
            </div>
          </div>
        </Row>
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
    </div>
  );
}
