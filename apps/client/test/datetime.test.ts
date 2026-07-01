import { describe, expect, it } from 'vitest';
import { durationLabel, winnersLabel } from '../src/lib/datetime.js';

describe('durationLabel', () => {
  it('formats hours and zero-padded minutes', () => {
    expect(durationLabel(125)).toBe('2t 05m');
  });
  it('formats sub-hour durations', () => {
    expect(durationLabel(48)).toBe('48m');
  });
  it('returns empty for null', () => {
    expect(durationLabel(null)).toBe('');
  });
});

describe('winnersLabel', () => {
  it('lists a single winner', () => {
    expect(
      winnersLabel([
        { name: 'Maya', won: true },
        { name: 'Theo', won: false },
      ]),
    ).toBe('Maya');
  });
  it('joins multiple winners (co-op/tie)', () => {
    expect(
      winnersLabel([
        { name: 'Maya', won: true },
        { name: 'Theo', won: true },
      ]),
    ).toBe('Maya, Theo');
  });
  it('returns a dash when nobody won', () => {
    expect(winnersLabel([{ name: 'Maya', won: false }])).toBe('—');
  });
});
