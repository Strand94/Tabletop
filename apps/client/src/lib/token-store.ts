/**
 * Framework-agnostic token storage shared between the API layer and the auth
 * context. The access token lives only in memory (reduces XSS blast radius); the
 * refresh token persists in localStorage so sessions survive reloads.
 */
const REFRESH_KEY = 'tabletop.refreshToken';

let accessToken: string | null = null;

export function getAccessToken(): string | null {
  return accessToken;
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_KEY);
}

export function setTokens(access: string | null, refresh: string | null): void {
  accessToken = access;
  if (refresh) {
    localStorage.setItem(REFRESH_KEY, refresh);
  } else {
    localStorage.removeItem(REFRESH_KEY);
  }
}

export function clearTokens(): void {
  setTokens(null, null);
}
