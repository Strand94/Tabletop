import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config.js';

const validEnv = {
  DB_USER: 'tabletop',
  DB_PASSWORD: 'secret',
  JWT_SECRET: 'a'.repeat(64),
  JWT_REFRESH_SECRET: 'b'.repeat(64),
};

describe('loadConfig', () => {
  it('throws when a required variable is missing', () => {
    expect(() => loadConfig({ ...validEnv, JWT_SECRET: undefined })).toThrow();
  });

  it('returns a typed config with defaults applied', () => {
    const config = loadConfig(validEnv);
    expect(config.PORT).toBe(5470);
    expect(config.DB_HOST).toBe('db');
    expect(config.DB_PORT).toBe(5432);
    expect(config.DB_NAME).toBe('tabletop');
    expect(config.DEFAULT_CURRENCY).toBe('NOK');
    expect(config.DEFAULT_LOCALE).toBe('en');
    expect(config.BGG_SYNC_ENABLED).toBe(false);
    expect(config.BGG_SYNC_PROVIDER).toBe('csv');
  });

  it('coerces numeric and boolean strings', () => {
    const config = loadConfig({ ...validEnv, PORT: '8080', BGG_SYNC_ENABLED: 'true' });
    expect(config.PORT).toBe(8080);
    expect(config.BGG_SYNC_ENABLED).toBe(true);
  });

  it('derives DATABASE_URL from DB_* parts when not provided', () => {
    const config = loadConfig(validEnv);
    expect(config.DATABASE_URL).toBe('postgresql://tabletop:secret@db:5432/tabletop');
  });

  it('prefers an explicit DATABASE_URL when set', () => {
    const url = 'postgresql://u:p@host:5432/db';
    const config = loadConfig({ ...validEnv, DATABASE_URL: url });
    expect(config.DATABASE_URL).toBe(url);
  });

  it('rejects an invalid BGG provider', () => {
    expect(() => loadConfig({ ...validEnv, BGG_SYNC_PROVIDER: 'bogus' })).toThrow();
  });
});
