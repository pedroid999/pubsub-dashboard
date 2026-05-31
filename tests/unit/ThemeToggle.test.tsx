import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ThemeProvider } from '../../src/client/lib/theme.js';
import { ThemeToggle } from '../../src/client/components/ThemeToggle.js';
import { STORAGE_KEY } from '../../src/client/lib/theme.js';

function renderWithProvider(initialPreference?: string) {
  if (initialPreference) {
    localStorage.setItem(STORAGE_KEY, initialPreference);
  }
  return render(
    <ThemeProvider>
      <ThemeToggle />
    </ThemeProvider>,
  );
}

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('ThemeToggle — rendering', () => {
  it('renders when preference is dark (Moon icon)', () => {
    renderWithProvider('dark');
    expect(screen.getByTestId('theme-toggle')).toBeInTheDocument();
  });

  it('renders when preference is light (Sun icon)', () => {
    renderWithProvider('light');
    expect(screen.getByTestId('theme-toggle')).toBeInTheDocument();
  });

  it('renders when preference is system (Monitor icon)', () => {
    renderWithProvider('system');
    expect(screen.getByTestId('theme-toggle')).toBeInTheDocument();
  });
});

describe('ThemeToggle — cycling', () => {
  beforeEach(() => {
    localStorage.setItem(STORAGE_KEY, 'dark');
  });

  it('cycles dark → light on first click', () => {
    renderWithProvider('dark');
    const btn = screen.getByTestId('theme-toggle');
    fireEvent.click(btn);
    expect(localStorage.getItem(STORAGE_KEY)).toBe('light');
  });

  it('cycles light → system on second click', () => {
    renderWithProvider('light');
    const btn = screen.getByTestId('theme-toggle');
    fireEvent.click(btn);
    expect(localStorage.getItem(STORAGE_KEY)).toBe('system');
  });

  it('cycles system → dark on third click', () => {
    renderWithProvider('system');
    const btn = screen.getByTestId('theme-toggle');
    fireEvent.click(btn);
    expect(localStorage.getItem(STORAGE_KEY)).toBe('dark');
  });
});

describe('ThemeToggle — accessibility', () => {
  it('has aria-label when dark', () => {
    renderWithProvider('dark');
    const btn = screen.getByTestId('theme-toggle');
    expect(btn).toHaveAttribute('aria-label');
    expect(btn.getAttribute('aria-label')).toMatch(/light/i);
  });

  it('has aria-label when light', () => {
    renderWithProvider('light');
    const btn = screen.getByTestId('theme-toggle');
    expect(btn).toHaveAttribute('aria-label');
    expect(btn.getAttribute('aria-label')).toMatch(/system/i);
  });

  it('has aria-label when system', () => {
    renderWithProvider('system');
    const btn = screen.getByTestId('theme-toggle');
    expect(btn).toHaveAttribute('aria-label');
    expect(btn.getAttribute('aria-label')).toMatch(/dark/i);
  });

  it('is a button element', () => {
    renderWithProvider('system');
    const btn = screen.getByTestId('theme-toggle');
    expect(btn.tagName).toBe('BUTTON');
    expect(btn).toHaveAttribute('type', 'button');
  });
});
