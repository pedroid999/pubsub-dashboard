import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { AppearanceSettings } from '../../src/client/components/AppearanceSettings.js';
import { AppearanceProvider } from '../../src/client/lib/appearance.js';
import { ThemeProvider } from '../../src/client/lib/theme.js';

afterEach(() => {
  cleanup();
  localStorage.clear();
  document.documentElement.removeAttribute('data-density');
  document.documentElement.removeAttribute('data-accent');
  document.documentElement.removeAttribute('data-theme');
  document.documentElement.className = '';
});

function renderSettings(): void {
  render(
    <ThemeProvider>
      <AppearanceProvider>
        <AppearanceSettings />
      </AppearanceProvider>
    </ThemeProvider>,
  );
}

function open(): void {
  fireEvent.click(screen.getByTestId('settings-trigger'));
}

describe('AppearanceSettings (US4 · A4–A9)', () => {
  it('is closed by default and opens via the gear trigger', () => {
    renderSettings();
    expect(screen.queryByTestId('appearance-settings')).not.toBeInTheDocument();
    open();
    expect(screen.getByTestId('appearance-settings')).toBeInTheDocument();
  });

  it('A4: selecting a density updates data-density on <html> and persists', () => {
    renderSettings();
    open();
    fireEvent.click(screen.getByTestId('density-cozy'));
    expect(document.documentElement.getAttribute('data-density')).toBe('cozy');
    const stored = JSON.parse(localStorage.getItem('pubsub-dashboard:appearance') ?? '{}');
    expect(stored.density).toBe('cozy');
    expect(screen.getByTestId('density-cozy')).toHaveAttribute('aria-pressed', 'true');
  });

  it('A5: selecting an accent updates data-accent on <html> and persists', () => {
    renderSettings();
    open();
    fireEvent.click(screen.getByTestId('accent-magenta'));
    expect(document.documentElement.getAttribute('data-accent')).toBe('magenta');
    const stored = JSON.parse(localStorage.getItem('pubsub-dashboard:appearance') ?? '{}');
    expect(stored.accent).toBe('magenta');
  });

  it('A6: selecting a layout persists the choice', () => {
    renderSettings();
    open();
    fireEvent.click(screen.getByTestId('layout-triptych'));
    const stored = JSON.parse(localStorage.getItem('pubsub-dashboard:appearance') ?? '{}');
    expect(stored.layout).toBe('triptych');
    expect(screen.getByTestId('layout-triptych')).toHaveAttribute('aria-pressed', 'true');
  });

  it('A3: theme controls toggle Sumi-Ink (dark) ⇄ Lotus (light) and persist', () => {
    renderSettings();
    open();
    fireEvent.click(screen.getByTestId('theme-light'));
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(localStorage.getItem('pubsub-dashboard:theme')).toBe('light');

    fireEvent.click(screen.getByTestId('theme-dark'));
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('A8: all four dimensions persist together to localStorage', () => {
    renderSettings();
    open();
    fireEvent.click(screen.getByTestId('density-regular'));
    fireEvent.click(screen.getByTestId('accent-amber'));
    fireEvent.click(screen.getByTestId('layout-console'));
    const stored = JSON.parse(localStorage.getItem('pubsub-dashboard:appearance') ?? '{}');
    expect(stored).toEqual({ density: 'regular', accent: 'amber', layout: 'console' });
  });

  it('A7: exposes NO neon-intensity or scanline controls', () => {
    renderSettings();
    open();
    expect(screen.queryByText(/neon/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/scanline/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/grain/i)).not.toBeInTheDocument();
  });

  it('positions the popover absolutely so it never grows the header (regression)', () => {
    // `.panel` sets position:relative and is defined after Tailwind utilities,
    // so the popover MUST force `!absolute` to stay out of flow.
    renderSettings();
    open();
    expect(screen.getByTestId('appearance-settings').className).toContain('!absolute');
  });

  it('closes on Escape', () => {
    renderSettings();
    open();
    expect(screen.getByTestId('appearance-settings')).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByTestId('appearance-settings')).not.toBeInTheDocument();
  });
});
