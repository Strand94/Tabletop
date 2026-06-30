import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import type { TokenService } from '../auth/service.js';
import { dashboardStats } from './service.js';

export interface StatsDeps {
  tokens: TokenService;
  defaultCurrency: string;
}

/** Stats routes (auth required). Dashboard counters now; deeper stats later. */
export function createStatsRouter(deps: StatsDeps): Router {
  const router = Router();
  router.use(requireAuth(deps.tokens));

  router.get('/dashboard', (_req, res, next) => {
    void (async () => {
      res.json(await dashboardStats(deps.defaultCurrency));
    })().catch(next);
  });

  return router;
}
