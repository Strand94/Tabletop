/**
 * @tabletop/shared — single source of truth for API contracts.
 *
 * zod schemas and their inferred types live here and are imported by both the
 * Express server (for request/response validation) and the React client (for
 * typed API calls), so the contract cannot drift between the two.
 */

export * from './enums.js';
export * from './auth.js';
export * from './pagination.js';
export * from './game.js';
export * from './expansion.js';
export * from './person.js';
export * from './session.js';
export * from './rating.js';
export * from './stats.js';

/** Library marker (kept for the smoke test). */
export const SHARED_PACKAGE = '@tabletop/shared';
