import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';
import { resolveDatabaseUrl } from './config.js';

/**
 * Single Prisma client for the process. Reused across modules so we don't open
 * a new connection pool per import. In dev with HMR (tsx watch) we stash it on
 * globalThis to avoid exhausting connections on reload.
 *
 * Prisma 7 requires a driver adapter for the database connection; we use the
 * node-postgres adapter. The pool connects lazily (on first query), so simply
 * importing this module never opens a socket.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

const adapter = new PrismaPg({ connectionString: resolveDatabaseUrl() });

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
