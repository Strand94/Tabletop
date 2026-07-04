import type { AuthTokens } from '@tabletop/shared';
import { clearTokens, getAccessToken, getRefreshToken, setTokens } from './token-store.js';

/** Error carrying the HTTP status so callers/UI can branch on it. */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function refreshAccessToken(): Promise<boolean> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;
  const res = await fetch('/api/auth/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });
  if (!res.ok) {
    clearTokens();
    return false;
  }
  const data = (await res.json()) as AuthTokens;
  setTokens(data.accessToken, data.refreshToken);
  return true;
}

interface ApiOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
}

/**
 * Authenticated JSON fetch. Attaches the bearer token, and on a 401 attempts a
 * single token refresh then retries once. Throws ApiError on non-2xx.
 */
export async function apiFetch<T>(path: string, options: ApiOptions = {}): Promise<T> {
  // FormData bodies (file uploads) are passed through untouched: the browser sets
  // the multipart Content-Type with its boundary, and we must not JSON-encode them.
  const isFormData = options.body instanceof FormData;

  const doRequest = async (): Promise<Response> => {
    const headers = new Headers(options.headers);
    const token = getAccessToken();
    if (token) headers.set('Authorization', `Bearer ${token}`);
    if (options.body !== undefined && !isFormData && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }
    return fetch(path, {
      ...options,
      headers,
      body:
        options.body === undefined
          ? undefined
          : isFormData
            ? (options.body as FormData)
            : JSON.stringify(options.body),
    });
  };

  let res = await doRequest();
  if (res.status === 401 && (await refreshAccessToken())) {
    res = await doRequest();
  }

  if (res.status === 204) return undefined as T;
  const data = res.headers.get('content-type')?.includes('application/json')
    ? await res.json()
    : await res.text();
  if (!res.ok) {
    const message =
      typeof data === 'object' && data && 'error' in data
        ? String((data as { error: unknown }).error)
        : 'Request failed';
    throw new ApiError(res.status, message);
  }
  return data as T;
}
