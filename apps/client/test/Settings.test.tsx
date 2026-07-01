import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LocaleProvider } from '../src/lib/i18n.js';
import { ThemeProvider } from '../src/lib/theme.js';
import { Settings } from '../src/pages/Settings.js';

vi.mock('../src/lib/auth.js', () => ({
  useAuth: () => ({ user: { id: 1, username: 'maya', role: 'ADMIN' }, loading: false }),
}));

function renderSettings() {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({}),
    }),
  );
  return render(
    <LocaleProvider>
      <ThemeProvider>
        <Settings />
      </ThemeProvider>
    </LocaleProvider>,
  );
}

describe('Settings', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('renders sections and switches interface language', () => {
    renderSettings();
    // Norwegian by default.
    expect(screen.getByText('Utseende')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'English' }));
    // Section headings re-render in English.
    expect(screen.getByText('Appearance')).toBeInTheDocument();
    expect(screen.getByText('Language')).toBeInTheDocument();
  });

  it('exposes the export action for admins', () => {
    renderSettings();
    expect(screen.getByText('JSON')).toBeInTheDocument();
    expect(screen.getByText('CSV')).toBeInTheDocument();
  });
});
