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
  await request(app)
    .post('/api/games')
    .set(auth(adminToken))
    .send({ title: 'Crimson', price: 649 });
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('export API', () => {
  it('is admin-only', async () => {
    expect((await request(app).get('/api/export/json')).status).toBe(401);
    expect((await request(app).get('/api/export/json').set(auth(memberToken))).status).toBe(403);
  });

  it('exports a JSON backup', async () => {
    const res = await request(app).get('/api/export/json').set(auth(adminToken));
    expect(res.status).toBe(200);
    expect(res.body.version).toBe(1);
    expect(res.body.games).toHaveLength(1);
    expect(res.body.games[0].title).toBe('Crimson');
  });

  it('exports a games CSV', async () => {
    const res = await request(app).get('/api/export/csv').set(auth(adminToken));
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.text.split('\n')[0]).toContain('title');
    expect(res.text).toContain('Crimson');
  });
});

describe('shelf of shame filter', () => {
  it('lists owned games with no sessions', async () => {
    // The seeded "Crimson" has no sessions -> it is on the shelf.
    const res = await request(app).get('/api/games?neverPlayed=true').set(auth(adminToken));
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);

    // Log a play; it should drop off the shelf.
    const gameId = res.body.items[0].id;
    const person = (
      await request(app).post('/api/people').set(auth(adminToken)).send({ name: 'M' })
    ).body.id;
    await request(app)
      .post('/api/sessions')
      .set(auth(adminToken))
      .send({
        gameId,
        start: new Date().toISOString(),
        players: [{ personId: person, won: true }],
      });

    const after = await request(app).get('/api/games?neverPlayed=true').set(auth(adminToken));
    expect(after.body.items).toHaveLength(0);
  });
});
