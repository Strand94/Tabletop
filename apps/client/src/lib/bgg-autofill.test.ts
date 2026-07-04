import { describe, expect, it } from 'vitest';
import { hitToFormPatch } from './bgg-autofill.js';

describe('hitToFormPatch', () => {
  it('maps a catalog hit to the form fields it can fill, without the low-quality cover', () => {
    expect(
      hitToFormPatch({
        bggId: 1,
        name: 'Ark Nova',
        year: 2021,
        rank: 2,
        average: 8.54,
        bayesAverage: 8.35,
        usersRated: 100,
        thumbnail: 'https://x/t.jpg',
        snapshotDate: '2026-06-29',
      }),
    ).toEqual({ title: 'Ark Nova', releaseYear: '2021', bggId: 1, imagePath: null });
  });

  it('tolerates null year and thumbnail', () => {
    const patch = hitToFormPatch({
      bggId: 5,
      name: 'X',
      year: null,
      rank: null,
      average: null,
      bayesAverage: null,
      usersRated: null,
      thumbnail: null,
      snapshotDate: null,
    });
    expect(patch).toEqual({ title: 'X', releaseYear: '', bggId: 5, imagePath: null });
  });
});
