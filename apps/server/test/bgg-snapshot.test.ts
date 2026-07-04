import { describe, expect, it } from 'vitest';
import { pickLatest, snapshotDateFromName } from '../src/modules/bgg/snapshot.js';

describe('snapshot resolver', () => {
  it('extracts the date from a dump filename', () => {
    expect(snapshotDateFromName('2026-06-29T00-57-24.csv')).toBe('2026-06-29');
    expect(snapshotDateFromName('2016-10-12.csv')).toBe('2016-10-12');
    expect(snapshotDateFromName('README.md')).toBeNull();
  });

  it('picks the newest dated csv, ignoring non-matching files', () => {
    expect(
      pickLatest(['2016-10-12.csv', 'README.md', '2026-06-29T00-57-24.csv', '2026-06-28.csv']),
    ).toEqual({ name: '2026-06-29T00-57-24.csv', snapshotDate: '2026-06-29' });
  });

  it('returns null when there are no dated csvs', () => {
    expect(pickLatest(['README.md', 'LICENSE'])).toBeNull();
  });
});
