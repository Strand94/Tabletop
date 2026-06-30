/**
 * @tabletop/shared — single source of truth for API contracts.
 *
 * zod schemas and their inferred types live here and are imported by both the
 * Express server (for request/response validation) and the React client (for
 * typed API calls), so the contract cannot drift between the two.
 *
 * Modules (added as features land): enums, auth, game, common.
 */

/** Library version marker; replaced by real exports as schemas are added. */
export const SHARED_PACKAGE = '@tabletop/shared';
