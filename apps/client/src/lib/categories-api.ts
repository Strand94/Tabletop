import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { CategoryDto } from '@tabletop/shared';
import { apiFetch } from './api.js';

// The `useCategories` query hook lives in games-api.ts; re-export it here so the
// taxonomy management UI has a single import surface without breaking existing callers.
export { useCategories } from './games-api.js';

export function useCreateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) =>
      apiFetch<CategoryDto>('/api/categories', { method: 'POST', body: { name } }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['categories'] });
    },
  });
}

export function useDeleteCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => apiFetch<void>(`/api/categories/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['categories'] });
    },
  });
}
