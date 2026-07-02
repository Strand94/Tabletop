import { z } from 'zod';

/** A page of results plus the total count for building pagers. */
export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

/** Shared page/pageSize query params. `pageSize` is capped to protect the server. */
export function paginationFields(defaultPageSize: number) {
  return {
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(defaultPageSize),
  };
}
