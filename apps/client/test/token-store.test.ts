import { describe, expect, it, beforeEach } from 'vitest';
import { clearTokens, getAccessToken, getRefreshToken, setTokens } from '../src/lib/token-store.js';

describe('token-store', () => {
  beforeEach(() => {
    localStorage.clear();
    clearTokens();
  });

  it('stores the access token in memory and refresh token in localStorage', () => {
    setTokens('access-123', 'refresh-456');
    expect(getAccessToken()).toBe('access-123');
    expect(getRefreshToken()).toBe('refresh-456');
    expect(localStorage.getItem('tabletop.refreshToken')).toBe('refresh-456');
  });

  it('clears both tokens', () => {
    setTokens('access-123', 'refresh-456');
    clearTokens();
    expect(getAccessToken()).toBeNull();
    expect(getRefreshToken()).toBeNull();
  });

  it('removes the refresh token when set to null', () => {
    setTokens('access-123', 'refresh-456');
    setTokens('access-789', null);
    expect(getAccessToken()).toBe('access-789');
    expect(getRefreshToken()).toBeNull();
  });
});
