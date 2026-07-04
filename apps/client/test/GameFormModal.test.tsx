import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { GameDto } from '@tabletop/shared';
import { GameFormModal } from '../src/components/GameFormModal.js';

function jsonResponse(body: unknown) {
  return {
    ok: true,
    status: 200,
    headers: new Headers({ 'content-type': 'application/json' }),
    json: async () => body,
  };
}

/** Stub fetch: categories GET returns [], any POST/PATCH returns a stub game. */
function stubFetch() {
  const mock = vi.fn(async (url: string, _init?: RequestInit) => {
    if (String(url).includes('/api/categories')) return jsonResponse([]);
    return jsonResponse({ id: 1, bggId: 13 });
  });
  vi.stubGlobal('fetch', mock);
  return mock;
}

function renderModal(game?: GameDto) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <GameFormModal onClose={() => {}} game={game} />
    </QueryClientProvider>,
  );
}

/** Find the parsed JSON body of the first mutating (non-GET) fetch call. */
function mutatingBody(mock: ReturnType<typeof stubFetch>): Record<string, unknown> {
  const call = mock.mock.calls.find(([, init]) => init?.method && init.method !== 'GET');
  if (!call) throw new Error('no mutating fetch call recorded');
  return JSON.parse((call[1] as RequestInit).body as string);
}

describe('GameFormModal — bggId', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('sends bggId in the create payload when the field is filled', async () => {
    const mock = stubFetch();
    renderModal();

    fireEvent.change(screen.getByLabelText('Tittel'), { target: { value: 'Catan' } });
    fireEvent.change(screen.getByLabelText('BGG-ID'), { target: { value: '13' } });
    fireEvent.click(screen.getByText('Lagre'));

    await waitFor(() => expect(mock.mock.calls.some(([, i]) => i?.method === 'POST')).toBe(true));
    expect(mutatingBody(mock)).toMatchObject({ title: 'Catan', bggId: 13 });
  });

  it('sends bggId as null when the field is cleared on edit', async () => {
    const mock = stubFetch();
    const game = { id: 1, title: 'Catan', bggId: 13, categories: [] } as unknown as GameDto;
    renderModal(game);

    expect((screen.getByLabelText('BGG-ID') as HTMLInputElement).value).toBe('13');
    fireEvent.change(screen.getByLabelText('BGG-ID'), { target: { value: '' } });
    fireEvent.click(screen.getByText('Lagre'));

    await waitFor(() => expect(mock.mock.calls.some(([, i]) => i?.method === 'PATCH')).toBe(true));
    // Clearing an optional field now sends an explicit null so the server unsets it.
    expect(mutatingBody(mock)).toMatchObject({ bggId: null });
  });
});
