import { Router } from 'express';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import type { TokenService } from '../auth/service.js';
import { exportGamesCsv, exportJson } from './service.js';

/** Export routes (admin-only): full JSON backup or a flat games CSV. */
export function createExportRouter(tokens: TokenService): Router {
  const router = Router();
  router.use(requireAuth(tokens), requireRole('ADMIN'));

  router.get('/json', (_req, res, next) => {
    void (async () => {
      res.setHeader('Content-Disposition', 'attachment; filename="tabletop-export.json"');
      res.json(await exportJson());
    })().catch(next);
  });

  router.get('/csv', (_req, res, next) => {
    void (async () => {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="tabletop-games.csv"');
      res.send(await exportGamesCsv());
    })().catch(next);
  });

  return router;
}
