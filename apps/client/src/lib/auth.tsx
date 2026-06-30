import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { AuthTokens, UserPublic } from '@tabletop/shared';
import { apiFetch } from './api.js';
import { clearTokens, getRefreshToken, setTokens } from './token-store.js';

interface AuthContextValue {
  user: UserPublic | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Auth provider. On mount, if a refresh token is present it restores the session
 * by calling /api/auth/me (apiFetch transparently refreshes the access token).
 */
export function AuthProvider({ children }: { children: ReactNode }): JSX.Element {
  const [user, setUser] = useState<UserPublic | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    if (!getRefreshToken()) {
      setLoading(false);
      return;
    }
    apiFetch<UserPublic>('/api/auth/me')
      .then((me) => {
        if (active) setUser(me);
      })
      .catch(() => {
        clearTokens();
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const tokens = await apiFetch<AuthTokens>('/api/auth/login', {
      method: 'POST',
      body: { username, password },
    });
    setTokens(tokens.accessToken, tokens.refreshToken);
    setUser(tokens.user);
  }, []);

  const logout = useCallback(() => {
    clearTokens();
    setUser(null);
  }, []);

  const value = useMemo(() => ({ user, loading, login, logout }), [user, loading, login, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
