import express, { type Express, Router } from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { logger } from './logger.js';
import { errorHandler, notFound } from './middleware/error.js';

/**
 * Build the Express application. Pure factory with no side effects (no DB
 * connection, no `listen`) so tests can import and exercise it directly.
 * Feature routers are mounted under `/api` as they are added.
 */
export function createApp(): Express {
  const app = express();

  app.use(helmet());
  app.use(express.json());
  app.use(pinoHttp({ logger }));

  const api = Router();
  api.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  // Future feature routers mount here: api.use('/auth', authRouter), etc.

  app.use('/api', api);
  app.use('/api', notFound);
  app.use(errorHandler);

  return app;
}
