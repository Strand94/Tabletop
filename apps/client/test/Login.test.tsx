import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Login } from '../src/pages/Login.js';
import { setActiveTable } from '../src/lib/strings.js';

const login = vi.fn().mockResolvedValue(undefined);
vi.mock('../src/lib/auth.js', () => ({ useAuth: () => ({ login }) }));

function stubSetupStatus(needsSetup: boolean) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ needsSetup }),
    }),
  );
}

function renderLogin() {
  return render(
    <MemoryRouter>
      <Login />
    </MemoryRouter>,
  );
}

describe('Login', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    login.mockClear();
    setActiveTable('en');
  });

  it('shows the create-admin form on first run', async () => {
    stubSetupStatus(true);
    renderLogin();
    expect(await screen.findByRole('button', { name: 'Create admin' })).toBeInTheDocument();
    expect(screen.getByLabelText('Confirm password')).toBeInTheDocument();
  });

  it('shows the normal sign-in form when a user already exists', async () => {
    stubSetupStatus(false);
    renderLogin();
    expect(await screen.findByRole('button', { name: 'Sign in' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Confirm password')).not.toBeInTheDocument();
  });

  it('blocks mismatched passwords on the create-admin form', async () => {
    stubSetupStatus(true);
    renderLogin();
    await screen.findByRole('button', { name: 'Create admin' });
    fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'maya' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'supersecret' } });
    fireEvent.change(screen.getByLabelText('Confirm password'), {
      target: { value: 'different1' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create admin' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Passwords do not match');
    expect(login).not.toHaveBeenCalled();
  });
});
