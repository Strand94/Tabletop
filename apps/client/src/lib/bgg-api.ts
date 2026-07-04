import { useMutation, useQuery } from '@tanstack/react-query';
import type {
  BggCatalogHitDto,
  BggCatalogRefreshResultDto,
  BggImportInput,
  BggImportResultDto,
} from '@tabletop/shared';
import { apiFetch } from './api.js';
import { useDebouncedValue } from './use-debounced-value.js';

export { hitToFormPatch } from './bgg-autofill.js';

/** Search over the local BGG catalog, debounced internally (~300ms). Disabled for blank q. */
export function useBggCatalogSearch(q: string) {
  const debounced = useDebouncedValue(q, 300);

  return useQuery({
    queryKey: ['bgg-catalog', debounced],
    enabled: debounced.trim().length > 0,
    queryFn: () =>
      apiFetch<BggCatalogHitDto[]>(`/api/bgg/catalog/search?q=${encodeURIComponent(debounced)}`),
  });
}

export function useBggImport() {
  return useMutation({
    mutationFn: (input: BggImportInput) =>
      apiFetch<BggImportResultDto>('/api/bgg/catalog/import', {
        method: 'POST',
        body: input,
      }),
  });
}

/** Admin-only: download the latest snapshot and replace the local catalog. */
export function useBggCatalogRefresh() {
  return useMutation({
    mutationFn: () =>
      apiFetch<BggCatalogRefreshResultDto>('/api/bgg/catalog/refresh', { method: 'POST' }),
  });
}
