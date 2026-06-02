import { useEffect, useRef, useState } from 'react';
import { Settings, Moon, Sun, Monitor } from 'lucide-react';
import {
  useAppearance,
  type Density,
  type Accent,
  type WorkspaceLayout,
} from '../lib/appearance.js';
import { useTheme, type ThemePreference } from '../lib/theme.js';

const DENSITIES: readonly { value: Density; label: string }[] = [
  { value: 'compact', label: 'Compact' },
  { value: 'regular', label: 'Regular' },
  { value: 'cozy', label: 'Cozy' },
];

const ACCENTS: readonly { value: Accent; label: string; swatch: string }[] = [
  { value: 'cyan', label: 'Cyan', swatch: '#22d3ee' },
  { value: 'magenta', label: 'Magenta', swatch: '#f472b6' },
  { value: 'amber', label: 'Amber', swatch: '#fbbf24' },
  { value: 'violet', label: 'Violet', swatch: '#a78bfa' },
];

const LAYOUTS: readonly { value: WorkspaceLayout; label: string }[] = [
  { value: 'rail', label: 'Rail' },
  { value: 'triptych', label: 'Triptych' },
  { value: 'console', label: 'Console' },
];

const THEMES: readonly { value: ThemePreference; label: string }[] = [
  { value: 'dark', label: 'Dark' },
  { value: 'light', label: 'Light' },
  { value: 'system', label: 'System' },
];

function Segment<T extends string>({
  legend,
  options,
  active,
  onPick,
  testPrefix,
}: {
  legend: string;
  options: readonly { value: T; label: string }[];
  active: T;
  onPick: (v: T) => void;
  testPrefix: string;
}): JSX.Element {
  return (
    <fieldset className="mb-3">
      <legend className="mb-1 text-[var(--fs-label)] font-semibold uppercase tracking-[0.12em] text-fg2">
        {legend}
      </legend>
      <div className="flex gap-1 rounded-token border border-line bg-bg1 p-1">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            aria-pressed={active === o.value}
            data-testid={`${testPrefix}-${o.value}`}
            onClick={() => onPick(o.value)}
            className={`flex-1 rounded-token px-2 py-1 text-[var(--fs-base)] ${
              active === o.value ? 'bg-inset text-accent' : 'text-fg2 hover:text-fg0'
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

/**
 * Appearance settings surface (US4 · contract appearance-prefs A4–A9). Exposes
 * theme, density, accent, and layout — all persisted via their stores. Neon
 * intensity and scanlines are fixed defaults and intentionally NOT configurable
 * here (FR-014 / A7).
 */
export function AppearanceSettings(): JSX.Element {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { prefs, setDensity, setAccent, setLayout } = useAppearance();
  const { preference, setPreference } = useTheme();

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent): void {
      if (e.key === 'Escape') setOpen(false);
    }
    function onClick(e: MouseEvent): void {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClick);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        data-testid="settings-trigger"
        aria-label="Open appearance settings"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="rounded-token p-1.5 text-fg2 hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <Settings className="h-4 w-4" aria-hidden="true" />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Appearance settings"
          data-testid="appearance-settings"
          className="panel !absolute right-0 z-50 mt-2 w-64 p-3 shadow-glow"
        >
          <fieldset className="mb-3">
            <legend className="mb-1 text-[var(--fs-label)] font-semibold uppercase tracking-[0.12em] text-fg2">
              Theme
            </legend>
            <div className="flex gap-1 rounded-token border border-line bg-bg1 p-1">
              {THEMES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  aria-pressed={preference === t.value}
                  data-testid={`theme-${t.value}`}
                  onClick={() => setPreference(t.value)}
                  className={`flex flex-1 items-center justify-center gap-1 rounded-token px-2 py-1 text-[var(--fs-base)] ${
                    preference === t.value ? 'bg-inset text-accent' : 'text-fg2 hover:text-fg0'
                  }`}
                >
                  {t.value === 'dark' && <Moon className="h-3 w-3" aria-hidden="true" />}
                  {t.value === 'light' && <Sun className="h-3 w-3" aria-hidden="true" />}
                  {t.value === 'system' && <Monitor className="h-3 w-3" aria-hidden="true" />}
                  {t.label}
                </button>
              ))}
            </div>
          </fieldset>

          <Segment
            legend="Density"
            options={DENSITIES}
            active={prefs.density}
            onPick={setDensity}
            testPrefix="density"
          />

          <fieldset className="mb-3">
            <legend className="mb-1 text-[var(--fs-label)] font-semibold uppercase tracking-[0.12em] text-fg2">
              Accent
            </legend>
            <div className="flex gap-2">
              {ACCENTS.map((a) => (
                <button
                  key={a.value}
                  type="button"
                  aria-pressed={prefs.accent === a.value}
                  aria-label={a.label}
                  data-testid={`accent-${a.value}`}
                  onClick={() => setAccent(a.value)}
                  className={`h-7 w-7 rounded-full border-2 ${
                    prefs.accent === a.value ? 'border-fg0' : 'border-line'
                  }`}
                  style={{ backgroundColor: a.swatch }}
                />
              ))}
            </div>
          </fieldset>

          <Segment
            legend="Layout"
            options={LAYOUTS}
            active={prefs.layout}
            onPick={setLayout}
            testPrefix="layout"
          />
        </div>
      )}
    </div>
  );
}
