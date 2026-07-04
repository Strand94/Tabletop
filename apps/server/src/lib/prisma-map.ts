import type { Prisma } from '../../generated/prisma/client.js';

/** Shared Decimal→number / Date→YYYY-MM-DD mappers for DTO conversion. */

export function decToNum(value: Prisma.Decimal | null): number | null {
  return value === null ? null : value.toNumber();
}

export function dateOnly(value: Date | null): string | null {
  return value === null ? null : value.toISOString().slice(0, 10);
}
