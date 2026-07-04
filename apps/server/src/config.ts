import { z } from 'zod';
import { DEFAULT_BGG_CATALOG_REPO } from '@tabletop/shared';

/**
 * Typed, fail-fast application configuration. All environment access goes
 * through here. `loadConfig` throws if a required variable is missing or
 * invalid, so the process refuses to start misconfigured (spec §6, §8.3).
 */
const booleanFromString = z
  .union([z.boolean(), z.string()])
  .transform((v) => (typeof v === 'boolean' ? v : v.toLowerCase() === 'true'));

const envSchema = z.object({
  NODE_ENV: z.string().default('development'),

  DB_HOST: z.string().default('db'),
  DB_PORT: z.coerce.number().int().positive().default(5432),
  DB_USER: z.string().min(1, 'DB_USER is required'),
  DB_PASSWORD: z.string().min(1, 'DB_PASSWORD is required'),
  DB_NAME: z.string().default('tabletop'),
  DATABASE_URL: z.string().url().optional(),

  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),

  PORT: z.coerce.number().int().positive().default(5470),
  TZ: z.string().default('UTC'),
  DEFAULT_CURRENCY: z.string().default('NOK'),
  DEFAULT_LOCALE: z.string().default('en'),

  BGG_SYNC_ENABLED: booleanFromString.default(false),
  BGG_SYNC_PROVIDER: z.enum(['csv', 'xmlapi']).default('csv'),
  BGG_API_TOKEN: z.string().optional(),
  BGG_CATALOG_REPO: z.string().default(DEFAULT_BGG_CATALOG_REPO),
  BGG_CATALOG_REFRESH_ENABLED: booleanFromString.default(false),
});

export type Config = z.infer<typeof envSchema> & { DATABASE_URL: string };

/**
 * Resolve the Postgres connection string without running full config
 * validation. Prefers an explicit `DATABASE_URL`, otherwise derives it from the
 * `DB_*` vars. Used by the Prisma driver adapter (`db.ts`), which is
 * instantiated at import time and must stay lazy — no throwing here.
 */
export function resolveDatabaseUrl(env: Record<string, string | undefined> = process.env): string {
  return (
    env.DATABASE_URL ??
    `postgresql://${env.DB_USER}:${env.DB_PASSWORD}@${env.DB_HOST ?? 'db'}:${
      env.DB_PORT ?? 5432
    }/${env.DB_NAME ?? 'tabletop'}`
  );
}

/**
 * Parse and validate configuration from an env-like record (defaults to
 * `process.env`). Throws a descriptive error listing every problem.
 */
export function loadConfig(env: Record<string, string | undefined> = process.env): Config {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }

  const c = parsed.data;
  return { ...c, DATABASE_URL: resolveDatabaseUrl(env) };
}
