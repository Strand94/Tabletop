import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CreateSessionInput,
  LocationDto,
  SessionDto,
  UpdateSessionInput,
} from '@tabletop/shared';
import { apiFetch } from './api.js';

export interface SessionsFilter {
  game?: number;
  person?: number;
}

function queryString(filter: SessionsFilter): string {
  const params = new URLSearchParams();
  if (filter.game) params.set('game', String(filter.game));
  if (filter.person) params.set('person', String(filter.person));
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export function useSessions(filter: SessionsFilter = {}) {
  return useQuery({
    queryKey: ['sessions', filter],
    queryFn: () => apiFetch<SessionDto[]>(`/api/sessions${queryString(filter)}`),
  });
}

export function useSession(id: number) {
  return useQuery({
    queryKey: ['session', id],
    queryFn: () => apiFetch<SessionDto>(`/api/sessions/${id}`),
    enabled: Number.isFinite(id) && id > 0,
  });
}

export function useLocations() {
  return useQuery({
    queryKey: ['locations'],
    queryFn: () => apiFetch<LocationDto[]>('/api/locations'),
  });
}

function invalidateSessions(qc: ReturnType<typeof useQueryClient>): void {
  void qc.invalidateQueries({ queryKey: ['sessions'] });
  void qc.invalidateQueries({ queryKey: ['stats'] });
  void qc.invalidateQueries({ queryKey: ['expansions'] });
}

export function useCreateSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateSessionInput) =>
      apiFetch<SessionDto>('/api/sessions', { method: 'POST', body: input }),
    onSuccess: () => invalidateSessions(qc),
  });
}

export function useUpdateSession(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateSessionInput) =>
      apiFetch<SessionDto>(`/api/sessions/${id}`, { method: 'PATCH', body: input }),
    onSuccess: () => {
      invalidateSessions(qc);
      void qc.invalidateQueries({ queryKey: ['session', id] });
    },
  });
}

export function useDeleteSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => apiFetch<void>(`/api/sessions/${id}`, { method: 'DELETE' }),
    onSuccess: () => invalidateSessions(qc),
  });
}
