import { execSync } from 'node:child_process';
import { prisma } from '../../src/db.js';

/**
 * Apply migrations once before the integration suite. Requires DATABASE_URL to
 * point at a disposable Postgres (CI service container / local docker). Run from
 * the repo root so Prisma finds the schema.
 */
export function applyMigrations(): void {
  execSync('npx prisma migrate deploy', {
    stdio: 'inherit',
    cwd: process.cwd(),
  });
}

/** Truncate all data tables between tests; resets identity sequences. */
export async function resetDb(): Promise<void> {
  const tables = [
    'session_image',
    'user_session_rating',
    'user_game_rating',
    'player_session',
    'expansion_session',
    'session',
    'expansion',
    'game_category',
    'game',
    'category',
    'location',
    'person',
    '"user"',
  ];
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${tables.join(', ')} RESTART IDENTITY CASCADE;`);
}
