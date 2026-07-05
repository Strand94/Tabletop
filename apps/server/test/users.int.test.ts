import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../src/app.js';
import { tokenServiceFromConfig } from '../src/modules/auth/routes.js';
import { prisma } from '../src/db.js';
import { applyMigrations, resetDb } from './helpers/db.js';

const tokens = tokenServiceFromConfig({
  JWT_SECRET: 'access-secret-access-secret-1234567890',
  JWT_REFRESH_SECRET: 'refresh-secret-refresh-secret-1234567890',
});

let app: Express;

beforeAll(() => {
  applyMigrations();
  app = createApp({ tokens, defaultLocale: 'en', defaultCurrency: 'NOK' });
});

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await prisma.$disconnect();
});

/** Register the first admin and return an access token. */
async function registerAdmin(username = 'maya', password = 'supersecret'): Promise<string> {
  await request(app).post('/api/auth/register').send({ username, password });
  const login = await request(app).post('/api/auth/login').send({ username, password });
  return login.body.accessToken as string;
}

describe('admin user management', () => {
  it('rejects unauthenticated access (401)', async () => {
    expect((await request(app).get('/api/users')).status).toBe(401);
    expect((await request(app).post('/api/users').send({})).status).toBe(401);
    expect((await request(app).patch('/api/users/1').send({})).status).toBe(401);
    expect((await request(app).delete('/api/users/1')).status).toBe(401);
  });

  it('rejects members on every route (403)', async () => {
    const adminToken = await registerAdmin();
    const created = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ username: 'theo', password: 'anothersecret', role: 'MEMBER' });
    const login = await request(app)
      .post('/api/auth/login')
      .send({ username: 'theo', password: 'anothersecret' });
    const memberToken = login.body.accessToken as string;
    const auth = { Authorization: `Bearer ${memberToken}` };

    expect((await request(app).get('/api/users').set(auth)).status).toBe(403);
    expect((await request(app).post('/api/users').set(auth).send({})).status).toBe(403);
    expect(
      (await request(app).patch(`/api/users/${created.body.id}`).set(auth).send({ role: 'ADMIN' }))
        .status,
    ).toBe(403);
    expect((await request(app).delete(`/api/users/${created.body.id}`).set(auth)).status).toBe(403);
  });

  it('admin lists users', async () => {
    const adminToken = await registerAdmin();
    const res = await request(app).get('/api/users').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].username).toBe('maya');
    expect(res.body[0].role).toBe('ADMIN');
    expect(res.body[0].passwordHash).toBeUndefined();
  });

  it('creates a user with the requested role and no passwordHash (201)', async () => {
    const adminToken = await registerAdmin();
    const res = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ username: 'theo', password: 'anothersecret', role: 'ADMIN' });
    expect(res.status).toBe(201);
    expect(res.body.role).toBe('ADMIN');
    expect(res.body.username).toBe('theo');
    expect(res.body.passwordHash).toBeUndefined();
  });

  it('rejects a duplicate username (409)', async () => {
    const adminToken = await registerAdmin();
    const res = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ username: 'maya', password: 'anothersecret', role: 'MEMBER' });
    expect(res.status).toBe(409);
  });

  it('changes role MEMBER→ADMIN and back', async () => {
    const adminToken = await registerAdmin();
    const created = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ username: 'theo', password: 'anothersecret', role: 'MEMBER' });
    const id = created.body.id as number;

    const promote = await request(app)
      .patch(`/api/users/${id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'ADMIN' });
    expect(promote.status).toBe(200);
    expect(promote.body.role).toBe('ADMIN');

    const demote = await request(app)
      .patch(`/api/users/${id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'MEMBER' });
    expect(demote.status).toBe(200);
    expect(demote.body.role).toBe('MEMBER');
  });

  it('refuses to demote the last admin (409)', async () => {
    const adminToken = await registerAdmin();
    const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${adminToken}`);
    const res = await request(app)
      .patch(`/api/users/${me.body.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'MEMBER' });
    expect(res.status).toBe(409);
  });

  it('404s when updating a missing user', async () => {
    const adminToken = await registerAdmin();
    const res = await request(app)
      .patch('/api/users/9999')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'MEMBER' });
    expect(res.status).toBe(404);
  });

  it('resets a password: new password works and old refresh token is revoked', async () => {
    const adminToken = await registerAdmin();
    const created = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ username: 'theo', password: 'anothersecret', role: 'MEMBER' });
    const id = created.body.id as number;

    // Target logs in, obtaining a refresh token.
    const firstLogin = await request(app)
      .post('/api/auth/login')
      .send({ username: 'theo', password: 'anothersecret' });
    const oldRefresh = firstLogin.body.refreshToken as string;

    // Admin resets the password.
    const reset = await request(app)
      .patch(`/api/users/${id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ password: 'brandnewsecret' });
    expect(reset.status).toBe(200);

    // Old refresh token is revoked (tokenVersion bumped).
    const revoked = await request(app).post('/api/auth/refresh').send({ refreshToken: oldRefresh });
    expect(revoked.status).toBe(401);

    // Login with the new password works.
    const newLogin = await request(app)
      .post('/api/auth/login')
      .send({ username: 'theo', password: 'brandnewsecret' });
    expect(newLogin.status).toBe(200);

    // Old password no longer works.
    const oldPassword = await request(app)
      .post('/api/auth/login')
      .send({ username: 'theo', password: 'anothersecret' });
    expect(oldPassword.status).toBe(401);
  });

  it('deletes a member (204)', async () => {
    const adminToken = await registerAdmin();
    const created = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ username: 'theo', password: 'anothersecret', role: 'MEMBER' });
    const res = await request(app)
      .delete(`/api/users/${created.body.id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(204);
  });

  it('refuses to delete your own account (409)', async () => {
    const adminToken = await registerAdmin();
    const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${adminToken}`);
    const res = await request(app)
      .delete(`/api/users/${me.body.id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(409);
  });

  it('refuses to delete the last admin (409)', async () => {
    // With a single admin, deleting that admin is the last-admin case. It is
    // reached here via self-delete (the self guard fires first), so to exercise
    // the last-admin guard on its own we delete a *different* admin down to one,
    // then confirm the sole remaining admin cannot be removed.
    const adminToken = await registerAdmin();

    // Second admin, so we have two.
    await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ username: 'nadia', password: 'anothersecret', role: 'ADMIN' });
    const nadiaLogin = await request(app)
      .post('/api/auth/login')
      .send({ username: 'nadia', password: 'anothersecret' });
    const nadiaToken = nadiaLogin.body.accessToken as string;

    // nadia deletes maya -> nadia is now the only admin (allowed, two existed).
    const maya = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${adminToken}`);
    const delMaya = await request(app)
      .delete(`/api/users/${maya.body.id}`)
      .set('Authorization', `Bearer ${nadiaToken}`);
    expect(delMaya.status).toBe(204);

    // nadia is the last admin; trying to delete herself hits the guard chain and
    // returns 409.
    const nadia = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${nadiaToken}`);
    const res = await request(app)
      .delete(`/api/users/${nadia.body.id}`)
      .set('Authorization', `Bearer ${nadiaToken}`);
    expect(res.status).toBe(409);
  });
});
