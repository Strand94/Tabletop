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

  it('computes most-played, top players, and sessions-per-day', async () => {
    const auth = { Authorization: `Bearer ${token}` };
    const gameId = (await request(app).post('/api/games').set(auth).send({ title: 'Crimson' })).body
      .id;
    const maya = (await request(app).post('/api/people').set(auth).send({ name: 'Maya' })).body.id;
    const theo = (await request(app).post('/api/people').set(auth).send({ name: 'Theo' })).body.id;

    // Maya wins twice, Theo once.
    for (const winner of [maya, maya, theo]) {
      await request(app)
        .post('/api/sessions')
        .set(auth)
        .send({
          gameId,
          start: new Date().toISOString(),
          players: [
            { personId: maya, won: winner === maya },
            { personId: theo, won: winner === theo },
          ],
        });
    }

    const res = await request(app).get('/api/stats/dashboard').set(auth);
    expect(res.body.mostPlayed[0]).toMatchObject({ gameId, plays: 3 });
    expect(res.body.sessionsPerDay).toHaveLength(14);
    expect(res.body.sessionsPerDay.at(-1).count).toBe(3);
    expect(res.body.recentSessions).toHaveLength(3);

    const maya1 = res.body.topPlayers.find((p: { personId: number }) => p.personId === maya);
    expect(maya1.wins).toBe(2);
    expect(maya1.plays).toBe(3);
    expect(maya1.winRate).toBeCloseTo(2 / 3);
  });

  it('reports per-player stats with favourite game', async () => {
    const auth = { Authorization: `Bearer ${token}` };
    const gameId = (await request(app).post('/api/games').set(auth).send({ title: 'Crimson' })).body
      .id;
    const maya = (await request(app).post('/api/people').set(auth).send({ name: 'Maya' })).body.id;
    await request(app)
      .post('/api/sessions')
      .set(auth)
      .send({
        gameId,
        start: new Date().toISOString(),
        players: [{ personId: maya, score: 90, won: true }],
      });

    const res = await request(app).get('/api/stats/players').set(auth);
    const mayaStats = res.body.find((p: { personId: number }) => p.personId === maya);
    expect(mayaStats).toMatchObject({
      plays: 1,
      wins: 1,
      winRate: 1,
      avgScore: 90,
      favoriteGame: 'Crimson',
    });
  });

  it('reports per-game stats', async () => {
    const auth = { Authorization: `Bearer ${token}` };
    const gameId = (await request(app).post('/api/games').set(auth).send({ title: 'Crimson' })).body
      .id;
    const maya = (await request(app).post('/api/people').set(auth).send({ name: 'Maya' })).body.id;
    await request(app)
      .post('/api/sessions')
      .set(auth)
      .send({
        gameId,
        start: new Date().toISOString(),
        players: [{ personId: maya, won: true }],
      });

    const res = await request(app).get(`/api/stats/games/${gameId}`).set(auth);
    expect(res.body).toMatchObject({ gameId, plays: 1 });
    expect(res.body.lastPlayed).toBeTruthy();
    expect(res.body.topPlayers[0].personId).toBe(maya);
  });
});
