import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { setActiveTable, type Locale } from './strings.js';

const STORAGE_KEY = 'tabletop.locale';

function initialLocale(): Locale {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored === 'en' ? 'en' : 'nb';
}

export type LocaleSetter = (locale: Locale) => void;

interface LocaleContextValue {
  locale: Locale;
  setLocale: LocaleSetter;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

/**
 * Provides the active locale and applies it to the string table. Changing the
 * locale remounts the subtree (via `key`) so all components re-read strings.
 * Persisted to localStorage; the settings page also syncs it to the user record.
 */
export function LocaleProvider({ children }: { children: ReactNode }): JSX.Element {
  const [locale, setLocaleState] = useState<Locale>(() => {
    const initial = initialLocale();
    setActiveTable(initial);
    return initial;
  });

  const setLocale = useCallback((next: Locale) => {
    setActiveTable(next);
    localStorage.setItem(STORAGE_KEY, next);
    document.documentElement.setAttribute('lang', next);
    setLocaleState(next);
  }, []);

  const value = useMemo(() => ({ locale, setLocale }), [locale, setLocale]);

  return (
    <LocaleContext.Provider value={value}>
      <div key={locale} className="contents">
        {children}
      </div>
    </LocaleContext.Provider>
  );
}

export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error('useLocale must be used within a LocaleProvider');
  return ctx;
}
