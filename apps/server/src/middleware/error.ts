import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { logger } from '../logger.js';

/**
 * Error thrown by services/controllers to signal an HTTP status. Keeps the
 * service layer free of Express types while still controlling the response.
 */
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

/** 404 handler for unmatched /api routes. */
export function notFound(_req: Request, res: Response): void {
  res.status(404).json({ error: 'Not found' });
}

/**
 * Central error middleware. Maps known error shapes to clean JSON responses and
 * never leaks internals on unexpected errors.
 */
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof ZodError) {
    res.status(400).json({ error: 'Validation failed', details: err.issues });
    return;
  }
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message, details: err.details });
    return;
  }
  logger.error({ err }, 'Unhandled error');
  res.status(500).json({ error: 'Internal server error' });
}
