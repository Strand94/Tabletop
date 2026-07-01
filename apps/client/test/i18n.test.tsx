import { describe, expect, it, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LocaleProvider, useLocale } from '../src/lib/i18n.js';
import { t } from '../src/lib/strings.js';

function Probe(): JSX.Element {
  const { setLocale } = useLocale();
  return (
    <div>
      <span data-testid="label">{t.nav.dashboard}</span>
      <button type="button" onClick={() => setLocale('en')}>
        to-en
      </button>
      <button type="button" onClick={() => setLocale('nb')}>
        to-nb
      </button>
    </div>
  );
}

describe('i18n', () => {
  beforeEach(() => localStorage.clear());

  it('defaults to Norwegian and switches to English at runtime', () => {
    render(
      <LocaleProvider>
        <Probe />
      </LocaleProvider>,
    );
    expect(screen.getByTestId('label')).toHaveTextContent('Dashbord');

    fireEvent.click(screen.getByText('to-en'));
    expect(screen.getByTestId('label')).toHaveTextContent('Dashboard');

    fireEvent.click(screen.getByText('to-nb'));
    expect(screen.getByTestId('label')).toHaveTextContent('Dashbord');
  });

  it('persists the choice to localStorage', () => {
    render(
      <LocaleProvider>
        <Probe />
      </LocaleProvider>,
    );
    fireEvent.click(screen.getByText('to-en'));
    expect(localStorage.getItem('tabletop.locale')).toBe('en');
  });
});
