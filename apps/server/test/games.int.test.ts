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
});

beforeEach(async () => {
  // Fresh app per test so the shared auth rate-limiter's in-memory counter resets;
  // the whole file otherwise drives >50 auth calls and later logins get throttled.
  app = createApp({ tokens, defaultLocale: 'en', defaultCurrency: 'NOK' });
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
    expect(list.body.items).toHaveLength(1);
    expect(list.body.items[0].title).toBe('Crimson Frontier');
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
    expect(filtered.body.items).toHaveLength(1);
    expect(filtered.body.items[0].title).toBe('Strat Game');
    expect(filtered.body.items[0].categories[0].name).toBe('Strategy');
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
    expect(owned.body.items).toHaveLength(1);
    expect(owned.body.items[0].title).toBe('Owned One');

    const search = await request(app).get('/api/games?q=wished').set(auth(memberToken));
    expect(search.body.items).toHaveLength(1);
    expect(search.body.items[0].title).toBe('Wished One');
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

  it('clears an optional field when updated with null', async () => {
    const created = await request(app)
      .post('/api/games')
      .set(auth(memberToken))
      .send({ title: 'Clearable', releaseYear: 1999, description: 'old' });
    expect(created.body.releaseYear).toBe(1999);

    const updated = await request(app)
      .patch(`/api/games/${created.body.id}`)
      .set(auth(memberToken))
      .send({ releaseYear: null });
    expect(updated.status).toBe(200);
    expect(updated.body.releaseYear).toBeNull();
    // A field NOT included in the patch must stay unchanged.
    expect(updated.body.description).toBe('old');
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

  it('paginates the list with total/page/pageSize', async () => {
    for (const title of ['A', 'B', 'C']) {
      await request(app).post('/api/games').set(auth(memberToken)).send({ title });
    }
    const p1 = await request(app).get('/api/games?pageSize=2&page=1').set(auth(memberToken));
    expect(p1.body.total).toBe(3);
    expect(p1.body.page).toBe(1);
    expect(p1.body.pageSize).toBe(2);
    expect(p1.body.items).toHaveLength(2);

    const p2 = await request(app).get('/api/games?pageSize=2&page=2').set(auth(memberToken));
    expect(p2.body.items).toHaveLength(1);
  });

  it('stores uploaded images with a safe extension derived from the MIME type', async () => {
    const created = await request(app)
      .post('/api/games')
      .set(auth(memberToken))
      .send({ title: 'With Cover' });
    // A tiny valid-enough PNG buffer, uploaded under a malicious filename but a
    // declared image/png content type. The stored path must not be .html.
    const res = await request(app)
      .post(`/api/games/${created.body.id}/image`)
      .set(auth(memberToken))
      .attach('image', Buffer.from([0x89, 0x50, 0x4e, 0x47]), {
        filename: 'evil.html',
        contentType: 'image/png',
      });
    expect(res.status).toBe(200);
    expect(res.body.imagePath).toMatch(/^\/images\/[a-f0-9-]+\.png$/);
    expect(res.body.imagePath).not.toContain('.html');
  });

  it("sorts by the requesting user's rating (unrated always last)", async () => {
    const low = (
      await request(app).post('/api/games').set(auth(memberToken)).send({ title: 'Low' })
    ).body.id;
    const high = (
      await request(app).post('/api/games').set(auth(memberToken)).send({ title: 'High' })
    ).body.id;
    const unrated = (
      await request(app).post('/api/games').set(auth(memberToken)).send({ title: 'Unrated' })
    ).body.id;

    await request(app).put(`/api/games/${low}/rating`).set(auth(memberToken)).send({ rating: 3 });
    await request(app).put(`/api/games/${high}/rating`).set(auth(memberToken)).send({ rating: 9 });

    const desc = await request(app)
      .get('/api/games?sort=myRating&order=desc')
      .set(auth(memberToken));
    expect(desc.status).toBe(200);
    expect(desc.body.items.map((g: { id: number }) => g.id)).toEqual([high, low, unrated]);
    expect(desc.body.items[0].myRating).toBe(9);

    const asc = await request(app).get('/api/games?sort=myRating&order=asc').set(auth(memberToken));
    expect(asc.body.items.map((g: { id: number }) => g.id)).toEqual([low, high, unrated]);
  });

  it('paginates correctly under rating sort', async () => {
    const a = (await request(app).post('/api/games').set(auth(memberToken)).send({ title: 'A' }))
      .body.id;
    const b = (await request(app).post('/api/games').set(auth(memberToken)).send({ title: 'B' }))
      .body.id;
    const c = (await request(app).post('/api/games').set(auth(memberToken)).send({ title: 'C' }))
      .body.id;
    await request(app).put(`/api/games/${a}/rating`).set(auth(memberToken)).send({ rating: 5 });
    await request(app).put(`/api/games/${b}/rating`).set(auth(memberToken)).send({ rating: 7 });
    await request(app).put(`/api/games/${c}/rating`).set(auth(memberToken)).send({ rating: 3 });

    const p1 = await request(app)
      .get('/api/games?sort=myRating&order=desc&pageSize=2&page=1')
      .set(auth(memberToken));
    expect(p1.body.total).toBe(3);
    expect(p1.body.items.map((g: { id: number }) => g.id)).toEqual([b, a]);

    const p2 = await request(app)
      .get('/api/games?sort=myRating&order=desc&pageSize=2&page=2')
      .set(auth(memberToken));
    expect(p2.body.items.map((g: { id: number }) => g.id)).toEqual([c]);
  });

  it('sorts by BGG rating and rank with nulls last', async () => {
    const good = (
      await request(app).post('/api/games').set(auth(memberToken)).send({ title: 'Good' })
    ).body.id;
    const okay = (
      await request(app).post('/api/games').set(auth(memberToken)).send({ title: 'Okay' })
    ).body.id;
    const unsynced = (
      await request(app).post('/api/games').set(auth(memberToken)).send({ title: 'Unsynced' })
    ).body.id;

    // bggRating/bggRank are read-only over the API (set by BGG sync), so seed directly.
    await prisma.game.update({ where: { id: good }, data: { bggRating: 8.5, bggRank: 12 } });
    await prisma.game.update({ where: { id: okay }, data: { bggRating: 6.2, bggRank: 340 } });

    const byRating = await request(app)
      .get('/api/games?sort=bggRating&order=desc')
      .set(auth(memberToken));
    expect(byRating.status).toBe(200);
    expect(byRating.body.items.map((g: { id: number }) => g.id)).toEqual([good, okay, unsynced]);

    // Rank: lower is better, so ascending puts the top-ranked game first, unranked last.
    const byRank = await request(app)
      .get('/api/games?sort=bggRank&order=asc')
      .set(auth(memberToken));
    expect(byRank.body.items.map((g: { id: number }) => g.id)).toEqual([good, okay, unsynced]);
  });

  it('sorts by weight with nulls last', async () => {
    const heavy = (
      await request(app)
        .post('/api/games')
        .set(auth(memberToken))
        .send({ title: 'Heavy', weight: 4.5 })
    ).body.id;
    const light = (
      await request(app)
        .post('/api/games')
        .set(auth(memberToken))
        .send({ title: 'Light', weight: 1.8 })
    ).body.id;
    const noWeight = (
      await request(app).post('/api/games').set(auth(memberToken)).send({ title: 'NoWeight' })
    ).body.id;

    const desc = await request(app).get('/api/games?sort=weight&order=desc').set(auth(memberToken));
    expect(desc.status).toBe(200);
    expect(desc.body.items.map((g: { id: number }) => g.id)).toEqual([heavy, light, noWeight]);
  });

  it('deletes a category (admin only) and games keep surviving without the tag', async () => {
    const category = await prisma.category.create({ data: { name: 'Legacy' } });
    const gameId = (
      await request(app)
        .post('/api/games')
        .set(auth(memberToken))
        .send({ title: 'Tagged', categoryIds: [category.id] })
    ).body.id;

    const memberDelete = await request(app)
      .delete(`/api/categories/${category.id}`)
      .set(auth(memberToken));
    expect(memberDelete.status).toBe(403);

    const adminDelete = await request(app)
      .delete(`/api/categories/${category.id}`)
      .set(auth(adminToken));
    expect(adminDelete.status).toBe(204);

    const after = await request(app).get(`/api/games/${gameId}`).set(auth(memberToken));
    expect(after.status).toBe(200);
    expect(after.body.categories).toHaveLength(0);

    const missing = await request(app)
      .delete(`/api/categories/${category.id}`)
      .set(auth(adminToken));
    expect(missing.status).toBe(404);
  });

  it('rejects a disallowed upload type (svg)', async () => {
    const created = await request(app)
      .post('/api/games')
      .set(auth(memberToken))
      .send({ title: 'No SVG' });
    const res = await request(app)
      .post(`/api/games/${created.body.id}/image`)
      .set(auth(memberToken))
      .attach('image', Buffer.from('<svg/>'), {
        filename: 'x.svg',
        contentType: 'image/svg+xml',
      });
    // fileFilter drops the file → no file on the request → 400 from the route.
    expect(res.status).toBe(400);
  });
});
