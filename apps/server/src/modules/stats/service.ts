import type { DashboardStats } from '@tabletop/shared';
import { prisma } from '../../db.js';

/** Compute the headline dashboard counters in the given instance currency. */
export async function dashboardStats(currency: string): Promise<DashboardStats> {
  const [gamesOwned, wishlist, sessions, players, expansions, ownedAgg] = await Promise.all([
    prisma.game.count({ where: { collectionStatus: 'OWNED' } }),
    prisma.game.count({ where: { collectionStatus: 'WISHLIST' } }),
    prisma.session.count(),
    prisma.person.count(),
    prisma.expansion.count(),
    prisma.game.aggregate({
      where: { collectionStatus: 'OWNED', price: { not: null } },
      _sum: { price: true },
      _avg: { price: true },
      _count: { price: true },
    }),
  ]);

  return {
    gamesOwned,
    wishlist,
    sessions,
    players,
    expansions,
    collectionValue: ownedAgg._sum.price?.toNumber() ?? 0,
    avgPrice: ownedAgg._avg.price?.toNumber() ?? 0,
    currency,
  };
}
