import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CategoryDto, CreateGameInput, GameDto, UpdateGameInput } from '@tabletop/shared';
import { apiFetch } from './api.js';

export interface GamesFilter {
  status?: 'OWNED' | 'WISHLIST';
  category?: number;
  q?: string;
  sort?: string;
  order?: 'asc' | 'desc';
  neverPlayed?: boolean;
}

function gamesQueryString(filter: GamesFilter): string {
  const params = new URLSearchParams();
  if (filter.status) params.set('status', filter.status);
  if (filter.category) params.set('category', String(filter.category));
  if (filter.q) params.set('q', filter.q);
  if (filter.sort) params.set('sort', filter.sort);
  if (filter.order) params.set('order', filter.order);
  if (filter.neverPlayed) params.set('neverPlayed', 'true');
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export function useGames(filter: GamesFilter = {}) {
  return useQuery({
    queryKey: ['games', filter],
    queryFn: () => apiFetch<GameDto[]>(`/api/games${gamesQueryString(filter)}`),
  });
}

export function useGame(id: number) {
  return useQuery({
    queryKey: ['game', id],
    queryFn: () => apiFetch<GameDto>(`/api/games/${id}`),
  });
}

export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: () => apiFetch<CategoryDto[]>('/api/categories'),
  });
}

export function useCreateGame() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateGameInput) =>
      apiFetch<GameDto>('/api/games', { method: 'POST', body: input }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['games'] });
      void qc.invalidateQueries({ queryKey: ['stats'] });
    },
  });
}

export function useUpdateGame(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateGameInput) =>
      apiFetch<GameDto>(`/api/games/${id}`, { method: 'PATCH', body: input }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['games'] });
      void qc.invalidateQueries({ queryKey: ['game', id] });
    },
  });
}
