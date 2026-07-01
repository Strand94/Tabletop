import { useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  GameRatingDto,
  SessionRatingDto,
  UpsertGameRatingInput,
  UpsertSessionRatingInput,
} from '@tabletop/shared';
import { apiFetch } from './api.js';

export function useRateGame(gameId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpsertGameRatingInput) =>
      apiFetch<GameRatingDto>(`/api/games/${gameId}/rating`, { method: 'PUT', body: input }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['game', gameId] });
      void qc.invalidateQueries({ queryKey: ['games'] });
    },
  });
}

export function useRateSession(sessionId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpsertSessionRatingInput) =>
      apiFetch<SessionRatingDto>(`/api/sessions/${sessionId}/rating`, {
        method: 'PUT',
        body: input,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['session', sessionId] });
      void qc.invalidateQueries({ queryKey: ['sessions'] });
    },
  });
}
