import { Router, type Request } from 'express';
import {
  loginSchema,
  refreshSchema,
  registerSchema,
  updateMeSchema,
  type UserPublic,
} from '@tabletop/shared';
import type { User } from '../../../generated/prisma/client.js';
import { prisma } from '../../db.js';
import { HttpError } from '../../middleware/error.js';
import { requireAuth } from '../../middleware/auth.js';
import { createTokenService, hashPassword, verifyPassword, type TokenService } from './service.js';

export interface AuthDeps {
  tokens: TokenService;
  defaultLocale: string;
}

function toPublic(user: User): UserPublic {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
    locale: user.locale,
  };
}

/** JWT payload for a user, snapshotting the current tokenVersion. */
function payloadFor(user: User) {
  return {
    sub: user.id,
    username: user.username,
    role: user.role,
    tokenVersion: user.tokenVersion,
  };
}

/**
 * Resolve the acting admin for an admin-gated request, or throw 401/403.
 * Used by register after first-run: only an authenticated ADMIN may create users.
 */
function assertAdmin(req: Request, tokens: TokenService): void {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice(7).trim() : null;
  if (!token) throw new HttpError(401, 'Admin authentication required');
  let role: string;
  try {
    role = tokens.verifyAccess(token).role;
  } catch {
    throw new HttpError(401, 'Invalid or expired token');
  }
  if (role !== 'ADMIN') throw new HttpError(403, 'Only admins can create users');
}

/**
 * Auth routes. First-run bootstrap: when no users exist, the first registration
 * creates the initial ADMIN with no auth. Afterwards registration is admin-gated
 * (spec §6).
 */
export function createAuthRouter(deps: AuthDeps): Router {
  const router = Router();
  const { tokens, defaultLocale } = deps;

  router.get('/setup-status', (_req, res, next) => {
    void (async () => {
      const userCount = await prisma.user.count();
      res.json({ needsSetup: userCount === 0 });
    })().catch(next);
  });

  router.post('/register', (req, res, next) => {
    void (async () => {
      const input = registerSchema.parse(req.body);
      const userCount = await prisma.user.count();
      const isFirstRun = userCount === 0;
      if (!isFirstRun) assertAdmin(req, tokens);

      const existing = await prisma.user.findUnique({ where: { username: input.username } });
      if (existing) throw new HttpError(409, 'Username already taken');

      const user = await prisma.user.create({
        data: {
          username: input.username,
          email: input.email ?? null,
          passwordHash: await hashPassword(input.password),
          role: isFirstRun ? 'ADMIN' : 'MEMBER',
          locale: input.locale ?? defaultLocale,
        },
      });
      res.status(201).json(toPublic(user));
    })().catch(next);
  });

  router.post('/login', (req, res, next) => {
    void (async () => {
      const input = loginSchema.parse(req.body);
      const user = await prisma.user.findUnique({ where: { username: input.username } });
      if (!user || !(await verifyPassword(user.passwordHash, input.password))) {
        throw new HttpError(401, 'Invalid username or password');
      }
      const payload = payloadFor(user);
      res.json({
        accessToken: tokens.signAccess(payload),
        refreshToken: tokens.signRefresh(payload),
        user: toPublic(user),
      });
    })().catch(next);
  });

  router.post('/refresh', (req, res, next) => {
    void (async () => {
      const { refreshToken } = refreshSchema.parse(req.body);
      let claims;
      try {
        claims = tokens.verifyRefresh(refreshToken);
      } catch {
        throw new HttpError(401, 'Invalid or expired refresh token');
      }
      const user = await prisma.user.findUnique({ where: { id: claims.sub } });
      if (!user) throw new HttpError(401, 'User no longer exists');
      // Reject refresh tokens issued before the last logout / credential change.
      if (claims.tokenVersion !== user.tokenVersion) {
        throw new HttpError(401, 'Refresh token has been revoked');
      }
      const payload = payloadFor(user);
      res.json({
        accessToken: tokens.signAccess(payload),
        refreshToken: tokens.signRefresh(payload),
        user: toPublic(user),
      });
    })().catch(next);
  });

  router.post('/logout', requireAuth(tokens), (req, res, next) => {
    void (async () => {
      // Bump tokenVersion to invalidate every outstanding refresh token for this
      // user. Access tokens (short-lived) expire on their own.
      await prisma.user.update({
        where: { id: req.user!.sub },
        data: { tokenVersion: { increment: 1 } },
      });
      res.status(204).end();
    })().catch(next);
  });

  router.get('/me', requireAuth(tokens), (req, res, next) => {
    void (async () => {
      const user = await prisma.user.findUnique({ where: { id: req.user!.sub } });
      if (!user) throw new HttpError(404, 'User not found');
      res.json(toPublic(user));
    })().catch(next);
  });

  router.patch('/me', requireAuth(tokens), (req, res, next) => {
    void (async () => {
      const input = updateMeSchema.parse(req.body);
      const user = await prisma.user.update({
        where: { id: req.user!.sub },
        data: { locale: input.locale },
      });
      res.json(toPublic(user));
    })().catch(next);
  });

  return router;
}

/** Build a token service from validated config secrets/TTLs. */
export function tokenServiceFromConfig(opts: {
  JWT_SECRET: string;
  JWT_REFRESH_SECRET: string;
}): TokenService {
  return createTokenService({
    accessSecret: opts.JWT_SECRET,
    refreshSecret: opts.JWT_REFRESH_SECRET,
    accessTtl: '15m',
    refreshTtl: '7d',
  });
}
