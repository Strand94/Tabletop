import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AdminCreateUserInput, UpdateUserInput, UserPublic } from '@tabletop/shared';
import { apiFetch } from './api.js';

export function useUsers() {
  return useQuery({
    queryKey: ['users'],
    queryFn: () => apiFetch<UserPublic[]>('/api/users'),
  });
}

export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: AdminCreateUserInput) =>
      apiFetch<UserPublic>('/api/users', { method: 'POST', body: input }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['users'] });
    },
  });
}

export function useUpdateUser(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateUserInput) =>
      apiFetch<UserPublic>(`/api/users/${id}`, { method: 'PATCH', body: input }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['users'] });
    },
  });
}

export function useDeleteUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => apiFetch<void>(`/api/users/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['users'] });
    },
  });
}
