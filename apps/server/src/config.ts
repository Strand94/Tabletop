import { z } from 'zod';

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
  DB_NAME: z.string().default('boardgametracker'),
  DATABASE_URL: z.string().url().optional(),

  JWT_SECRET: z.string().min(1, 'JWT_SECRET is required'),
  JWT_REFRESH_SECRET: z.string().min(1, 'JWT_REFRESH_SECRET is required'),

  PORT: z.coerce.number().int().positive().default(5444),
  TZ: z.string().default('UTC'),
  DEFAULT_CURRENCY: z.string().default('NOK'),
  DEFAULT_LOCALE: z.string().default('en'),

  BGG_SYNC_ENABLED: booleanFromString.default(false),
  BGG_SYNC_PROVIDER: z.enum(['csv', 'xmlapi']).default('csv'),
  BGG_API_TOKEN: z.string().optional(),
});

export type Config = z.infer<typeof envSchema> & { DATABASE_URL: string };

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
  const databaseUrl =
    c.DATABASE_URL ??
    `postgresql://${c.DB_USER}:${c.DB_PASSWORD}@${c.DB_HOST}:${c.DB_PORT}/${c.DB_NAME}`;

  return { ...c, DATABASE_URL: databaseUrl };
}
