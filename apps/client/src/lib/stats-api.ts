import { useQuery } from '@tanstack/react-query';
import type { DashboardStats } from '@tabletop/shared';
import { apiFetch } from './api.js';

export function useDashboardStats() {
  return useQuery({
    queryKey: ['stats', 'dashboard'],
    queryFn: () => apiFetch<DashboardStats>('/api/stats/dashboard'),
  });
}
