import path from 'node:path';
import { Router } from 'express';
import { createExpansionSchema, updateExpansionSchema } from '@tabletop/shared';
import { HttpError } from '../../middleware/error.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import type { TokenService } from '../auth/service.js';
import { uploadImage, imageUrl } from '../uploads/image.js';
import { createExpansion, deleteExpansion, listExpansions, updateExpansion } from './service.js';

function parseId(raw: unknown): number {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, 'Invalid id');
  return id;
}

/**
 * Expansion routes (auth required). Expansions are always accessed relative to
 * their base game for list/create, and by their own id for edit/delete. Members
 * may create/edit; only admins may delete (consistent with games, spec §6).
 * Mounted at the /api root so it owns both `/games/:id/expansions` and
 * `/expansions/:id` path shapes.
 */
export function createExpansionsRouter(tokens: TokenService): Router {
  const router = Router();
  router.use(requireAuth(tokens));

  router.get('/games/:gameId/expansions', (req, res, next) => {
    void (async () => {
      res.json(await listExpansions(parseId(req.params.gameId)));
    })().catch(next);
  });

  router.post('/games/:gameId/expansions', (req, res, next) => {
    void (async () => {
      const input = createExpansionSchema.parse(req.body);
      res.status(201).json(await createExpansion(parseId(req.params.gameId), input));
    })().catch(next);
  });

  router.patch('/expansions/:id', (req, res, next) => {
    void (async () => {
      const input = updateExpansionSchema.parse(req.body);
      res.json(await updateExpansion(parseId(req.params.id), input));
    })().catch(next);
  });

  router.delete('/expansions/:id', requireRole('ADMIN'), (req, res, next) => {
    void (async () => {
      await deleteExpansion(parseId(req.params.id));
      res.status(204).end();
    })().catch(next);
  });

  router.post('/expansions/:id/image', uploadImage.single('image'), (req, res, next) => {
    void (async () => {
      const id = parseId(req.params.id);
      if (!req.file) throw new HttpError(400, 'No image file provided');
      const url = imageUrl(path.basename(req.file.path));
      res.json(await updateExpansion(id, { imagePath: url }));
    })().catch(next);
  });

  return router;
}
