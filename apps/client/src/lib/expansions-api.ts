import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateExpansionInput, ExpansionDto, UpdateExpansionInput } from '@tabletop/shared';
import { apiFetch } from './api.js';

export function useExpansions(gameId: number) {
  return useQuery({
    queryKey: ['expansions', gameId],
    queryFn: () => apiFetch<ExpansionDto[]>(`/api/games/${gameId}/expansions`),
    enabled: Number.isFinite(gameId) && gameId > 0,
  });
}

export function useCreateExpansion(gameId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateExpansionInput) =>
      apiFetch<ExpansionDto>(`/api/games/${gameId}/expansions`, { method: 'POST', body: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['expansions', gameId] }),
  });
}

export function useUpdateExpansion(gameId: number, id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateExpansionInput) =>
      apiFetch<ExpansionDto>(`/api/expansions/${id}`, { method: 'PATCH', body: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['expansions', gameId] }),
  });
}

/** Upload a cover image for an expansion; returns the updated expansion with its new imagePath. */
export function uploadExpansionImage(id: number, file: File): Promise<ExpansionDto> {
  const body = new FormData();
  body.append('image', file);
  return apiFetch<ExpansionDto>(`/api/expansions/${id}/image`, { method: 'POST', body });
}

export function useDeleteExpansion(gameId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => apiFetch<void>(`/api/expansions/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['expansions', gameId] }),
  });
}
