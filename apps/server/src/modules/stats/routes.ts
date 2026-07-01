import { Router } from 'express';
import { HttpError } from '../../middleware/error.js';
import { requireAuth } from '../../middleware/auth.js';
import type { TokenService } from '../auth/service.js';
import { dashboardStats, gameStats, playerStats } from './service.js';

export interface StatsDeps {
  tokens: TokenService;
  defaultCurrency: string;
}

function parseId(raw: unknown): number {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, 'Invalid id');
  return id;
}

/** Stats routes (auth required): dashboard, per-player, per-game. */
export function createStatsRouter(deps: StatsDeps): Router {
  const router = Router();
  router.use(requireAuth(deps.tokens));

  router.get('/dashboard', (_req, res, next) => {
    void (async () => {
      res.json(await dashboardStats(deps.defaultCurrency));
    })().catch(next);
  });

  router.get('/players', (_req, res, next) => {
    void (async () => {
      res.json(await playerStats());
    })().catch(next);
  });

  router.get('/games/:id', (req, res, next) => {
    void (async () => {
      res.json(await gameStats(parseId(req.params.id)));
    })().catch(next);
  });

  return router;
}
