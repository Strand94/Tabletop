import argon2 from 'argon2';
import jwt from 'jsonwebtoken';
import { tokenPayloadSchema, type TokenPayload } from '@tabletop/shared';

/** Hash a plaintext password with argon2id. */
export function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, { type: argon2.argon2id });
}

/** Verify a plaintext password against a stored argon2 hash. */
export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}

export interface TokenServiceOptions {
  accessSecret: string;
  refreshSecret: string;
  accessTtl: string;
  refreshTtl: string;
}

export interface TokenService {
  signAccess(payload: TokenPayload): string;
  signRefresh(payload: TokenPayload): string;
  verifyAccess(token: string): TokenPayload;
  verifyRefresh(token: string): TokenPayload;
}

/**
 * Validate the decoded JWT down to our payload shape. A token with a valid
 * signature but an unexpected/tampered claim set is rejected rather than
 * producing an ill-typed `req.user`.
 */
function toPayload(decoded: jwt.JwtPayload | string): TokenPayload {
  return tokenPayloadSchema.parse(decoded);
}

/**
 * Build a token service bound to the configured secrets. Access and refresh
 * tokens are signed with *different* secrets so an access token can never be
 * replayed as a refresh token (and vice versa).
 */
export function createTokenService(opts: TokenServiceOptions): TokenService {
  return {
    signAccess(payload) {
      return jwt.sign({ ...payload }, opts.accessSecret, {
        expiresIn: opts.accessTtl as jwt.SignOptions['expiresIn'],
      });
    },
    signRefresh(payload) {
      return jwt.sign({ ...payload }, opts.refreshSecret, {
        expiresIn: opts.refreshTtl as jwt.SignOptions['expiresIn'],
      });
    },
    verifyAccess(token) {
      return toPayload(jwt.verify(token, opts.accessSecret));
    },
    verifyRefresh(token) {
      return toPayload(jwt.verify(token, opts.refreshSecret));
    },
  };
}
