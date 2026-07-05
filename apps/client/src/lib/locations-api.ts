import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateLocationInput, LocationDto } from '@tabletop/shared';
import { apiFetch } from './api.js';

export function useLocations() {
  return useQuery({
    queryKey: ['locations'],
    queryFn: () => apiFetch<LocationDto[]>('/api/locations'),
  });
}

export function useCreateLocation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateLocationInput) =>
      apiFetch<LocationDto>('/api/locations', { method: 'POST', body: input }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['locations'] });
    },
  });
}

export function useDeleteLocation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => apiFetch<void>(`/api/locations/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['locations'] });
    },
  });
}
