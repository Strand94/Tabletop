import { existsSync } from 'node:fs';
import path from 'node:path';
import express, { type Express, Router } from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { pinoHttp } from 'pino-http';
import { logger } from './logger.js';
import { errorHandler, notFound } from './middleware/error.js';
import { createAuthRouter } from './modules/auth/routes.js';
import { createCategoriesRouter, createGamesRouter } from './modules/games/routes.js';
import { createExpansionsRouter } from './modules/expansions/routes.js';
import { createPeopleRouter } from './modules/people/routes.js';
import { createLocationsRouter, createSessionsRouter } from './modules/sessions/routes.js';
import { createStatsRouter } from './modules/stats/routes.js';
import { createBggRouter } from './modules/bgg/routes.js';
import { createExportRouter } from './modules/export/routes.js';
import { IMAGES_DIR } from './modules/uploads/image.js';
import type { TokenService } from './modules/auth/service.js';

/** Dependencies feature routers need. Omitted in unit tests that only hit /health. */
export interface AppDeps {
  tokens: TokenService;
  defaultLocale: string;
  defaultCurrency: string;
  bgg?: {
    enabled: boolean;
    provider: string;
    apiToken: string | undefined;
  };
}

/**
 * Resolve where the built client lives. In containers this is set explicitly via
 * CLIENT_DIST; in local builds it defaults to the workspace dist folder. Returns
 * null when no build is present (e.g. during tests) so static serving is skipped.
 */
function resolveClientDist(): string | null {
  const candidate = process.env.CLIENT_DIST ?? path.resolve(process.cwd(), 'apps/client/dist');
  return existsSync(path.join(candidate, 'index.html')) ? candidate : null;
}

/**
 * Build the Express application. Pure factory with no side effects (no DB
 * connection, no `listen`) so tests can import and exercise it directly.
 * Feature routers are mounted under `/api` as they are added.
 */
export function createApp(deps?: AppDeps): Express {
  const app = express();

  // Helmet with a CSP that permits the Google Fonts + Material Symbols the
  // client loads, and inline style attributes (React uses `style={}` widely).
  // Everything else stays same-origin. Self-hosting the fonts later would let
  // us drop the font-CDN allowances entirely.
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          'default-src': ["'self'"],
          'script-src': ["'self'"],
          'style-src': ["'self'", 'https://fonts.googleapis.com', "'unsafe-inline'"],
          'font-src': ["'self'", 'https://fonts.gstatic.com'],
          'img-src': ["'self'", 'data:'],
          'connect-src': ["'self'"],
          'object-src': ["'none'"],
          'base-uri': ["'self'"],
          'frame-ancestors': ["'self'"],
        },
      },
    }),
  );
  app.use(express.json());
  app.use(pinoHttp({ logger }));

  const api = Router();
  api.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  // Throttle auth endpoints against brute-force/credential-stuffing. Trust the
  // proxy count from the runtime (behind the compose network / reverse proxy).
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 50,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: 'Too many attempts, please try again later' },
  });

  if (deps) {
    api.use('/auth', authLimiter, createAuthRouter(deps));
    api.use(
      '/games',
      createGamesRouter({ tokens: deps.tokens, defaultCurrency: deps.defaultCurrency }),
    );
    api.use('/categories', createCategoriesRouter(deps.tokens));
    api.use(createExpansionsRouter(deps.tokens));
    api.use('/people', createPeopleRouter(deps.tokens));
    api.use('/sessions', createSessionsRouter(deps.tokens));
    api.use('/locations', createLocationsRouter(deps.tokens));
    api.use(
      '/stats',
      createStatsRouter({ tokens: deps.tokens, defaultCurrency: deps.defaultCurrency }),
    );
    api.use(
      '/sync',
      createBggRouter({
        tokens: deps.tokens,
        enabled: deps.bgg?.enabled ?? false,
        provider: deps.bgg?.provider ?? 'csv',
        apiToken: deps.bgg?.apiToken,
      }),
    );
    api.use('/export', createExportRouter(deps.tokens));
  }

  app.use('/api', api);

  // Serve uploaded images from the mounted volume.
  app.use('/images', express.static(IMAGES_DIR));
  app.use('/api', notFound);

  // Serve the built client (if present) with SPA fallback for non-/api routes.
  const clientDist = resolveClientDist();
  if (clientDist) {
    app.use(express.static(clientDist));
    app.get(/^(?!\/api).*/, (_req, res) => {
      res.sendFile(path.join(clientDist, 'index.html'));
    });
  }

  app.use(errorHandler);

  return app;
}
