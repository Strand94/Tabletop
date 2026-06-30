import { PrismaClient } from '@prisma/client';

/**
 * Single Prisma client for the process. Reused across modules so we don't open
 * a new connection pool per import. In dev with HMR (tsx watch) we stash it on
 * globalThis to avoid exhausting connections on reload.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
