import type { AdminCreateUserInput, UpdateUserInput, UserPublic } from '@tabletop/shared';
import type { User } from '../../../generated/prisma/client.js';
import { prisma } from '../../db.js';
import { HttpError } from '../../middleware/error.js';
import { hashPassword } from '../auth/service.js';

/** Public representation of a user (never includes the password hash). */
function toPublic(user: User): UserPublic {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
    locale: user.locale,
  };
}

/** All users, ordered by id, mapped to their public shape. */
export async function listUsers(): Promise<UserPublic[]> {
  const users = await prisma.user.findMany({ orderBy: { id: 'asc' } });
  return users.map(toPublic);
}

/**
 * Admin-driven user creation. The role is explicit (unlike registration).
 * Duplicate username → 409. Locale defaults to the configured default.
 */
export async function createUser(
  input: AdminCreateUserInput,
  defaultLocale: string,
): Promise<UserPublic> {
  const existing = await prisma.user.findUnique({ where: { username: input.username } });
  if (existing) throw new HttpError(409, 'Username already taken');

  const user = await prisma.user.create({
    data: {
      username: input.username,
      email: input.email ?? null,
      passwordHash: await hashPassword(input.password),
      role: input.role,
      locale: input.locale ?? defaultLocale,
    },
  });
  return toPublic(user);
}

/**
 * Admin-driven update: change role and/or reset the password. Guards against
 * demoting the last admin. Bumps tokenVersion when the password or role changes
 * so outstanding refresh tokens are revoked.
 */
export async function updateUser(
  id: number,
  input: UpdateUserInput,
  _actingUserId: number,
): Promise<UserPublic> {
  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) throw new HttpError(404, 'User not found');

  const demoting = input.role === 'MEMBER' && target.role === 'ADMIN';
  if (demoting) {
    const adminCount = await prisma.user.count({ where: { role: 'ADMIN' } });
    if (adminCount <= 1) throw new HttpError(409, 'Cannot demote the last admin');
  }

  const roleChanged = input.role !== undefined && input.role !== target.role;
  const passwordChanged = input.password !== undefined;

  const user = await prisma.user.update({
    where: { id },
    data: {
      role: input.role ?? undefined,
      passwordHash: passwordChanged ? await hashPassword(input.password!) : undefined,
      tokenVersion: roleChanged || passwordChanged ? { increment: 1 } : undefined,
    },
  });
  return toPublic(user);
}

/**
 * Delete a user. Refuses to delete yourself (avoids locking out mid-session) or
 * the last remaining admin.
 */
export async function deleteUser(id: number, actingUserId: number): Promise<void> {
  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) throw new HttpError(404, 'User not found');

  if (id === actingUserId) throw new HttpError(409, 'Cannot delete your own account');

  if (target.role === 'ADMIN') {
    const adminCount = await prisma.user.count({ where: { role: 'ADMIN' } });
    if (adminCount <= 1) throw new HttpError(409, 'Cannot delete the last admin');
  }

  await prisma.user.delete({ where: { id } });
}
