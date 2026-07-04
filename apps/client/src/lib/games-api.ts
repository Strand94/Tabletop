import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CategoryDto,
  CreateGameInput,
  GameDto,
  Paginated,
  UpdateGameInput,
} from '@tabletop/shared';
import { apiFetch } from './api.js';

export interface GamesFilter {
  status?: 'OWNED' | 'WISHLIST';
  category?: number;
  q?: string;
  sort?: string;
  order?: 'asc' | 'desc';
  neverPlayed?: boolean;
  page?: number;
  pageSize?: number;
}

function gamesQueryString(filter: GamesFilter): string {
  const params = new URLSearchParams();
  if (filter.status) params.set('status', filter.status);
  if (filter.category) params.set('category', String(filter.category));
  if (filter.q) params.set('q', filter.q);
  if (filter.sort) params.set('sort', filter.sort);
  if (filter.order) params.set('order', filter.order);
  if (filter.neverPlayed) params.set('neverPlayed', 'true');
  if (filter.page) params.set('page', String(filter.page));
  if (filter.pageSize) params.set('pageSize', String(filter.pageSize));
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export function useGames(filter: GamesFilter = {}) {
  return useQuery({
    queryKey: ['games', filter],
    queryFn: () => apiFetch<Paginated<GameDto>>(`/api/games${gamesQueryString(filter)}`),
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

export function useDeleteGame() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => apiFetch<void>(`/api/games/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['games'] });
      void qc.invalidateQueries({ queryKey: ['stats'] });
    },
  });
}

/** Upload a cover image for an existing game (multipart). Returns the updated game. */
export function useUploadGameImage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, file }: { id: number; file: File }) => {
      const body = new FormData();
      body.append('image', file);
      return apiFetch<GameDto>(`/api/games/${id}/image`, { method: 'POST', body });
    },
    onSuccess: (game) => {
      void qc.invalidateQueries({ queryKey: ['games'] });
      void qc.invalidateQueries({ queryKey: ['game', game.id] });
    },
  });
}

/** Upload a cover to a game by id, outside the hook lifecycle (used post-create). */
export function uploadGameImage(id: number, file: File): Promise<GameDto> {
  const body = new FormData();
  body.append('image', file);
  return apiFetch<GameDto>(`/api/games/${id}/image`, { method: 'POST', body });
}
