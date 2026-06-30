import { describe, expect, it, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { App } from '../src/App.js';

describe('App', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('shows the login screen when unauthenticated', async () => {
    render(<App />);
    expect(await screen.findByRole('button', { name: 'Logg inn' })).toBeInTheDocument();
    expect(screen.getByLabelText('Brukernavn')).toBeInTheDocument();
    expect(screen.getByLabelText('Passord')).toBeInTheDocument();
  });
});
