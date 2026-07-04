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
let adminToken: string;
let memberToken: string;
let gameId: number;

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

beforeAll(() => {
  applyMigrations();
  app = createApp({ tokens, defaultLocale: 'en', defaultCurrency: 'NOK' });
});

beforeEach(async () => {
  await resetDb();
  await request(app).post('/api/auth/register').send({ username: 'maya', password: 'supersecret' });
  adminToken = (
    await request(app).post('/api/auth/login').send({ username: 'maya', password: 'supersecret' })
  ).body.accessToken;
  await request(app)
    .post('/api/auth/register')
    .set(auth(adminToken))
    .send({ username: 'theo', password: 'anothersecret' });
  memberToken = (
    await request(app).post('/api/auth/login').send({ username: 'theo', password: 'anothersecret' })
  ).body.accessToken;
  const game = await request(app)
    .post('/api/games')
    .set(auth(memberToken))
    .send({ title: 'Crimson Frontier' });
  gameId = game.body.id;
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('expansions API', () => {
  it('requires authentication', async () => {
    const res = await request(app).get(`/api/games/${gameId}/expansions`);
    expect(res.status).toBe(401);
  });

  it('creates an expansion under a game and lists it', async () => {
    const create = await request(app)
      .post(`/api/games/${gameId}/expansions`)
      .set(auth(memberToken))
      .send({ title: 'Frostmark', releaseYear: 2022, price: 249 });
    expect(create.status).toBe(201);
    expect(create.body.gameId).toBe(gameId);
    expect(create.body.sessionCount).toBe(0);

    const list = await request(app).get(`/api/games/${gameId}/expansions`).set(auth(memberToken));
    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(1);
    expect(list.body[0].title).toBe('Frostmark');
  });

  it('rejects creating an expansion for a non-existent game (404)', async () => {
    const res = await request(app)
      .post('/api/games/999999/expansions')
      .set(auth(memberToken))
      .send({ title: 'Orphan' });
    expect(res.status).toBe(404);
  });

  it('validates ranges (minPlayers > maxPlayers)', async () => {
    const res = await request(app)
      .post(`/api/games/${gameId}/expansions`)
      .set(auth(memberToken))
      .send({ title: 'Bad', minPlayers: 5, maxPlayers: 2 });
    expect(res.status).toBe(400);
  });

  it('updates an expansion', async () => {
    const created = await request(app)
      .post(`/api/games/${gameId}/expansions`)
      .set(auth(memberToken))
      .send({ title: 'Old Exp' });
    const updated = await request(app)
      .patch(`/api/expansions/${created.body.id}`)
      .set(auth(memberToken))
      .send({ title: 'New Exp', price: 199 });
    expect(updated.status).toBe(200);
    expect(updated.body.title).toBe('New Exp');
    expect(updated.body.price).toBe(199);
  });

  it('clears an optional field when updated with null', async () => {
    const created = await request(app)
      .post(`/api/games/${gameId}/expansions`)
      .set(auth(memberToken))
      .send({ title: 'Clearable', releaseYear: 2020, price: 199 });
    expect(created.body.releaseYear).toBe(2020);

    const updated = await request(app)
      .patch(`/api/expansions/${created.body.id}`)
      .set(auth(memberToken))
      .send({ releaseYear: null });
    expect(updated.status).toBe(200);
    expect(updated.body.releaseYear).toBeNull();
    // A field NOT included in the patch must stay unchanged.
    expect(updated.body.price).toBe(199);
  });

  it('forbids members from deleting but allows admins', async () => {
    const created = await request(app)
      .post(`/api/games/${gameId}/expansions`)
      .set(auth(memberToken))
      .send({ title: 'Doomed Exp' });
    const id = created.body.id;

    const memberDelete = await request(app).delete(`/api/expansions/${id}`).set(auth(memberToken));
    expect(memberDelete.status).toBe(403);

    const adminDelete = await request(app).delete(`/api/expansions/${id}`).set(auth(adminToken));
    expect(adminDelete.status).toBe(204);

    const list = await request(app).get(`/api/games/${gameId}/expansions`).set(auth(memberToken));
    expect(list.body).toHaveLength(0);
  });

  it('cascades expansion deletion when the base game is deleted', async () => {
    await request(app)
      .post(`/api/games/${gameId}/expansions`)
      .set(auth(memberToken))
      .send({ title: 'Cascade Exp' });
    await request(app).delete(`/api/games/${gameId}`).set(auth(adminToken));

    const list = await request(app).get(`/api/games/${gameId}/expansions`).set(auth(memberToken));
    expect(list.status).toBe(404); // game (and its expansions) gone
  });
});
