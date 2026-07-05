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

/** Admin-driven user creation. Unlike registration, the role is explicit. */
export const adminCreateUserSchema = z.object({
  username: z.string().min(3).max(50),
  password: z.string().min(8).max(200),
  role: Role,
  email: z.email().optional(),
  locale: z.string().min(2).max(10).optional(),
});
export type AdminCreateUserInput = z.infer<typeof adminCreateUserSchema>;

/** Admin-driven user update: change role and/or reset the password (at least one). */
export const updateUserSchema = z
  .object({
    role: Role.optional(),
    password: z.string().min(8).max(200).optional(),
  })
  .refine((v) => v.role !== undefined || v.password !== undefined, {
    message: 'Provide a role or a password',
  });
export type UpdateUserInput = z.infer<typeof updateUserSchema>;

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

/** First-run setup probe: true when no user account exists yet. */
export const setupStatusSchema = z.object({
  needsSetup: z.boolean(),
});
export type SetupStatus = z.infer<typeof setupStatusSchema>;

/** Decoded JWT claims we put on the access/refresh tokens. */
export const tokenPayloadSchema = z.object({
  sub: z.number().int().positive(),
  username: z.string().min(1),
  role: Role,
  /** Snapshot of the user's tokenVersion; a mismatch on refresh means revoked. */
  tokenVersion: z.number().int().nonnegative(),
});
export type TokenPayload = z.infer<typeof tokenPayloadSchema>;
