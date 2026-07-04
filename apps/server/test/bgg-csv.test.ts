import { describe, expect, it } from 'vitest';
import { parseCatalogCsv } from '../src/modules/bgg/csv.js';

const HEADER = 'ID,Name,Year,Rank,Average,Bayes average,Users rated,URL,Thumbnail';

describe('parseCatalogCsv', () => {
  it('maps columns to typed fields', () => {
    const rows = parseCatalogCsv(
      `${HEADER}\n224517,Brass: Birmingham,2018,1,8.56,8.393,59007,/boardgame/224517/brass,https://x/t.jpg`,
    );
    expect(rows).toEqual([
      {
        bggId: 224517,
        name: 'Brass: Birmingham',
        year: 2018,
        rank: 1,
        average: 8.56,
        bayesAverage: 8.393,
        usersRated: 59007,
        thumbnail: 'https://x/t.jpg',
      },
    ]);
  });

  it('honours quoting for names containing commas', () => {
    const rows = parseCatalogCsv(`${HEADER}\n1,"Tak, a Beautiful Game",2016,,,,,/bg/1,`);
    expect(rows[0]!.name).toBe('Tak, a Beautiful Game');
  });

  it('turns blank/zero numerics and empty thumbnail into null', () => {
    const rows = parseCatalogCsv(`${HEADER}\n42,Nulls,0,,,,,/bg/42,`);
    expect(rows[0]!).toMatchObject({ year: null, rank: null, average: null, thumbnail: null });
  });

  it('skips rows with a non-numeric id', () => {
    expect(parseCatalogCsv(`${HEADER}\n,Bad,,,,,,,`)).toEqual([]);
  });
});
