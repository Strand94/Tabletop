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

async function seedUsersAndLogin(): Promise<void> {
  await request(app).post('/api/auth/register').send({ username: 'maya', password: 'supersecret' });
  const adminLogin = await request(app)
    .post('/api/auth/login')
    .send({ username: 'maya', password: 'supersecret' });
  adminToken = adminLogin.body.accessToken;
  await request(app)
    .post('/api/auth/register')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ username: 'theo', password: 'anothersecret' });
  const memberLogin = await request(app)
    .post('/api/auth/login')
    .send({ username: 'theo', password: 'anothersecret' });
  memberToken = memberLogin.body.accessToken;
}

beforeAll(() => {
  applyMigrations();
  app = createApp({ tokens, defaultLocale: 'en', defaultCurrency: 'NOK' });
});

beforeEach(async () => {
  await resetDb();
  await seedUsersAndLogin();
});

afterAll(async () => {
  await prisma.$disconnect();
});

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

describe('games API', () => {
  it('requires authentication', async () => {
    const res = await request(app).get('/api/games');
    expect(res.status).toBe(401);
  });

  it('creates a game with defaults and lists it', async () => {
    const create = await request(app)
      .post('/api/games')
      .set(auth(memberToken))
      .send({ title: 'Crimson Frontier', minPlayers: 1, maxPlayers: 4, weight: 3.4, price: 649 });
    expect(create.status).toBe(201);
    expect(create.body.currency).toBe('NOK');
    expect(create.body.collectionStatus).toBe('OWNED');
    expect(create.body.weight).toBe(3.4);

    const list = await request(app).get('/api/games').set(auth(memberToken));
    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(1);
    expect(list.body[0].title).toBe('Crimson Frontier');
  });

  it('rejects invalid ranges (minPlayers > maxPlayers)', async () => {
    const res = await request(app)
      .post('/api/games')
      .set(auth(memberToken))
      .send({ title: 'Bad', minPlayers: 5, maxPlayers: 2 });
    expect(res.status).toBe(400);
  });

  it('rejects an out-of-range weight', async () => {
    const res = await request(app)
      .post('/api/games')
      .set(auth(memberToken))
      .send({ title: 'Heavy', weight: 9 });
    expect(res.status).toBe(400);
  });

  it('assigns categories and filters by them', async () => {
    const strategy = await prisma.category.create({ data: { name: 'Strategy' } });
    const family = await prisma.category.create({ data: { name: 'Family' } });
    await request(app)
      .post('/api/games')
      .set(auth(memberToken))
      .send({ title: 'Strat Game', categoryIds: [strategy.id] });
    await request(app)
      .post('/api/games')
      .set(auth(memberToken))
      .send({ title: 'Fam Game', categoryIds: [family.id] });

    const filtered = await request(app)
      .get(`/api/games?category=${strategy.id}`)
      .set(auth(memberToken));
    expect(filtered.body).toHaveLength(1);
    expect(filtered.body[0].title).toBe('Strat Game');
    expect(filtered.body[0].categories[0].name).toBe('Strategy');
  });

  it('filters by status and searches by title', async () => {
    await request(app)
      .post('/api/games')
      .set(auth(memberToken))
      .send({ title: 'Owned One', collectionStatus: 'OWNED' });
    await request(app)
      .post('/api/games')
      .set(auth(memberToken))
      .send({ title: 'Wished One', collectionStatus: 'WISHLIST' });

    const owned = await request(app).get('/api/games?status=OWNED').set(auth(memberToken));
    expect(owned.body).toHaveLength(1);
    expect(owned.body[0].title).toBe('Owned One');

    const search = await request(app).get('/api/games?q=wished').set(auth(memberToken));
    expect(search.body).toHaveLength(1);
    expect(search.body[0].title).toBe('Wished One');
  });

  it('updates a game', async () => {
    const created = await request(app)
      .post('/api/games')
      .set(auth(memberToken))
      .send({ title: 'Old Title' });
    const updated = await request(app)
      .patch(`/api/games/${created.body.id}`)
      .set(auth(memberToken))
      .send({ title: 'New Title', collectionStatus: 'WISHLIST' });
    expect(updated.status).toBe(200);
    expect(updated.body.title).toBe('New Title');
    expect(updated.body.collectionStatus).toBe('WISHLIST');
  });

  it('forbids members from deleting but allows admins', async () => {
    const created = await request(app)
      .post('/api/games')
      .set(auth(memberToken))
      .send({ title: 'Doomed' });
    const id = created.body.id;

    const memberDelete = await request(app).delete(`/api/games/${id}`).set(auth(memberToken));
    expect(memberDelete.status).toBe(403);

    const adminDelete = await request(app).delete(`/api/games/${id}`).set(auth(adminToken));
    expect(adminDelete.status).toBe(204);

    const after = await request(app).get(`/api/games/${id}`).set(auth(memberToken));
    expect(after.status).toBe(404);
  });
});
