import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { prisma } from '../src/db.js';
import { createApp } from '../src/app.js';
import { tokenServiceFromConfig } from '../src/modules/auth/routes.js';
import {
  currentSnapshotDate,
  getCatalogRatings,
  replaceCatalog,
  searchCatalog,
} from '../src/modules/bgg/catalog-service.js';
import type { CatalogRow } from '../src/modules/bgg/csv.js';
import { applyMigrations, resetDb } from './helpers/db.js';

const tokens = tokenServiceFromConfig({
  JWT_SECRET: 'access-secret-access-secret-1234567890',
  JWT_REFRESH_SECRET: 'refresh-secret-refresh-secret-1234567890',
});

describe.skipIf(process.env.RUN_DB_TESTS !== '1')('bgg_catalog table', () => {
  beforeEach(async () => {
    applyMigrations();
    await resetDb();
  });
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('stores and reads a catalog entry', async () => {
    await prisma.bggCatalogEntry.create({
      data: {
        bggId: 224517,
        name: 'Brass: Birmingham',
        year: 2018,
        rank: 1,
        average: 8.56,
        bayesAverage: 8.393,
        usersRated: 59007,
        thumbnail: 'https://cf.geekdo-images.com/x.jpg',
        snapshotDate: new Date('2026-06-29'),
      },
    });
    const row = await prisma.bggCatalogEntry.findUnique({ where: { bggId: 224517 } });
    expect(row?.name).toBe('Brass: Birmingham');
    expect(row?.average?.toNumber()).toBeCloseTo(8.56);
  });
});

describe.skipIf(process.env.RUN_DB_TESTS !== '1')('catalog-service', () => {
  beforeEach(async () => {
    applyMigrations();
    await resetDb();
  });

  const rows: CatalogRow[] = [
    {
      bggId: 1,
      name: 'Ark Nova',
      year: 2021,
      rank: 2,
      average: 8.54,
      bayesAverage: 8.35,
      usersRated: 100,
      thumbnail: 't1',
    },
    {
      bggId: 2,
      name: 'Arkham Horror',
      year: 2016,
      rank: 50,
      average: 7.1,
      bayesAverage: 6.9,
      usersRated: 20,
      thumbnail: 't2',
    },
    {
      bggId: 3,
      name: 'Brass',
      year: 2018,
      rank: 1,
      average: 8.6,
      bayesAverage: 8.4,
      usersRated: 200,
      thumbnail: 't3',
    },
  ];

  it('replaces the catalog and reports the snapshot date', async () => {
    expect(await currentSnapshotDate()).toBeNull();
    const n = await replaceCatalog(rows, '2026-06-29');
    expect(n).toBe(3);
    expect(await currentSnapshotDate()).toBe('2026-06-29');

    // A second replace with fewer rows fully swaps the contents.
    await replaceCatalog([rows[0]!], '2026-06-30');
    expect(await currentSnapshotDate()).toBe('2026-06-30');
    const all = await searchCatalog('a', 25);
    expect(all.map((h) => h.bggId)).toEqual([1]);
  });

  it('searches by name (rank order) and by numeric id', async () => {
    await replaceCatalog(rows, '2026-06-29');
    const byName = await searchCatalog('ark', 10);
    expect(byName.map((h) => h.bggId)).toEqual([1, 2]); // rank 2 before rank 50
    const byId = await searchCatalog('3', 10);
    expect(byId[0]).toMatchObject({ bggId: 3, name: 'Brass', average: 8.6 });
  });

  it('returns ratings for the sync provider', async () => {
    await replaceCatalog(rows, '2026-06-29');
    expect(await getCatalogRatings([3, 999])).toEqual([{ bggId: 3, rating: 8.6, rank: 1 }]);
  });
});

