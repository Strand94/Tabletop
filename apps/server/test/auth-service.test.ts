import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword, createTokenService } from '../src/modules/auth/service.js';
import type { TokenPayload } from '@tabletop/shared';

const tokens = createTokenService({
  accessSecret: 'access-secret-access-secret-1234567890',
  refreshSecret: 'refresh-secret-refresh-secret-1234567890',
  accessTtl: '15m',
  refreshTtl: '7d',
});

const payload: TokenPayload = { sub: 1, username: 'maya', role: 'ADMIN', tokenVersion: 0 };

describe('password hashing', () => {
  it('verifies a correct password against its hash', async () => {
    const hash = await hashPassword('correct horse battery');
    expect(hash).not.toBe('correct horse battery');
    expect(await verifyPassword(hash, 'correct horse battery')).toBe(true);
  });

  it('rejects an incorrect password', async () => {
    const hash = await hashPassword('correct horse battery');
    expect(await verifyPassword(hash, 'wrong password')).toBe(false);
  });
});

describe('token service', () => {
  it('round-trips an access token', () => {
    const token = tokens.signAccess(payload);
    const decoded = tokens.verifyAccess(token);
    expect(decoded.sub).toBe(1);
    expect(decoded.username).toBe('maya');
    expect(decoded.role).toBe('ADMIN');
  });

  it('round-trips a refresh token', () => {
    const token = tokens.signRefresh(payload);
    const decoded = tokens.verifyRefresh(token);
    expect(decoded.sub).toBe(1);
  });

  it('does not accept an access token as a refresh token', () => {
    const access = tokens.signAccess(payload);
    expect(() => tokens.verifyRefresh(access)).toThrow();
  });

  it('rejects a tampered/invalid token', () => {
    expect(() => tokens.verifyAccess('not.a.jwt')).toThrow();
  });
});
