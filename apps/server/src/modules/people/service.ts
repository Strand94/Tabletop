import type { Prisma } from '@prisma/client';
import type { CreatePersonInput, PersonDto, UpdatePersonInput } from '@tabletop/shared';
import { prisma } from '../../db.js';
import { HttpError } from '../../middleware/error.js';

const personInclude = {
  user: { select: { id: true, username: true, role: true } },
} satisfies Prisma.PersonInclude;

type PersonWithUser = Prisma.PersonGetPayload<{ include: typeof personInclude }>;

export function toPersonDto(person: PersonWithUser): PersonDto {
  return {
    id: person.id,
    name: person.name,
    imagePath: person.imagePath,
    account: person.user
      ? { userId: person.user.id, username: person.user.username, role: person.user.role }
      : null,
    createdAt: person.createdAt.toISOString(),
  };
}

/**
 * Validate that a userId (if provided) references an existing user that is not
 * already linked to a different person. Person.userId is unique, so linking a
 * taken account would otherwise fail with a raw DB error.
 */
async function assertUserLinkable(userId: number, exceptPersonId?: number): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!user) throw new HttpError(400, 'Linked user does not exist');
  const existing = await prisma.person.findUnique({
    where: { userId },
    select: { id: true },
  });
  if (existing && existing.id !== exceptPersonId) {
    throw new HttpError(409, 'That account is already linked to another person');
  }
}

export async function listPeople(): Promise<PersonDto[]> {
  const people = await prisma.person.findMany({
    include: personInclude,
    orderBy: { name: 'asc' },
  });
  return people.map(toPersonDto);
}

export async function createPerson(input: CreatePersonInput): Promise<PersonDto> {
  if (input.userId != null) await assertUserLinkable(input.userId);
  const person = await prisma.person.create({
    data: {
      name: input.name,
      imagePath: input.imagePath ?? undefined,
      userId: input.userId ?? undefined,
    },
    include: personInclude,
  });
  return toPersonDto(person);
}

export async function updatePerson(id: number, input: UpdatePersonInput): Promise<PersonDto> {
  await ensureExists(id);
  if (input.userId != null) await assertUserLinkable(input.userId, id);
  const person = await prisma.person.update({
    where: { id },
    data: {
      name: input.name ?? undefined,
      imagePath: input.imagePath === undefined ? undefined : input.imagePath,
      // Allow explicit null to detach the account.
      userId: input.userId === undefined ? undefined : input.userId,
    },
    include: personInclude,
  });
  return toPersonDto(person);
}

export async function deletePerson(id: number): Promise<void> {
  await ensureExists(id);
  await prisma.person.delete({ where: { id } });
}

async function ensureExists(id: number): Promise<void> {
  const person = await prisma.person.findUnique({ where: { id }, select: { id: true } });
  if (!person) throw new HttpError(404, 'Person not found');
}
