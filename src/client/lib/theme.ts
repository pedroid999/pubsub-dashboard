import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
  createElement,
} from 'react';
import { z } from 'zod';

export const ThemePreferenceSchema = z.enum(['dark', 'light', 'system']);
export type ThemePreference = z.infer<typeof ThemePreferenceSchema>;
export type ActiveTheme = 'dark' | 'light';

export const STORAGE_KEY = 'pubsub-dashboard:theme' as const;
export const THEME_CYCLE: readonly ThemePreference[] = ['dark', 'light', 'system'] as const;

export function resolveActiveTheme(
  preference: ThemePreference,
  osPrefersDark: boolean,
): ActiveTheme {
  if (preference === 'dark') return 'dark';
  if (preference === 'light') return 'light';
  return osPrefersDark ? 'dark' : 'light';
}

export interface ThemeContextValue {
  preference: ThemePreference;
  activeTheme: ActiveTheme;
  setPreference: (p: ThemePreference) => void;
}

export const ThemeContext = createContext<ThemeContextValue | null>(null);

function readStoredPreference(): ThemePreference {
  // FR-003 (feature 006): when NO preference is stored, default to dark
  // ("Sumi Ink") rather than feature-004's 'system' fallback, so first paint is
  // the redesign's dark theme regardless of OS. An explicit 'system' still works.
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = ThemePreferenceSchema.safeParse(raw);
    return parsed.success ? parsed.data : 'dark';
  } catch {
    return 'dark';
  }
}

function getOsPrefersDark(): boolean {
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  } catch {
    return false;
  }
}

function applyThemeClass(active: ActiveTheme): void {
  // Keep Tailwind's `.dark` class and the token `data-theme` attribute in sync
  // (feature 006 — tokens in styles.css are keyed by both selectors).
  if (active === 'dark') {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
  document.documentElement.setAttribute('data-theme', active);
}

export function ThemeProvider({ children }: { children: ReactNode }): JSX.Element {
  const [preference, setPreferenceState] = useState<ThemePreference>(readStoredPreference);
  const [activeTheme, setActiveTheme] = useState<ActiveTheme>(() =>
    resolveActiveTheme(readStoredPreference(), getOsPrefersDark()),
  );

  useEffect(() => {
    applyThemeClass(activeTheme);
  }, [activeTheme]);

  useEffect(() => {
    let mql: MediaQueryList | null = null;
    try {
      mql = window.matchMedia('(prefers-color-scheme: dark)');
    } catch {
      return;
    }

    function handleChange(e: MediaQueryListEvent): void {
      setPreferenceState((current) => {
        if (current === 'system') {
          setActiveTheme(e.matches ? 'dark' : 'light');
        }
        return current;
      });
    }

    mql.addEventListener('change', handleChange);
    return () => {
      mql?.removeEventListener('change', handleChange);
    };
  }, []);

  function setPreference(p: ThemePreference): void {
    try {
      localStorage.setItem(STORAGE_KEY, p);
    } catch {
      // ignore (private browsing)
    }
    const next = resolveActiveTheme(p, getOsPrefersDark());
    setPreferenceState(p);
    setActiveTheme(next);
  }

  return createElement(
    ThemeContext.Provider,
    { value: { preference, activeTheme, setPreference } },
    children,
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
}
