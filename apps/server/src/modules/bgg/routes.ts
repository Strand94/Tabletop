import { Router } from 'express';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import type { TokenService } from '../auth/service.js';
import { prisma } from '../../db.js';
import { selectProvider } from './provider.js';

export interface BggDeps {
  tokens: TokenService;
  enabled: boolean;
  provider: string;
  apiToken: string | undefined;
}

/**
 * BGG sync route (spec §9.3): admin-only trigger. Returns 200 with a disabled
 * status when BGG_SYNC_ENABLED is false (the default). When enabled it runs the
 * selected provider and writes only the read-only bgg_* fields.
 */
export function createBggRouter(deps: BggDeps): Router {
  const router = Router();
  router.use(requireAuth(deps.tokens), requireRole('ADMIN'));

  router.post('/bgg', (_req, res, next) => {
    void (async () => {
      if (!deps.enabled) {
        res.json({ status: 'disabled', synced: 0 });
        return;
      }
      const games = await prisma.game.findMany({
        where: { bggId: { not: null } },
        select: { id: true, bggId: true },
      });
      const provider = selectProvider(deps.provider, deps.apiToken);
      const ratings = await provider.fetchRatings(
        games.map((g) => g.bggId).filter((id): id is number => id !== null),
      );
      const byBggId = new Map(ratings.map((r) => [r.bggId, r]));
      let synced = 0;
      for (const game of games) {
        const rating = game.bggId !== null ? byBggId.get(game.bggId) : undefined;
        if (!rating) continue;
        await prisma.game.update({
          where: { id: game.id },
          data: {
            bggRating: rating.rating,
            bggRank: rating.rank,
            bggSyncedAt: new Date(),
          },
        });
        synced += 1;
      }
      res.json({ status: 'ok', synced });
    })().catch(next);
  });

  return router;
}
