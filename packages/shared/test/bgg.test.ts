import { describe, expect, it } from 'vitest';
import { bggUrl, bggCatalogSearchQuerySchema, bggImportSchema } from '../src/bgg.js';

describe('bgg shared contract', () => {
  it('builds a BGG page url from an id', () => {
    expect(bggUrl(224517)).toBe('https://boardgamegeek.com/boardgame/224517');
  });

  it('defaults and caps the search limit', () => {
    expect(bggCatalogSearchQuerySchema.parse({ q: 'ark' }).limit).toBe(10);
    expect(bggCatalogSearchQuerySchema.parse({ q: 'ark', limit: '999' }).limit).toBe(25);
  });

  it('requires at least one id to import', () => {
    expect(() => bggImportSchema.parse({ bggIds: [] })).toThrow();
    expect(bggImportSchema.parse({ bggIds: [1, 2] }).bggIds).toEqual([1, 2]);
  });
});
