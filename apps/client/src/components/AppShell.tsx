import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { Icon } from './Icon.js';
import { useGames } from '../lib/games-api.js';
import { useAuth } from '../lib/auth.js';
import { useTheme } from '../lib/theme.js';
import { useLocale } from '../lib/i18n.js';
import { useLogPlay } from '../lib/log-play.js';
import { t } from '../lib/strings.js';

interface NavItem {
  to: string;
  icon: string;
  label: string;
  subtitle: string;
}

const NAV: NavItem[] = [
  { to: '/', icon: 'space_dashboard', label: t.nav.dashboard, subtitle: 'Oversikt over samlingen' },
  {
    to: '/collection',
    icon: 'grid_view',
    label: t.nav.collection,
    subtitle: 'Spill og ønskeliste',
  },
  { to: '/sessions', icon: 'casino', label: t.nav.sessions, subtitle: 'Loggede partier' },
  { to: '/players', icon: 'group', label: t.nav.players, subtitle: 'Spillere i husstanden' },
  { to: '/settings', icon: 'settings', label: t.nav.settings, subtitle: 'Innstillinger' },
];

function avatarStyle(a = 'var(--av1)', b = 'var(--av2)'): React.CSSProperties {
  return {
    background: `repeating-linear-gradient(135deg, ${a}, ${a} 4px, ${b} 4px, ${b} 8px)`,
  };
}

/** Application chrome: sidebar nav, top bar, theme toggle, user chip. */
export function AppShell(): JSX.Element {
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const { locale, setLocale } = useLocale();
  const { openLogPlay } = useLogPlay();
  const { data: shelfGames = [] } = useGames({ neverPlayed: true });
  const location = useLocation();
  const active = NAV.find((n) =>
    n.to === '/' ? location.pathname === '/' : location.pathname.startsWith(n.to),
  );

  return (
    <div className="flex min-h-screen bg-bg text-text">
      {/* Sidebar */}
      <aside className="flex w-56 flex-none flex-col border-r border-hairline bg-sidebar p-4">
        <div className="flex items-center gap-2.5 px-1.5 pb-5">
          <span className="text-2xl leading-none text-accent">⚄</span>
          <span className="font-display text-[17px] font-semibold tracking-tight">{t.appName}</span>
        </div>
        <nav className="flex flex-col gap-0.5">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold ${
                  isActive ? 'bg-accent-soft text-accent-text' : 'text-muted2 hover:bg-chip'
                }`
              }
            >
              <Icon name={item.icon} size={19} />
              {item.label}
            </NavLink>
          ))}
        </nav>

        {shelfGames.length > 0 && (
          <Link
            to="/collection?shelf=1"
            className="mt-[18px] block rounded-xl border border-border bg-accent-soft p-3 no-underline"
          >
            <div className="text-[11.5px] font-semibold text-accent-text">
              {t.shelfOfShame.title}
            </div>
            <div className="mt-0.5 text-[11px] leading-snug text-muted2">
              <b>{shelfGames.length}</b> · {t.shelfOfShame.body}
            </div>
          </Link>
        )}

        <div className="mt-auto flex items-center gap-2.5 border-t border-hairline px-1.5 pb-1 pt-2.5">
          <div className="h-8 w-8 flex-none rounded-full" style={avatarStyle()} />
          <div className="min-w-0">
            <div className="text-[13px] font-semibold">{user?.username ?? '—'}</div>
            <div className="text-[11px] text-muted">{user ? t.roles[user.role] : ''}</div>
          </div>
          <button
            type="button"
            onClick={toggle}
            title={t.common.toggleTheme}
            aria-label={t.common.toggleTheme}
            className="ml-auto flex h-[30px] w-[30px] items-center justify-center rounded-lg border border-border text-muted2"
          >
            <Icon name={theme === 'light' ? 'dark_mode' : 'light_mode'} size={18} />
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="relative min-w-0 flex-1 overflow-y-auto">
        <header className="sticky top-0 z-10 flex items-center gap-4 border-b border-hairline bg-[var(--topbar)] px-7 py-4 backdrop-blur">
          <div className="min-w-0">
            <h1 className="m-0 font-display text-xl font-semibold tracking-tight">
              {active?.label ?? t.appName}
            </h1>
            <div className="mt-0.5 text-[12.5px] text-muted">{active?.subtitle ?? ''}</div>
          </div>
          <div className="ml-auto flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setLocale(locale === 'nb' ? 'en' : 'nb')}
              title={t.language.switcherLabel}
              aria-label={t.language.switcherLabel}
              className="rounded-lg border border-border px-2.5 py-2 text-[12.5px] font-semibold text-muted2"
            >
              {locale === 'nb' ? '🇳🇴 NO' : '🇬🇧 EN'}
            </button>
            <button
              type="button"
              onClick={() => openLogPlay()}
              className="flex items-center gap-1.5 rounded-lg bg-accent px-3.5 py-2 text-[13px] font-semibold text-on-accent"
            >
              <Icon name="add" size={18} />
              {t.topbar.logPlay}
            </button>
            <button
              type="button"
              onClick={logout}
              className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-[12.5px] font-semibold text-muted2"
            >
              <Icon name="logout" size={16} />
              {t.common.signOut}
            </button>
          </div>
        </header>
        <Outlet />
      </main>
    </div>
  );
}
