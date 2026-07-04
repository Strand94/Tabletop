const DATED_CSV = /^(\d{4}-\d{2}-\d{2})(?:T[\d-]+)?\.csv$/;

/** `YYYY-MM-DD` from a dump filename, or null if it is not a dated csv. */
export function snapshotDateFromName(name: string): string | null {
  const m = DATED_CSV.exec(name);
  return m ? m[1]! : null;
}

/** Newest dated csv by filename (lexical == chronological for ISO dates). */
export function pickLatest(names: string[]): { name: string; snapshotDate: string } | null {
  let best: { name: string; snapshotDate: string } | null = null;
  for (const name of names) {
    const snapshotDate = snapshotDateFromName(name);
    if (snapshotDate === null) continue;
    if (best === null || name > best.name) best = { name, snapshotDate };
  }
  return best;
}
