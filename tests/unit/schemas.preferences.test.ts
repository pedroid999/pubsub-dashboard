import { describe, it, expect } from 'vitest';
import { PreferencesSchema } from '../../src/server/schemas/preferences.js';

describe('PreferencesSchema (T-SCHEMA-060..061, reserved for feature 002)', () => {
  it('accepts an empty object (all fields optional)', () => {
    expect(() => PreferencesSchema.parse({})).not.toThrow();
  });

  it('accepts every documented optional field', () => {
    expect(() =>
      PreferencesSchema.parse({
        preferredPort: 5173,
        verboseByDefault: true,
        recentProjects: ['p1', 'p2'],
      }),
    ).not.toThrow();
  });

  it('rejects unknown fields (strict)', () => {
    expect(() => PreferencesSchema.parse({ neverHeardOfThis: 1 })).toThrow();
  });

  it('rejects preferredPort out of range', () => {
    expect(() => PreferencesSchema.parse({ preferredPort: 0 })).toThrow();
    expect(() => PreferencesSchema.parse({ preferredPort: 70000 })).toThrow();
  });
});
