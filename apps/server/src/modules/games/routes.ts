import path from 'node:path';
import { Router } from 'express';
import { createGameSchema, gameQuerySchema, updateGameSchema } from '@tabletop/shared';
import { prisma } from '../../db.js';
import { HttpError } from '../../middleware/error.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import type { TokenService } from '../auth/service.js';
import { uploadImage, imageUrl } from '../uploads/image.js';
import { createGame, deleteGame, getGame, listGames, updateGame } from './service.js';

export interface GamesDeps {
  tokens: TokenService;
  defaultCurrency: string;
}

function parseId(raw: unknown): number {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, 'Invalid id');
  return id;
}

/**
 * Games routes. All require authentication. Members may create/edit games;
 * only admins may delete (spec §6).
 */
export function createGamesRouter(deps: GamesDeps): Router {
  const router = Router();
  router.use(requireAuth(deps.tokens));

  router.get('/', (req, res, next) => {
    void (async () => {
      const query = gameQuerySchema.parse(req.query);
      res.json(await listGames(query));
    })().catch(next);
  });

  router.post('/', (req, res, next) => {
    void (async () => {
      const input = createGameSchema.parse(req.body);
      res.status(201).json(await createGame(input, deps.defaultCurrency));
    })().catch(next);
  });

  router.get('/:id', (req, res, next) => {
    void (async () => {
      res.json(await getGame(parseId(req.params.id)));
    })().catch(next);
  });

  router.patch('/:id', (req, res, next) => {
    void (async () => {
      const input = updateGameSchema.parse(req.body);
      res.json(await updateGame(parseId(req.params.id), input));
    })().catch(next);
  });

  router.delete('/:id', requireRole('ADMIN'), (req, res, next) => {
    void (async () => {
      await deleteGame(parseId(req.params.id));
      res.status(204).end();
    })().catch(next);
  });

  router.post('/:id/image', uploadImage.single('image'), (req, res, next) => {
    void (async () => {
      const id = parseId(req.params.id);
      if (!req.file) throw new HttpError(400, 'No image file provided');
      const url = imageUrl(path.basename(req.file.path));
      const game = await updateGame(id, { imagePath: url });
      res.json(game);
    })().catch(next);
  });

  return router;
}

/** Categories router: list all, create (admin only). */
export function createCategoriesRouter(tokens: TokenService): Router {
  const router = Router();
  router.use(requireAuth(tokens));

  router.get('/', (_req, res, next) => {
    void (async () => {
      const categories = await prisma.category.findMany({ orderBy: { name: 'asc' } });
      res.json(categories);
    })().catch(next);
  });

  router.post('/', requireRole('ADMIN'), (req, res, next) => {
    void (async () => {
      const name = String((req.body as { name?: unknown }).name ?? '').trim();
      if (!name) throw new HttpError(400, 'Category name is required');
      const category = await prisma.category.upsert({
        where: { name },
        update: {},
        create: { name },
      });
      res.status(201).json(category);
    })().catch(next);
  });

  return router;
}
