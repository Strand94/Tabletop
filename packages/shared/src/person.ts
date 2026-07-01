import { z } from 'zod';
import { Role } from './enums.js';

/**
 * Person create/update payloads. A Person is a player who may or may not have a
 * login account. `userId` is the authoritative link to a User (spec §3.5); set
 * it to attach an account, or null to detach.
 */
export const createPersonSchema = z.object({
  name: z.string().min(1).max(100),
  imagePath: z.string().max(500).nullish(),
  userId: z.number().int().positive().nullish(),
});
export type CreatePersonInput = z.infer<typeof createPersonSchema>;

export const updatePersonSchema = createPersonSchema.partial();
export type UpdatePersonInput = z.infer<typeof updatePersonSchema>;

/** The linked account summary, when a person has one. */
export interface LinkedAccount {
  userId: number;
  username: string;
  role: Role;
}

/** Person as returned by the API. */
export interface PersonDto {
  id: number;
  name: string;
  imagePath: string | null;
  account: LinkedAccount | null;
  createdAt: string;
}
