import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../src/app.js';
import { tokenServiceFromConfig } from '../src/modules/auth/routes.js';
import { prisma } from '../src/db.js';
import { applyMigrations, resetDb } from './helpers/db.js';
import { replaceCatalog } from '../src/modules/bgg/catalog-service.js';

const tokens = tokenServiceFromConfig({
  JWT_SECRET: 'access-secret-access-secret-1234567890',
  JWT_REFRESH_SECRET: 'refresh-secret-refresh-secret-1234567890',
});

let adminToken: string;
let memberToken: string;

async function bootstrap(app: Express): Promise<void> {
  await resetDb();
  await request(app).post('/api/auth/register').send({ username: 'maya', password: 'supersecret' });
  adminToken = (
    await request(app).post('/api/auth/login').send({ username: 'maya', password: 'supersecret' })
  ).body.accessToken;
  await request(app)
    .post('/api/auth/register')
    .set({ Authorization: `Bearer ${adminToken}` })
    .send({ username: 'theo', password: 'anothersecret' });
  memberToken = (
    await request(app).post('/api/auth/login').send({ username: 'theo', password: 'anothersecret' })
  ).body.accessToken;
}

beforeAll(() => applyMigrations());
afterAll(async () => prisma.$disconnect());

describe('POST /api/sync/bgg', () => {
  const disabledApp = () => createApp({ tokens, defaultLocale: 'en', defaultCurrency: 'NOK' });

  it('is admin-only', async () => {
    const app = disabledApp();
    await bootstrap(app);
    expect((await request(app).post('/api/sync/bgg')).status).toBe(401);
    expect(
      (
        await request(app)
          .post('/api/sync/bgg')
          .set({ Authorization: `Bearer ${memberToken}` })
      ).status,
    ).toBe(403);
  });

  it('reports disabled when BGG_SYNC_ENABLED is false (default)', async () => {
    const app = disabledApp();
    await bootstrap(app);
    const res = await request(app)
      .post('/api/sync/bgg')
      .set({ Authorization: `Bearer ${adminToken}` });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'disabled', synced: 0 });
  });

  it('runs the (stub) provider as a no-op when enabled', async () => {
    const app = createApp({
      tokens,
      defaultLocale: 'en',
      defaultCurrency: 'NOK',
      bgg: { enabled: true, provider: 'csv', apiToken: undefined },
    });
    await bootstrap(app);
    await request(app)
      .post('/api/games')
      .set({ Authorization: `Bearer ${adminToken}` })
      .send({ title: 'Crimson', bggId: 284083 });

    const res = await request(app)
      .post('/api/sync/bgg')
      .set({ Authorization: `Bearer ${adminToken}` });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok', synced: 0 });
  });

  it('sync updates bgg_rating/bgg_rank from the catalog when enabled', async () => {
    const app = createApp({
      tokens,
      defaultLocale: 'en',
      defaultCurrency: 'NOK',
      bgg: { enabled: true, provider: 'csv', apiToken: undefined },
    });
    await bootstrap(app);
    const game = await request(app)
      .post('/api/games')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Ark Nova', bggId: 1 })
      .expect(201);
    await replaceCatalog(
      [
        {
          bggId: 1,
          name: 'Ark Nova',
          year: 2021,
          rank: 2,
          average: 8.54,
          bayesAverage: 8.35,
          usersRated: 100,
          thumbnail: 't',
        },
      ],
      '2026-06-29',
    );
    const enabledApp = createApp({
      tokens,
      defaultLocale: 'en',
      defaultCurrency: 'NOK',
      bgg: { enabled: true, provider: 'csv', apiToken: undefined },
    });
    await request(enabledApp)
      .post('/api/sync/bgg')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const fetched = await request(app)
      .get(`/api/games/${game.body.id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(fetched.body.bggRating).toBe(8.54);
    expect(fetched.body.bggRank).toBe(2);
  });
});
