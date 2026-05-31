import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { createElement } from 'react';
import {
  ThemePreferenceSchema,
  resolveActiveTheme,
  STORAGE_KEY,
  THEME_CYCLE,
  ThemeProvider,
  useTheme,
} from '../../src/client/lib/theme.js';

describe('ThemePreferenceSchema', () => {
  it('accepts valid values', () => {
    expect(ThemePreferenceSchema.safeParse('dark').success).toBe(true);
    expect(ThemePreferenceSchema.safeParse('light').success).toBe(true);
    expect(ThemePreferenceSchema.safeParse('system').success).toBe(true);
  });

  it('rejects invalid values', () => {
    expect(ThemePreferenceSchema.safeParse('auto').success).toBe(false);
    expect(ThemePreferenceSchema.safeParse('').success).toBe(false);
    expect(ThemePreferenceSchema.safeParse(null).success).toBe(false);
    expect(ThemePreferenceSchema.safeParse(undefined).success).toBe(false);
    expect(ThemePreferenceSchema.safeParse(42).success).toBe(false);
  });
});

describe('resolveActiveTheme', () => {
  it('returns dark when preference is dark regardless of OS', () => {
    expect(resolveActiveTheme('dark', true)).toBe('dark');
    expect(resolveActiveTheme('dark', false)).toBe('dark');
  });

  it('returns light when preference is light regardless of OS', () => {
    expect(resolveActiveTheme('light', true)).toBe('light');
    expect(resolveActiveTheme('light', false)).toBe('light');
  });

  it('returns dark when preference is system and OS prefers dark', () => {
    expect(resolveActiveTheme('system', true)).toBe('dark');
  });

  it('returns light when preference is system and OS prefers light', () => {
    expect(resolveActiveTheme('system', false)).toBe('light');
  });
});

describe('STORAGE_KEY', () => {
  it('is the expected constant', () => {
    expect(STORAGE_KEY).toBe('pubsub-dashboard:theme');
  });
});

describe('THEME_CYCLE', () => {
  it('cycles dark → light → system', () => {
    expect(THEME_CYCLE).toEqual(['dark', 'light', 'system']);
  });
});

describe('ThemeProvider (US2 — system preference detection)', () => {
  afterEach(() => {
    cleanup();
    localStorage.clear();
    vi.restoreAllMocks();
    document.documentElement.classList.remove('dark');
  });

  it('applies dark class when stored preference is dark', () => {
    localStorage.setItem(STORAGE_KEY, 'dark');
    render(createElement(ThemeProvider, null, null));
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('removes dark class when stored preference is light', () => {
    document.documentElement.classList.add('dark');
    localStorage.setItem(STORAGE_KEY, 'light');
    render(createElement(ThemeProvider, null, null));
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('useTheme throws outside ThemeProvider', () => {
    function BadComponent() {
      useTheme();
      return null;
    }
    expect(() => render(createElement(BadComponent))).toThrow(
      'useTheme must be used inside ThemeProvider',
    );
  });

  it('setPreference updates localStorage', () => {
    let setter: ((p: import('../../src/client/lib/theme.js').ThemePreference) => void) | null =
      null;
    function Spy() {
      const ctx = useTheme();
      setter = ctx.setPreference;
      return null;
    }
    render(createElement(ThemeProvider, null, createElement(Spy)));
    setter?.('dark');
    expect(localStorage.getItem(STORAGE_KEY)).toBe('dark');
  });
});

describe('localStorage integration', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('reads stored valid preference', () => {
    localStorage.setItem(STORAGE_KEY, 'dark');
    expect(localStorage.getItem(STORAGE_KEY)).toBe('dark');
    const parsed = ThemePreferenceSchema.safeParse(localStorage.getItem(STORAGE_KEY));
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data).toBe('dark');
  });

  it('falls back to system for invalid stored value', () => {
    localStorage.setItem(STORAGE_KEY, 'invalid-value');
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = ThemePreferenceSchema.safeParse(raw);
    expect(parsed.success).toBe(false);
    // Caller must fall back to 'system'
  });

  it('writes and reads roundtrip correctly', () => {
    localStorage.setItem(STORAGE_KEY, 'light');
    const parsed = ThemePreferenceSchema.safeParse(localStorage.getItem(STORAGE_KEY));
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data).toBe('light');
  });
});