describe.skipIf(process.env.RUN_DB_TESTS !== '1')('GET /api/bgg/catalog/search', () => {
  let app: Express;
  let token: string;
  beforeEach(async () => {
    applyMigrations();
    await resetDb();
    app = createApp({ tokens, defaultLocale: 'en', defaultCurrency: 'NOK' });
    await request(app)
      .post('/api/auth/register')
      .send({ username: 'maya', password: 'supersecret' });
    const login = await request(app)
      .post('/api/auth/login')
      .send({ username: 'maya', password: 'supersecret' });
    token = login.body.accessToken;
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
          thumbnail: 't1',
        },
      ],
      '2026-06-29',
    );
  });

  it('requires auth', async () => {
    await request(app).get('/api/bgg/catalog/search?q=ark').expect(401);
  });

  it('returns hits with every field', async () => {
    const res = await request(app)
      .get('/api/bgg/catalog/search?q=ark')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body[0]).toMatchObject({
      bggId: 1,
      name: 'Ark Nova',
      average: 8.54,
      thumbnail: 't1',
    });
  });

  it('rejects an empty query', async () => {
    await request(app)
      .get('/api/bgg/catalog/search?q=')
      .set('Authorization', `Bearer ${token}`)
      .expect(400);
  });
});

describe.skipIf(process.env.RUN_DB_TESTS !== '1')('POST /api/bgg/catalog/import', () => {
  let app: Express;
  let token: string;
  beforeEach(async () => {
    applyMigrations();
    await resetDb();
    app = createApp({ tokens, defaultLocale: 'en', defaultCurrency: 'NOK' });
    await request(app)
      .post('/api/auth/register')
      .send({ username: 'maya', password: 'supersecret' });
    token = (
      await request(app).post('/api/auth/login').send({ username: 'maya', password: 'supersecret' })
    ).body.accessToken;
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
          thumbnail: 'https://x/t1.jpg',
        },
        {
          bggId: 2,
          name: 'Brass',
          year: 2018,
          rank: 1,
          average: 8.6,
          bayesAverage: 8.4,
          usersRated: 200,
          thumbnail: 'https://x/t2.jpg',
        },
      ],
      '2026-06-29',
    );
  });

  it('creates games from catalog rows and maps fields', async () => {
    const res = await request(app)
      .post('/api/bgg/catalog/import')
      .set('Authorization', `Bearer ${token}`)
      .send({ bggIds: [1, 2], collectionStatus: 'WISHLIST' })
      .expect(201);
    expect(res.body).toEqual({ created: 2, skipped: 0 });
    const list = await request(app).get('/api/games?q=Ark').set('Authorization', `Bearer ${token}`);
    expect(list.body.items[0]).toMatchObject({
      title: 'Ark Nova',
      releaseYear: 2021,
      bggId: 1,
      bggRating: 8.54,
      bggRank: 2,
      imagePath: 'https://x/t1.jpg',
      collectionStatus: 'WISHLIST',
    });
  });

  it('skips ids already in the collection or absent from the catalog', async () => {
    await request(app)
      .post('/api/bgg/catalog/import')
      .set('Authorization', `Bearer ${token}`)
      .send({ bggIds: [1] })
      .expect(201);
    const res = await request(app)
      .post('/api/bgg/catalog/import')
      .set('Authorization', `Bearer ${token}`)
      .send({ bggIds: [1, 2, 999] })
      .expect(201);
    expect(res.body).toEqual({ created: 1, skipped: 2 });
  });
});

describe.skipIf(process.env.RUN_DB_TESTS !== '1')('POST /api/bgg/catalog/refresh', () => {
  let app: Express;
  let memberToken: string;
  beforeEach(async () => {
    applyMigrations();
    await resetDb();
    app = createApp({ tokens, defaultLocale: 'en', defaultCurrency: 'NOK' });
    // First registered user becomes ADMIN; register a second user for MEMBER.
    await request(app)
      .post('/api/auth/register')
      .send({ username: 'maya', password: 'supersecret' });
    const adminToken = (
      await request(app).post('/api/auth/login').send({ username: 'maya', password: 'supersecret' })
    ).body.accessToken;
    await request(app)
      .post('/api/auth/register')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ username: 'theo', password: 'anothersecret' });
    memberToken = (
      await request(app)
        .post('/api/auth/login')
        .send({ username: 'theo', password: 'anothersecret' })
    ).body.accessToken;
  });

  it('rejects a non-admin member with 403', async () => {
    await request(app)
      .post('/api/bgg/catalog/refresh')
      .set('Authorization', `Bearer ${memberToken}`)
      .expect(403);
  });
});
