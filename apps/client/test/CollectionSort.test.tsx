import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { LocaleProvider } from '../src/lib/i18n.js';
import { Collection } from '../src/pages/Collection.js';

vi.mock('../src/lib/auth.js', () => ({
  useAuth: () => ({ user: { id: 1, username: 'maya', role: 'ADMIN' }, loading: false }),
}));

function renderCollection(onUrl: (url: string) => void) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      onUrl(String(url));
      const body = String(url).includes('/api/categories')
        ? []
        : { items: [], page: 1, pageSize: 24, total: 0 };
      return {
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => body,
      };
    }),
  );
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <LocaleProvider>
        <MemoryRouter>
          <Collection />
        </MemoryRouter>
      </LocaleProvider>
    </QueryClientProvider>,
  );
}

describe('Collection — sort control', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('offers a "My rating" option and drives sort=myRating&order=desc', async () => {
    const urls: string[] = [];
    renderCollection((u) => urls.push(u));

    // Norwegian is the default locale.
    const select = screen.getByRole('combobox', { name: 'Sorter' });
    expect(screen.getByRole('option', { name: 'Min vurdering' })).toBeInTheDocument();

    fireEvent.change(select, { target: { value: 'myRating' } });

    await waitFor(() => {
      expect(urls.some((u) => u.includes('sort=myRating') && u.includes('order=desc'))).toBe(true);
    });
  });
});
