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
let memberUserId: number;

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
  const theo = await request(app)
    .post('/api/auth/register')
    .set(auth(adminToken))
    .send({ username: 'theo', password: 'anothersecret' });
  memberUserId = theo.body.id;
  memberToken = (
    await request(app).post('/api/auth/login').send({ username: 'theo', password: 'anothersecret' })
  ).body.accessToken;
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('people API', () => {
  it('requires authentication', async () => {
    expect((await request(app).get('/api/people')).status).toBe(401);
  });

  it('creates a guest person (no account) and lists it', async () => {
    const create = await request(app)
      .post('/api/people')
      .set(auth(memberToken))
      .send({ name: 'Jonas' });
    expect(create.status).toBe(201);
    expect(create.body.account).toBeNull();

    const list = await request(app).get('/api/people').set(auth(memberToken));
    expect(list.body).toHaveLength(1);
    expect(list.body[0].name).toBe('Jonas');
  });

  it('links a person to an existing account', async () => {
    const create = await request(app)
      .post('/api/people')
      .set(auth(memberToken))
      .send({ name: 'Theo', userId: memberUserId });
    expect(create.status).toBe(201);
    expect(create.body.account).toMatchObject({
      userId: memberUserId,
      username: 'theo',
      role: 'MEMBER',
    });
  });

  it('rejects linking a non-existent account (400)', async () => {
    const res = await request(app)
      .post('/api/people')
      .set(auth(memberToken))
      .send({ name: 'Ghost', userId: 999999 });
    expect(res.status).toBe(400);
  });

  it('rejects linking an account already linked to another person (409)', async () => {
    await request(app)
      .post('/api/people')
      .set(auth(memberToken))
      .send({ name: 'Theo', userId: memberUserId });
    const dup = await request(app)
      .post('/api/people')
      .set(auth(memberToken))
      .send({ name: 'Theo Clone', userId: memberUserId });
    expect(dup.status).toBe(409);
  });

  it('updates a person name', async () => {
    const created = await request(app)
      .post('/api/people')
      .set(auth(memberToken))
      .send({ name: 'Sam' });
    const updated = await request(app)
      .patch(`/api/people/${created.body.id}`)
      .set(auth(memberToken))
      .send({ name: 'Samuel' });
    expect(updated.status).toBe(200);
    expect(updated.body.name).toBe('Samuel');
  });

  it('forbids members from deleting but allows admins', async () => {
    const created = await request(app)
      .post('/api/people')
      .set(auth(memberToken))
      .send({ name: 'Doomed' });
    const id = created.body.id;
    expect((await request(app).delete(`/api/people/${id}`).set(auth(memberToken))).status).toBe(
      403,
    );
    expect((await request(app).delete(`/api/people/${id}`).set(auth(adminToken))).status).toBe(204);
    expect((await request(app).get('/api/people').set(auth(memberToken))).body).toHaveLength(0);
  });
});
