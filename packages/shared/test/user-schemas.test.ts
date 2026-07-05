import { describe, expect, it } from 'vitest';
import { adminCreateUserSchema, updateUserSchema } from '../src/auth.js';

describe('user admin schemas', () => {
  it('updateUserSchema rejects an empty body', () => {
    expect(() => updateUserSchema.parse({})).toThrow();
  });

  it('updateUserSchema accepts a role-only or password-only body', () => {
    expect(() => updateUserSchema.parse({ role: 'ADMIN' })).not.toThrow();
    expect(() => updateUserSchema.parse({ password: 'supersecret' })).not.toThrow();
  });

  it('adminCreateUserSchema requires a role', () => {
    expect(() =>
      adminCreateUserSchema.parse({ username: 'theo', password: 'supersecret' }),
    ).toThrow();
  });

  it('adminCreateUserSchema accepts a full valid payload', () => {
    expect(() =>
      adminCreateUserSchema.parse({ username: 'theo', password: 'supersecret', role: 'MEMBER' }),
    ).not.toThrow();
  });
});
