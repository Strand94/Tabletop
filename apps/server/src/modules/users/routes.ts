import { Router } from 'express';
import { adminCreateUserSchema, updateUserSchema } from '@tabletop/shared';
import { HttpError } from '../../middleware/error.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import type { TokenService } from '../auth/service.js';
import { createUser, deleteUser, listUsers, updateUser } from './service.js';

export interface UsersDeps {
  tokens: TokenService;
  defaultLocale: string;
}

function parseId(raw: unknown): number {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, 'Invalid id');
  return id;
}

/**
 * Admin user-management routes. Every route requires an authenticated ADMIN
 * (spec §6). Mirrors the people router shape.
 */
export function createUsersRouter(deps: UsersDeps): Router {
  const router = Router();
  const { tokens, defaultLocale } = deps;
  router.use(requireAuth(tokens), requireRole('ADMIN'));

  router.get('/', (_req, res, next) => {
    void (async () => {
      res.json(await listUsers());
    })().catch(next);
  });

  router.post('/', (req, res, next) => {
    void (async () => {
      const input = adminCreateUserSchema.parse(req.body);
      res.status(201).json(await createUser(input, defaultLocale));
    })().catch(next);
  });

  router.patch('/:id', (req, res, next) => {
    void (async () => {
      const input = updateUserSchema.parse(req.body);
      res.json(await updateUser(parseId(req.params.id), input, req.user!.sub));
    })().catch(next);
  });

  router.delete('/:id', (req, res, next) => {
    void (async () => {
      await deleteUser(parseId(req.params.id), req.user!.sub);
      res.status(204).end();
    })().catch(next);
  });

  return router;
}
