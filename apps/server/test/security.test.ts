import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { tokenServiceFromConfig } from '../src/modules/auth/routes.js';

const tokens = tokenServiceFromConfig({
  JWT_SECRET: 'access-secret-access-secret-1234567890',
  JWT_REFRESH_SECRET: 'refresh-secret-refresh-secret-1234567890',
});

const app = createApp({ tokens, defaultLocale: 'en', defaultCurrency: 'NOK' });

describe('security headers', () => {
  it('sets a CSP that permits the Google Fonts / Material Symbols origins', async () => {
    const res = await request(app).get('/api/health');
    const csp = res.headers['content-security-policy'];
    expect(csp).toBeTruthy();
    expect(csp).toContain('https://fonts.googleapis.com');
    expect(csp).toContain('https://fonts.gstatic.com');
  });

  it('sets nosniff', async () => {
    const res = await request(app).get('/api/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });
});

describe('auth rate limiting', () => {
  it('exposes standard RateLimit headers on auth routes', async () => {
    // The limiter runs before routing, so even an unmatched /api/auth path is
    // annotated — this avoids a DB call in a unit test.
    const res = await request(app).get('/api/auth/__ratelimit_probe');
    expect(res.headers['ratelimit'] ?? res.headers['ratelimit-limit']).toBeTruthy();
  });
});
