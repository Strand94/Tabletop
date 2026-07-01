import { existsSync } from 'node:fs';
import path from 'node:path';
import express, { type Express, Router } from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { logger } from './logger.js';
import { errorHandler, notFound } from './middleware/error.js';
import { createAuthRouter } from './modules/auth/routes.js';
import { createCategoriesRouter, createGamesRouter } from './modules/games/routes.js';
import { createExpansionsRouter } from './modules/expansions/routes.js';
import { createStatsRouter } from './modules/stats/routes.js';
import { IMAGES_DIR } from './modules/uploads/image.js';
import type { TokenService } from './modules/auth/service.js';

/** Dependencies feature routers need. Omitted in unit tests that only hit /health. */
export interface AppDeps {
  tokens: TokenService;
  defaultLocale: string;
  defaultCurrency: string;
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

  app.use(helmet());
  app.use(express.json());
  app.use(pinoHttp({ logger }));

  const api = Router();
  api.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  if (deps) {
    api.use('/auth', createAuthRouter(deps));
    api.use(
      '/games',
      createGamesRouter({ tokens: deps.tokens, defaultCurrency: deps.defaultCurrency }),
    );
    api.use('/categories', createCategoriesRouter(deps.tokens));
    api.use(createExpansionsRouter(deps.tokens));
    api.use(
      '/stats',
      createStatsRouter({ tokens: deps.tokens, defaultCurrency: deps.defaultCurrency }),
    );
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
