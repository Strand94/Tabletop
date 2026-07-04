import { Router } from 'express';
import { bggCatalogSearchQuerySchema, bggImportSchema } from '@tabletop/shared';
import { requireAuth } from '../../middleware/auth.js';
import type { TokenService } from '../auth/service.js';
import { searchCatalog } from './catalog-service.js';
import { importGames } from './import-service.js';

export interface BggCatalogDeps {
  tokens: TokenService;
  defaultCurrency: string;
}

/** Catalog routes mounted at /api/bgg. All require an authenticated member. */
export function createBggCatalogRouter(deps: BggCatalogDeps): Router {
  const router = Router();
  router.use(requireAuth(deps.tokens));

  router.get('/catalog/search', (req, res, next) => {
    void (async () => {
      const { q, limit } = bggCatalogSearchQuerySchema.parse(req.query);
      res.json(await searchCatalog(q, limit));
    })().catch(next);
  });

  router.post('/catalog/import', (req, res, next) => {
    void (async () => {
      const input = bggImportSchema.parse(req.body);
      res.status(201).json(await importGames(input, deps.defaultCurrency));
    })().catch(next);
  });

  return router;
}
