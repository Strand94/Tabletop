import { parse } from 'csv-parse/sync';

export interface CatalogRow {
  bggId: number;
  name: string;
  year: number | null;
  rank: number | null;
  average: number | null;
  bayesAverage: number | null;
  usersRated: number | null;
  thumbnail: string | null;
}

/** null unless the string parses to a finite number. */
function int(value: string | undefined, { zeroIsNull = false } = {}): number | null {
  const n = Number((value ?? '').trim());
  if (!Number.isFinite(n)) return null;
  if (zeroIsNull && n === 0) return null;
  return Math.trunc(n);
}

function dec(value: string | undefined): number | null {
  const n = Number((value ?? '').trim());
  return Number.isFinite(n) && n !== 0 ? n : null;
}

function str(value: string | undefined): string | null {
  const s = (value ?? '').trim();
  return s === '' ? null : s;
}

/**
 * Parse a BGG ranks CSV dump into typed rows. Columns:
 * ID, Name, Year, Rank, Average, Bayes average, Users rated, URL, Thumbnail.
 * Rows without a numeric ID are dropped.
 */
export function parseCatalogCsv(text: string): CatalogRow[] {
  const records = parse(text, {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
  }) as Record<string, string>[];

  const rows: CatalogRow[] = [];
  for (const r of records) {
    const bggId = int(r.ID);
    if (bggId === null || bggId === 0) continue;
    rows.push({
      bggId,
      name: (r.Name ?? '').trim(),
      year: int(r.Year, { zeroIsNull: true }),
      rank: int(r.Rank, { zeroIsNull: true }),
      average: dec(r.Average),
      bayesAverage: dec(r['Bayes average']),
      usersRated: int(r['Users rated']),
      thumbnail: str(r.Thumbnail),
    });
  }
  return rows;
}
