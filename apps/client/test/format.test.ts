import { describe, expect, it } from 'vitest';
import { playersLabel, playtimeLabel, numberLabel } from '../src/lib/format.js';

describe('playersLabel', () => {
  it('renders a range', () => {
    expect(playersLabel({ minPlayers: 1, maxPlayers: 4 })).toBe('1–4');
  });
  it('collapses equal min/max to a single number', () => {
    expect(playersLabel({ minPlayers: 2, maxPlayers: 2 })).toBe('2');
  });
  it('handles a single bound', () => {
    expect(playersLabel({ minPlayers: null, maxPlayers: 5 })).toBe('5');
  });
  it('returns empty when unknown', () => {
    expect(playersLabel({ minPlayers: null, maxPlayers: null })).toBe('');
  });
});

describe('playtimeLabel', () => {
  it('renders a range with minutes suffix', () => {
    expect(playtimeLabel({ minPlaytime: 60, maxPlaytime: 90 })).toBe('60–90m');
  });
  it('collapses equal bounds', () => {
    expect(playtimeLabel({ minPlaytime: 45, maxPlaytime: 45 })).toBe('45m');
  });
});

describe('numberLabel', () => {
  it('groups thousands with a non-breaking space (nb-NO)', () => {
    // nb-NO uses a narrow no-break space as the grouping separator.
    expect(numberLabel(41280).replace(/\s/g, ' ')).toBe('41 280');
  });
});
