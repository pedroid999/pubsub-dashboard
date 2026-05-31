import { Moon, Sun, Monitor } from 'lucide-react';
import { useTheme, THEME_CYCLE, type ThemePreference } from '../lib/theme.js';

const ARIA_LABEL: Record<ThemePreference, string> = {
  dark: 'Switch to light mode',
  light: 'Switch to system theme',
  system: 'Switch to dark mode',
};

export function ThemeToggle(): JSX.Element {
  const { preference, setPreference } = useTheme();

  function handleClick(): void {
    const idx = THEME_CYCLE.indexOf(preference);
    const next: ThemePreference = THEME_CYCLE[(idx + 1) % THEME_CYCLE.length] ?? 'system';
    setPreference(next);
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={ARIA_LABEL[preference]}
      data-testid="theme-toggle"
      className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-200"
    >
      {preference === 'dark' && <Moon className="h-4 w-4" aria-hidden="true" />}
      {preference === 'light' && <Sun className="h-4 w-4" aria-hidden="true" />}
      {preference === 'system' && <Monitor className="h-4 w-4" aria-hidden="true" />}
    </button>
  );
}
