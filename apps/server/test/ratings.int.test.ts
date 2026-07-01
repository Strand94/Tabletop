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
let gameId: number;
let personId: number;

const auth = () => ({ Authorization: `Bearer ${token}` });

beforeAll(() => {
  applyMigrations();
  app = createApp({ tokens, defaultLocale: 'en', defaultCurrency: 'NOK' });
});

beforeEach(async () => {
  await resetDb();
  await request(app).post('/api/auth/register').send({ username: 'maya', password: 'supersecret' });
  token = (
    await request(app).post('/api/auth/login').send({ username: 'maya', password: 'supersecret' })
  ).body.accessToken;
  gameId = (await request(app).post('/api/games').set(auth()).send({ title: 'Crimson Frontier' }))
    .body.id;
  personId = (await request(app).post('/api/people').set(auth()).send({ name: 'Maya' })).body.id;
});

afterAll(async () => {
  await prisma.$disconnect();
});

async function logSession(): Promise<number> {
  const res = await request(app)
    .post('/api/sessions')
    .set(auth())
    .send({
      gameId,
      start: '2026-06-24T18:00:00Z',
      end: '2026-06-24T19:00:00Z',
      players: [{ personId, won: true }],
    });
  return res.body.id;
}

describe('ratings API', () => {
  it('upserts a game rating and reflects it as myRating', async () => {
    const put = await request(app)
      .put(`/api/games/${gameId}/rating`)
      .set(auth())
      .send({ rating: 8.6, review: 'Tight area control' });
    expect(put.status).toBe(200);
    expect(put.body.rating).toBe(8.6);

    const game = await request(app).get(`/api/games/${gameId}`).set(auth());
    expect(game.body.myRating).toBe(8.6);

    // Upsert again updates rather than duplicating.
    const again = await request(app)
      .put(`/api/games/${gameId}/rating`)
      .set(auth())
      .send({ rating: 9 });
    expect(again.body.rating).toBe(9);
    const game2 = await request(app).get(`/api/games/${gameId}`).set(auth());
    expect(game2.body.myRating).toBe(9);
  });

  it('rejects out-of-range ratings (400)', async () => {
    expect(
      (await request(app).put(`/api/games/${gameId}/rating`).set(auth()).send({ rating: 0 }))
        .status,
    ).toBe(400);
    expect(
      (await request(app).put(`/api/games/${gameId}/rating`).set(auth()).send({ rating: 11 }))
        .status,
    ).toBe(400);
  });

  it('404 when rating a missing game', async () => {
    const res = await request(app).put('/api/games/999999/rating').set(auth()).send({ rating: 7 });
    expect(res.status).toBe(404);
  });

  it('upserts a session rating and reflects it as myRating', async () => {
    const sessionId = await logSession();
    const put = await request(app)
      .put(`/api/sessions/${sessionId}/rating`)
      .set(auth())
      .send({ rating: 9, note: 'Great evening' });
    expect(put.status).toBe(200);

    const session = await request(app).get(`/api/sessions/${sessionId}`).set(auth());
    expect(session.body.myRating).toBe(9);
  });

  it('aggregates session ratings into the game avgSessionRating', async () => {
    const s1 = await logSession();
    const s2 = await logSession();
    await request(app).put(`/api/sessions/${s1}/rating`).set(auth()).send({ rating: 8 });
    await request(app).put(`/api/sessions/${s2}/rating`).set(auth()).send({ rating: 6 });

    const game = await request(app).get(`/api/games/${gameId}`).set(auth());
    expect(game.body.avgSessionRating).toBe(7);
    expect(game.body.sessionRatingCount).toBe(2);
  });
});
