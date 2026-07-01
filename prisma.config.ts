import { config } from 'dotenv';
import { defineConfig } from 'prisma/config';

// Load .env explicitly with quiet:true — dotenv 17 prints a tips banner to
// stderr on load by default, which would add noise to every Prisma CLI command.
config({ quiet: true });

/**
 * Prisma CLI configuration (Prisma 7+). Replaces the `prisma` block that used
 * to live in package.json and the `url` that used to live in the schema's
 * datasource block. We load `.env` here because Prisma 7 no longer does it
 * automatically.
 *
 * The URL is only used by the CLI (migrate); the runtime PrismaClient connects
 * via a driver adapter (see apps/server/src/db.ts). We resolve it from the same
 * `DB_*` vars the server uses (mirrors `resolveDatabaseUrl` in
 * apps/server/src/config.ts) and deliberately DON'T use Prisma's `env()`
 * helper, which throws at config load if the var is unset — that would break
 * `prisma generate` where no database URL exists (CI lint job, Docker build).
 */
const databaseUrl =
  process.env.DATABASE_URL ??
  `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${
    process.env.DB_HOST ?? 'db'
  }:${process.env.DB_PORT ?? 5432}/${process.env.DB_NAME ?? 'tabletop'}`;

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: databaseUrl,
  },
  migrations: {
    seed: 'tsx prisma/seed.ts',
  },
});
