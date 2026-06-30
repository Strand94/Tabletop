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

describe('auth flow', () => {
  it('first registration creates an ADMIN without auth', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'maya', password: 'supersecret' });
    expect(res.status).toBe(201);
    expect(res.body.role).toBe('ADMIN');
    expect(res.body.passwordHash).toBeUndefined();
  });

  it('second registration without an admin token is rejected (401)', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ username: 'maya', password: 'supersecret' });
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'theo', password: 'anothersecret' });
    expect(res.status).toBe(401);
  });

  it('an admin can create additional MEMBER users', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ username: 'maya', password: 'supersecret' });
    const login = await request(app)
      .post('/api/auth/login')
      .send({ username: 'maya', password: 'supersecret' });
    const res = await request(app)
      .post('/api/auth/register')
      .set('Authorization', `Bearer ${login.body.accessToken}`)
      .send({ username: 'theo', password: 'anothersecret' });
    expect(res.status).toBe(201);
    expect(res.body.role).toBe('MEMBER');
  });

  it('login returns tokens and the public user; /me echoes the user', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ username: 'maya', password: 'supersecret' });
    const login = await request(app)
      .post('/api/auth/login')
      .send({ username: 'maya', password: 'supersecret' });
    expect(login.status).toBe(200);
    expect(login.body.accessToken).toBeTruthy();
    expect(login.body.refreshToken).toBeTruthy();

    const me = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${login.body.accessToken}`);
    expect(me.status).toBe(200);
    expect(me.body.username).toBe('maya');
  });

  it('rejects login with a wrong password (401)', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ username: 'maya', password: 'supersecret' });
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'maya', password: 'wrongpass' });
    expect(res.status).toBe(401);
  });

  it('refresh issues a new access token', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ username: 'maya', password: 'supersecret' });
    const login = await request(app)
      .post('/api/auth/login')
      .send({ username: 'maya', password: 'supersecret' });
    const res = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: login.body.refreshToken });
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeTruthy();
  });

  it('rejects duplicate usernames (409)', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ username: 'maya', password: 'supersecret' });
    const login = await request(app)
      .post('/api/auth/login')
      .send({ username: 'maya', password: 'supersecret' });
    const res = await request(app)
      .post('/api/auth/register')
      .set('Authorization', `Bearer ${login.body.accessToken}`)
      .send({ username: 'maya', password: 'supersecret' });
    expect(res.status).toBe(409);
  });
});
