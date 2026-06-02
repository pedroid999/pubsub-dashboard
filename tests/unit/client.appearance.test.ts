import { describe, it, expect } from 'vitest';
import {
  appearanceReducer,
  parseAppearance,
  DEFAULT_APPEARANCE,
  AppearancePrefsSchema,
  type AppearancePrefs,
} from '../../src/client/lib/appearance.js';

/**
 * US3 / FR-010–FR-015 · contract appearance-prefs.md (A1, A2, A6).
 * The appearance store is a pure reducer + tolerant zod parser. Theme is NOT
 * managed here (stays in theme.ts / feature 004).
 */
describe('appearance reducer + schema (US3)', () => {
  describe('defaults (A2)', () => {
    it('exposes compact/cyan/rail as the default appearance', () => {
      expect(DEFAULT_APPEARANCE).toEqual({ density: 'compact', accent: 'cyan', layout: 'rail' });
    });

    it('parses an empty object to all defaults', () => {
      expect(parseAppearance({})).toEqual(DEFAULT_APPEARANCE);
    });

    it('parses null/undefined/non-object to all defaults', () => {
      expect(parseAppearance(null)).toEqual(DEFAULT_APPEARANCE);
      expect(parseAppearance(undefined)).toEqual(DEFAULT_APPEARANCE);
      expect(parseAppearance('nonsense')).toEqual(DEFAULT_APPEARANCE);
      expect(parseAppearance(42)).toEqual(DEFAULT_APPEARANCE);
    });
  });

  describe('tolerant per-field fallback (A2)', () => {
    it('keeps valid fields and falls back invalid ones independently', () => {
      expect(parseAppearance({ density: 'cozy', accent: 'bogus', layout: 'triptych' })).toEqual({
        density: 'cozy',
        accent: 'cyan',
        layout: 'triptych',
      });
    });

    it('falls back a single invalid field while keeping the rest', () => {
      expect(parseAppearance({ density: 'enormous', accent: 'amber', layout: 'console' })).toEqual({
        density: 'compact',
        accent: 'amber',
        layout: 'console',
      });
    });

    it('accepts every valid enum value', () => {
      expect(parseAppearance({ density: 'regular', accent: 'violet', layout: 'console' })).toEqual({
        density: 'regular',
        accent: 'violet',
        layout: 'console',
      });
    });

    it('schema directly produces defaults for missing fields', () => {
      expect(AppearancePrefsSchema.parse({})).toEqual(DEFAULT_APPEARANCE);
    });
  });

  describe('reducer transitions', () => {
    const base: AppearancePrefs = { density: 'compact', accent: 'cyan', layout: 'rail' };

    it('SET_DENSITY updates only density', () => {
      expect(appearanceReducer(base, { type: 'SET_DENSITY', density: 'cozy' })).toEqual({
        ...base,
        density: 'cozy',
      });
    });

    it('SET_ACCENT updates only accent', () => {
      expect(appearanceReducer(base, { type: 'SET_ACCENT', accent: 'magenta' })).toEqual({
        ...base,
        accent: 'magenta',
      });
    });

    it('SET_LAYOUT updates only layout', () => {
      expect(appearanceReducer(base, { type: 'SET_LAYOUT', layout: 'triptych' })).toEqual({
        ...base,
        layout: 'triptych',
      });
    });

    it('RESET returns the default appearance', () => {
      const dirty: AppearancePrefs = { density: 'cozy', accent: 'violet', layout: 'console' };
      expect(appearanceReducer(dirty, { type: 'RESET' })).toEqual(DEFAULT_APPEARANCE);
    });

    it('is immutable (does not mutate the input state)', () => {
      const frozen = Object.freeze({ ...base });
      expect(() =>
        appearanceReducer(frozen, { type: 'SET_DENSITY', density: 'regular' }),
      ).not.toThrow();
    });
  });
});
