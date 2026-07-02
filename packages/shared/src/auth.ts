import { z } from 'zod';
import { Role } from './enums.js';

/** Registration payload. Username + password required; email + locale optional. */
export const registerSchema = z.object({
  username: z.string().min(3).max(50),
  password: z.string().min(8).max(200),
  email: z.email().optional(),
  locale: z.string().min(2).max(10).optional(),
});
export type RegisterInput = z.infer<typeof registerSchema>;

/** Login payload. */
export const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});
export type LoginInput = z.infer<typeof loginSchema>;

/** Refresh payload — the long-lived refresh token. */
export const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});
export type RefreshInput = z.infer<typeof refreshSchema>;

/** Update the current user's own profile (currently just preferred locale). */
export const updateMeSchema = z.object({
  locale: z.string().min(2).max(10),
});
export type UpdateMeInput = z.infer<typeof updateMeSchema>;

/** Public representation of a user (never includes the password hash). */
export const userPublicSchema = z.object({
  id: z.number().int(),
  username: z.string(),
  email: z.string().nullable(),
  role: Role,
  locale: z.string(),
});
export type UserPublic = z.infer<typeof userPublicSchema>;

/** Body returned by login/refresh. */
export const authTokensSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  user: userPublicSchema,
});
export type AuthTokens = z.infer<typeof authTokensSchema>;

/** Decoded JWT claims we put on the access/refresh tokens. */
export const tokenPayloadSchema = z.object({
  sub: z.number().int().positive(),
  username: z.string().min(1),
  role: Role,
});
export type TokenPayload = z.infer<typeof tokenPayloadSchema>;
