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
let token: string;

beforeAll(() => {
  applyMigrations();
  app = createApp({ tokens, defaultLocale: 'en', defaultCurrency: 'NOK' });
});

beforeEach(async () => {
  await resetDb();
  await request(app).post('/api/auth/register').send({ username: 'maya', password: 'supersecret' });
  const login = await request(app)
    .post('/api/auth/login')
    .send({ username: 'maya', password: 'supersecret' });
  token = login.body.accessToken;
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('GET /api/stats/dashboard', () => {
  it('requires authentication', async () => {
    const res = await request(app).get('/api/stats/dashboard');
    expect(res.status).toBe(401);
  });

  it('reports zeros on an empty instance', async () => {
    const res = await request(app)
      .get('/api/stats/dashboard')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      gamesOwned: 0,
      wishlist: 0,
      sessions: 0,
      players: 0,
      expansions: 0,
      collectionValue: 0,
      avgPrice: 0,
      currency: 'NOK',
    });
  });

  it('aggregates owned games, wishlist, value, and average price', async () => {
    const auth = { Authorization: `Bearer ${token}` };
    await request(app)
      .post('/api/games')
      .set(auth)
      .send({ title: 'A', price: 600, collectionStatus: 'OWNED' });
    await request(app)
      .post('/api/games')
      .set(auth)
      .send({ title: 'B', price: 400, collectionStatus: 'OWNED' });
    await request(app)
      .post('/api/games')
      .set(auth)
      .send({ title: 'C', price: 999, collectionStatus: 'WISHLIST' });

    const res = await request(app).get('/api/stats/dashboard').set(auth);
    expect(res.body.gamesOwned).toBe(2);
    expect(res.body.wishlist).toBe(1);
    expect(res.body.collectionValue).toBe(1000);
    expect(res.body.avgPrice).toBe(500);
  });
});
