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
let otherGameId: number;
let expansionId: number;
let foreignExpansionId: number;
let mayaId: number;
let theoId: number;

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
  otherGameId = (await request(app).post('/api/games').set(auth()).send({ title: 'Other Game' }))
    .body.id;
  expansionId = (
    await request(app)
      .post(`/api/games/${gameId}/expansions`)
      .set(auth())
      .send({ title: 'Frostmark' })
  ).body.id;
  foreignExpansionId = (
    await request(app)
      .post(`/api/games/${otherGameId}/expansions`)
      .set(auth())
      .send({ title: 'Foreign Exp' })
  ).body.id;
  mayaId = (await request(app).post('/api/people').set(auth()).send({ name: 'Maya' })).body.id;
  theoId = (await request(app).post('/api/people').set(auth()).send({ name: 'Theo' })).body.id;
});

afterAll(async () => {
  await prisma.$disconnect();
});

const baseSession = () => ({
  gameId,
  start: '2026-06-24T18:00:00Z',
  end: '2026-06-24T20:05:00Z',
  expansionIds: [expansionId],
  players: [
    { personId: mayaId, score: 92, won: true, firstPlay: false },
    { personId: theoId, score: 74, won: false, firstPlay: true },
  ],
});

describe('sessions API', () => {
  it('requires authentication', async () => {
    expect((await request(app).get('/api/sessions')).status).toBe(401);
  });

  it('creates a session and derives duration', async () => {
    const res = await request(app).post('/api/sessions').set(auth()).send(baseSession());
    expect(res.status).toBe(201);
    expect(res.body.durationMinutes).toBe(125);
    expect(res.body.players).toHaveLength(2);
    expect(res.body.expansions[0].title).toBe('Frostmark');
    expect(res.body.gameTitle).toBe('Crimson Frontier');
  });

  it('rejects a session with no players (400)', async () => {
    const res = await request(app)
      .post('/api/sessions')
      .set(auth())
      .send({ ...baseSession(), players: [] });
    expect(res.status).toBe(400);
  });

  it('rejects an expansion that belongs to another game (400)', async () => {
    const res = await request(app)
      .post('/api/sessions')
      .set(auth())
      .send({ ...baseSession(), expansionIds: [foreignExpansionId] });
    expect(res.status).toBe(400);
  });

  it('rejects a non-existent player (400)', async () => {
    const res = await request(app)
      .post('/api/sessions')
      .set(auth())
      .send({ ...baseSession(), players: [{ personId: 999999, won: true }] });
    expect(res.status).toBe(400);
  });

  it('allows multiple winners (co-op/ties)', async () => {
    const res = await request(app)
      .post('/api/sessions')
      .set(auth())
      .send({
        ...baseSession(),
        players: [
          { personId: mayaId, won: true },
          { personId: theoId, won: true },
        ],
      });
    expect(res.status).toBe(201);
    expect(res.body.players.filter((p: { won: boolean }) => p.won)).toHaveLength(2);
  });

  it('filters by game and by person', async () => {
    await request(app).post('/api/sessions').set(auth()).send(baseSession());
    await request(app)
      .post('/api/sessions')
      .set(auth())
      .send({
        ...baseSession(),
        gameId: otherGameId,
        expansionIds: [],
        players: [{ personId: mayaId, won: true }],
      });

    expect(
      (await request(app).get(`/api/sessions?game=${gameId}`).set(auth())).body.items,
    ).toHaveLength(1);
    expect(
      (await request(app).get(`/api/sessions?person=${theoId}`).set(auth())).body.items,
    ).toHaveLength(1);
    expect(
      (await request(app).get(`/api/sessions?person=${mayaId}`).set(auth())).body.items,
    ).toHaveLength(2);
  });

  it('updates a session (replaces players)', async () => {
    const created = await request(app).post('/api/sessions').set(auth()).send(baseSession());
    const updated = await request(app)
      .patch(`/api/sessions/${created.body.id}`)
      .set(auth())
      .send({ comment: 'Rematch', players: [{ personId: theoId, won: true }] });
    expect(updated.status).toBe(200);
    expect(updated.body.comment).toBe('Rematch');
    expect(updated.body.players).toHaveLength(1);
    expect(updated.body.players[0].name).toBe('Theo');
  });

  it('deletes a session', async () => {
    const created = await request(app).post('/api/sessions').set(auth()).send(baseSession());
    expect((await request(app).delete(`/api/sessions/${created.body.id}`).set(auth())).status).toBe(
      204,
    );
    expect((await request(app).get(`/api/sessions/${created.body.id}`).set(auth())).status).toBe(
      404,
    );
  });

  it('keeps sessions when a participating person is deleted (only the join goes)', async () => {
    const created = await request(app).post('/api/sessions').set(auth()).send(baseSession());
    // maya is the first-run ADMIN, so she may delete a person.
    await request(app).delete(`/api/people/${theoId}`).set(auth());
    const after = await request(app).get(`/api/sessions/${created.body.id}`).set(auth());
    expect(after.status).toBe(200);
    expect(after.body.players.map((p: { name: string }) => p.name)).toEqual(['Maya']);
  });
});
