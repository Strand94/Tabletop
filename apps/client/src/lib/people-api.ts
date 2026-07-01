import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreatePersonInput, PersonDto, UpdatePersonInput } from '@tabletop/shared';
import { apiFetch } from './api.js';

export function usePeople() {
  return useQuery({
    queryKey: ['people'],
    queryFn: () => apiFetch<PersonDto[]>('/api/people'),
  });
}

export function useCreatePerson() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreatePersonInput) =>
      apiFetch<PersonDto>('/api/people', { method: 'POST', body: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['people'] }),
  });
}

export function useUpdatePerson(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdatePersonInput) =>
      apiFetch<PersonDto>(`/api/people/${id}`, { method: 'PATCH', body: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['people'] }),
  });
}

export function useDeletePerson() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => apiFetch<void>(`/api/people/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['people'] }),
  });
}
