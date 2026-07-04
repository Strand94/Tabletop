import { useMutation, useQuery } from '@tanstack/react-query';
import type { BggCatalogHitDto, BggImportInput, BggImportResultDto } from '@tabletop/shared';
import { apiFetch } from './api.js';

/** Debounced-by-caller search over the local BGG catalog. Disabled for blank q. */
export function useBggCatalogSearch(q: string) {
  return useQuery({
    queryKey: ['bgg-catalog', q],
    enabled: q.trim().length > 0,
    queryFn: () =>
      apiFetch<BggCatalogHitDto[]>(`/api/bgg/catalog/search?q=${encodeURIComponent(q)}`),
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
