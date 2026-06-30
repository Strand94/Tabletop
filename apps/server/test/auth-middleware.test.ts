import { describe, expect, it } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createTokenService } from '../src/modules/auth/service.js';
import { requireAuth, requireRole } from '../src/middleware/auth.js';
import { errorHandler } from '../src/middleware/error.js';
import type { TokenPayload } from '@tabletop/shared';

const tokens = createTokenService({
  accessSecret: 'access-secret-access-secret-1234567890',
  refreshSecret: 'refresh-secret-refresh-secret-1234567890',
  accessTtl: '15m',
  refreshTtl: '7d',
});

function makeApp() {
  const app = express();
  app.get('/me', requireAuth(tokens), (req, res) => res.json({ user: req.user }));
  app.get('/admin', requireAuth(tokens), requireRole('ADMIN'), (_req, res) =>
    res.json({ ok: true }),
  );
  app.use(errorHandler);
  return app;
}

const adminPayload: TokenPayload = { sub: 1, username: 'maya', role: 'ADMIN' };
const memberPayload: TokenPayload = { sub: 2, username: 'theo', role: 'MEMBER' };

describe('requireAuth', () => {
  it('rejects requests without a token (401)', async () => {
    const res = await request(makeApp()).get('/me');
    expect(res.status).toBe(401);
  });

  it('rejects an invalid token (401)', async () => {
    const res = await request(makeApp()).get('/me').set('Authorization', 'Bearer nope');
    expect(res.status).toBe(401);
  });

  it('accepts a valid token and exposes req.user', async () => {
    const res = await request(makeApp())
      .get('/me')
      .set('Authorization', `Bearer ${tokens.signAccess(memberPayload)}`);
    expect(res.status).toBe(200);
    expect(res.body.user.username).toBe('theo');
  });
});

describe('requireRole', () => {
  it('allows the matching role', async () => {
    const res = await request(makeApp())
      .get('/admin')
      .set('Authorization', `Bearer ${tokens.signAccess(adminPayload)}`);
    expect(res.status).toBe(200);
  });

  it('forbids a non-matching role (403)', async () => {
    const res = await request(makeApp())
      .get('/admin')
      .set('Authorization', `Bearer ${tokens.signAccess(memberPayload)}`);
    expect(res.status).toBe(403);
  });
});
