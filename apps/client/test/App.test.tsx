import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { App } from '../src/App.js';

describe('App', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the Tabletop brand', () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }));
    render(<App />);
    expect(screen.getByText('Tabletop')).toBeInTheDocument();
  });

  it('reports API health as ok when the endpoint responds', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ status: 'ok' }) }),
    );
    render(<App />);
    await waitFor(() => expect(screen.getByTestId('health-status')).toHaveTextContent('API: ok'));
  });

  it('reports API health as error when the endpoint fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')));
    render(<App />);
    await waitFor(() =>
      expect(screen.getByTestId('health-status')).toHaveTextContent('API: error'),
    );
  });
});
