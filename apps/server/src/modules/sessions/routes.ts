import path from 'node:path';
import { Router } from 'express';
import {
  createLocationSchema,
  createSessionSchema,
  sessionQuerySchema,
  updateSessionSchema,
  upsertSessionRatingSchema,
} from '@tabletop/shared';
import { prisma } from '../../db.js';
import { HttpError } from '../../middleware/error.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import type { TokenService } from '../auth/service.js';
import { uploadImage, imageUrl } from '../uploads/image.js';
import { upsertSessionRating } from '../ratings/service.js';
import {
  addSessionImage,
  createSession,
  deleteSession,
  getSession,
  listSessions,
  updateSession,
} from './service.js';

function parseId(raw: unknown): number {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, 'Invalid id');
  return id;
}

/**
 * Sessions routes (auth required). Members log and manage plays — the core
 * member activity — so create/edit/delete are all member-allowed (spec §6).
 */
export function createSessionsRouter(tokens: TokenService): Router {
  const router = Router();
  router.use(requireAuth(tokens));

  router.get('/', (req, res, next) => {
    void (async () => {
      const query = sessionQuerySchema.parse(req.query);
      res.json(await listSessions(query, req.user!.sub));
    })().catch(next);
  });

  router.post('/', (req, res, next) => {
    void (async () => {
      const input = createSessionSchema.parse(req.body);
      res.status(201).json(await createSession(input));
    })().catch(next);
  });

  router.get('/:id', (req, res, next) => {
    void (async () => {
      res.json(await getSession(parseId(req.params.id), req.user!.sub));
    })().catch(next);
  });

  router.put('/:id/rating', (req, res, next) => {
    void (async () => {
      const input = upsertSessionRatingSchema.parse(req.body);
      res.json(await upsertSessionRating(req.user!.sub, parseId(req.params.id), input));
    })().catch(next);
  });

  router.patch('/:id', (req, res, next) => {
    void (async () => {
      const input = updateSessionSchema.parse(req.body);
      res.json(await updateSession(parseId(req.params.id), input));
    })().catch(next);
  });

  router.delete('/:id', (req, res, next) => {
    void (async () => {
      await deleteSession(parseId(req.params.id));
      res.status(204).end();
    })().catch(next);
  });

  router.post('/:id/image', uploadImage.single('image'), (req, res, next) => {
    void (async () => {
      const id = parseId(req.params.id);
      if (!req.file) throw new HttpError(400, 'No image file provided');
      res.json(await addSessionImage(id, imageUrl(path.basename(req.file.path)), req.user!.sub));
    })().catch(next);
  });

  return router;
}

/** Locations router: list all + create. */
export function createLocationsRouter(tokens: TokenService): Router {
  const router = Router();
  router.use(requireAuth(tokens));

  router.get('/', (_req, res, next) => {
    void (async () => {
      res.json(await prisma.location.findMany({ orderBy: { name: 'asc' } }));
    })().catch(next);
  });

  router.post('/', (req, res, next) => {
    void (async () => {
      const input = createLocationSchema.parse(req.body);
      const location = await prisma.location.create({
        data: { name: input.name, address: input.address ?? null },
      });
      res.status(201).json(location);
    })().catch(next);
  });

  router.delete('/:id', requireRole('ADMIN'), (req, res, next) => {
    void (async () => {
      const id = parseId(req.params.id);
      const exists = await prisma.location.findUnique({ where: { id }, select: { id: true } });
      if (!exists) throw new HttpError(404, 'Location not found');
      // Session.location is SetNull (schema); sessions survive with locationId nulled.
      await prisma.location.delete({ where: { id } });
      res.status(204).end();
    })().catch(next);
  });

  return router;
}
