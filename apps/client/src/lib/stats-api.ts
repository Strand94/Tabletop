import { useQuery } from '@tanstack/react-query';
import type { DashboardStats, GameStats, PlayerStats } from '@tabletop/shared';
import { apiFetch } from './api.js';

export function useDashboardStats() {
  return useQuery({
    queryKey: ['stats', 'dashboard'],
    queryFn: () => apiFetch<DashboardStats>('/api/stats/dashboard'),
  });
}

export function usePlayerStats() {
  return useQuery({
    queryKey: ['stats', 'players'],
    queryFn: () => apiFetch<PlayerStats[]>('/api/stats/players'),
  });
}

export function useGameStats(gameId: number) {
  return useQuery({
    queryKey: ['stats', 'game', gameId],
    queryFn: () => apiFetch<GameStats>(`/api/stats/games/${gameId}`),
    enabled: Number.isFinite(gameId) && gameId > 0,
  });
}
