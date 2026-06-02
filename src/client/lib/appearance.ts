import {
  createContext,
  useContext,
  useEffect,
  useReducer,
  type ReactNode,
  createElement,
} from 'react';
import { z } from 'zod';

/**
 * Feature 006 / US3–US4 — workspace appearance preferences (density, accent,
 * layout). Theme (dark/light/system) stays in theme.ts (feature 004). Mirrors
 * the theme.ts persistence pattern: zod-validated reads with safe fallbacks,
 * persisted to localStorage, applied to <html> via data-* attributes.
 */

export const DensitySchema = z.enum(['compact', 'regular', 'cozy']);
export const AccentSchema = z.enum(['cyan', 'magenta', 'amber', 'violet']);
export const WorkspaceLayoutSchema = z.enum(['rail', 'triptych', 'console']);

export type Density = z.infer<typeof DensitySchema>;
export type Accent = z.infer<typeof AccentSchema>;
export type WorkspaceLayout = z.infer<typeof WorkspaceLayoutSchema>;

/**
 * Tolerant schema (contract A2): each field falls back to its default
 * independently, so a single corrupt field never discards the others.
 */
export const AppearancePrefsSchema = z.object({
  density: DensitySchema.catch('compact'),
  accent: AccentSchema.catch('cyan'),
  layout: WorkspaceLayoutSchema.catch('rail'),
});
export type AppearancePrefs = z.infer<typeof AppearancePrefsSchema>;

export const DEFAULT_APPEARANCE: AppearancePrefs = {
  density: 'compact',
  accent: 'cyan',
  layout: 'rail',
};

export const APPEARANCE_STORAGE_KEY = 'pubsub-dashboard:appearance' as const;

export type AppearanceAction =
  | { type: 'SET_DENSITY'; density: Density }
  | { type: 'SET_ACCENT'; accent: Accent }
  | { type: 'SET_LAYOUT'; layout: WorkspaceLayout }
  | { type: 'RESET' };

export function appearanceReducer(
  state: AppearancePrefs,
  action: AppearanceAction,
): AppearancePrefs {
  switch (action.type) {
    case 'SET_DENSITY':
      return { ...state, density: action.density };
    case 'SET_ACCENT':
      return { ...state, accent: action.accent };
    case 'SET_LAYOUT':
      return { ...state, layout: action.layout };
    case 'RESET':
      return { ...DEFAULT_APPEARANCE };
    default:
      return state;
  }
}

/**
 * Parse an unknown value (e.g. a parsed localStorage blob) into a valid
 * AppearancePrefs, falling back per-field. Non-object inputs yield all defaults.
 */
export function parseAppearance(raw: unknown): AppearancePrefs {
  const source = raw !== null && typeof raw === 'object' ? raw : {};
  return AppearancePrefsSchema.parse(source);
}

function readStoredAppearance(): AppearancePrefs {
  try {
    const raw = localStorage.getItem(APPEARANCE_STORAGE_KEY);
    return parseAppearance(raw ? JSON.parse(raw) : {});
  } catch {
    return { ...DEFAULT_APPEARANCE };
  }
}

function applyAppearanceAttributes(prefs: AppearancePrefs): void {
  const el = document.documentElement;
  el.setAttribute('data-density', prefs.density);
  el.setAttribute('data-accent', prefs.accent);
}

export interface AppearanceContextValue {
  prefs: AppearancePrefs;
  setDensity: (d: Density) => void;
  setAccent: (a: Accent) => void;
  setLayout: (l: WorkspaceLayout) => void;
  reset: () => void;
}

export const AppearanceContext = createContext<AppearanceContextValue | null>(null);

export function AppearanceProvider({ children }: { children: ReactNode }): JSX.Element {
  const [prefs, dispatch] = useReducer(appearanceReducer, undefined, readStoredAppearance);

  useEffect(() => {
    try {
      localStorage.setItem(APPEARANCE_STORAGE_KEY, JSON.stringify(prefs));
    } catch {
      // ignore (private browsing)
    }
    applyAppearanceAttributes(prefs);
  }, [prefs]);

  const value: AppearanceContextValue = {
    prefs,
    setDensity: (density) => dispatch({ type: 'SET_DENSITY', density }),
    setAccent: (accent) => dispatch({ type: 'SET_ACCENT', accent }),
    setLayout: (layout) => dispatch({ type: 'SET_LAYOUT', layout }),
    reset: () => dispatch({ type: 'RESET' }),
  };

  return createElement(AppearanceContext.Provider, { value }, children);
}

export function useAppearance(): AppearanceContextValue {
  const ctx = useContext(AppearanceContext);
  if (!ctx) throw new Error('useAppearance must be used inside AppearanceProvider');
  return ctx;
}
