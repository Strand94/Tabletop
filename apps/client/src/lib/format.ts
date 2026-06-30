import type { GameDto } from '@tabletop/shared';

/** "1–4", "2", or "" when unknown. */
export function playersLabel(game: Pick<GameDto, 'minPlayers' | 'maxPlayers'>): string {
  const { minPlayers: min, maxPlayers: max } = game;
  if (min && max) return min === max ? `${min}` : `${min}–${max}`;
  return (min ?? max)?.toString() ?? '';
}

/** "60m", "60–90m", or "" when unknown. */
export function playtimeLabel(game: Pick<GameDto, 'minPlaytime' | 'maxPlaytime'>): string {
  const { minPlaytime: min, maxPlaytime: max } = game;
  if (min && max) return min === max ? `${min}m` : `${min}–${max}m`;
  const single = min ?? max;
  return single ? `${single}m` : '';
}

/** Format a price with the game's currency using Intl, falling back to a suffix. */
export function priceLabel(amount: number | null, currency: string, locale = 'nb-NO'): string {
  if (amount == null) return '';
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(amount);
  } catch {
    return `${new Intl.NumberFormat(locale).format(amount)} ${currency}`;
  }
}

/** Compact integer formatting, e.g. 41280 -> "41 280". */
export function numberLabel(value: number, locale = 'nb-NO'): string {
  return new Intl.NumberFormat(locale).format(value);
}
