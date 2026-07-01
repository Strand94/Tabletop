import { Router } from 'express';
import { createPersonSchema, updatePersonSchema } from '@tabletop/shared';
import { HttpError } from '../../middleware/error.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import type { TokenService } from '../auth/service.js';
import { createPerson, deletePerson, listPeople, updatePerson } from './service.js';

function parseId(raw: unknown): number {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, 'Invalid id');
  return id;
}

/**
 * People routes (auth required). Members may create/edit players; only admins
 * may delete (consistent with games/expansions, spec §6).
 */
export function createPeopleRouter(tokens: TokenService): Router {
  const router = Router();
  router.use(requireAuth(tokens));

  router.get('/', (_req, res, next) => {
    void (async () => {
      res.json(await listPeople());
    })().catch(next);
  });

  router.post('/', (req, res, next) => {
    void (async () => {
      const input = createPersonSchema.parse(req.body);
      res.status(201).json(await createPerson(input));
    })().catch(next);
  });

  router.patch('/:id', (req, res, next) => {
    void (async () => {
      const input = updatePersonSchema.parse(req.body);
      res.json(await updatePerson(parseId(req.params.id), input));
    })().catch(next);
  });

  router.delete('/:id', requireRole('ADMIN'), (req, res, next) => {
    void (async () => {
      await deletePerson(parseId(req.params.id));
      res.status(204).end();
    })().catch(next);
  });

  return router;
}
