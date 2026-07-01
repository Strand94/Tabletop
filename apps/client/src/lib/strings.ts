import { nb, type Strings } from './strings/nb.js';
import { en } from './strings/en.js';

export type Locale = 'nb' | 'en';

const tables: Record<Locale, Strings> = { nb, en };

/** The active string table. Swapped by the locale provider on language change. */
let active: Strings = nb;

export function setActiveTable(locale: Locale): void {
  active = tables[locale];
}

/**
 * Locale-aware string accessor. Components read `t.section.key` at render time;
 * when the locale changes the provider swaps the active table and remounts the
 * tree, so every reference re-resolves to the new language.
 */
export const t: Strings = new Proxy({} as Strings, {
  get(_target, prop: string): unknown {
    return (active as Record<string, unknown>)[prop];
  },
}) as Strings;

export type { Strings };
