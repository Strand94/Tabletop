import type { NextFunction, Request, Response } from 'express';
import type { Role, TokenPayload } from '@tabletop/shared';
import type { TokenService } from '../modules/auth/service.js';
import { HttpError } from './error.js';

/** Authenticated user attached to the request by `requireAuth`. */
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: TokenPayload;
    }
  }
}

function extractBearer(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return null;
  return header.slice('Bearer '.length).trim() || null;
}

/**
 * Require a valid access token. Attaches the decoded payload to `req.user` or
 * responds 401. Built from a TokenService so secrets come from config.
 */
export function requireAuth(tokens: TokenService) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const token = extractBearer(req);
    if (!token) {
      next(new HttpError(401, 'Missing or malformed Authorization header'));
      return;
    }
    try {
      req.user = tokens.verifyAccess(token);
      next();
    } catch {
      next(new HttpError(401, 'Invalid or expired token'));
    }
  };
}

/**
 * Require the authenticated user to hold one of the given roles. Must run after
 * `requireAuth`. Responds 403 on mismatch, 401 if unauthenticated.
 */
export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new HttpError(401, 'Not authenticated'));
      return;
    }
    if (!roles.includes(req.user.role)) {
      next(new HttpError(403, 'Insufficient permissions'));
      return;
    }
    next();
  };
}
