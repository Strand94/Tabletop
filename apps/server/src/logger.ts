import { pino } from 'pino';

/**
 * Structured application logger. Logs JSON in production (shipped to /app/logs
 * via container stdout redirection) and pretty-prints in development if
 * `pino-pretty` is available. Level controlled by LOG_LEVEL (default info).
 */
export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  redact: ['req.headers.authorization', 'password', 'passwordHash'],
});
