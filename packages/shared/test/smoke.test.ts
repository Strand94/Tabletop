import { describe, expect, it } from 'vitest';
import { SHARED_PACKAGE } from '../src/index.js';

describe('shared package smoke test', () => {
  it('runs the test runner', () => {
    expect(1 + 1).toBe(2);
  });

  it('exports the package marker', () => {
    expect(SHARED_PACKAGE).toBe('@tabletop/shared');
  });
});
