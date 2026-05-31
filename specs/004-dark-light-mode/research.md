# Research: Dark/Light Mode Selector

**Feature**: 004-dark-light-mode | **Date**: 2026-05-31

## Decision 1 — Tailwind Dark Mode Strategy: `class` vs `media`

**Decision**: `darkMode: 'class'` in `tailwind.config.ts`

**Rationale**: The `class` strategy activates dark variants by presence of a `dark` class on `<html>`. This is required for three-state behavior (dark/light/system) because `media` strategy would always follow the OS and cannot be overridden. With `class`, JavaScript controls the class, enabling the user to pin dark or light regardless of OS.

**Alternatives Considered**:
- `media` — would work for two-state (dark/light) or system-only, but cannot support a user-pinned preference that overrides the OS. Rejected because the spec requires three states.
- CSS custom properties without Tailwind — more work, no type safety, inconsistent with the existing codebase. Rejected.

**Test signal**: `document.documentElement.classList.contains('dark')` is the single source of truth for the active theme at runtime.

---

## Decision 2 — Theme Preference Storage: `localStorage` vs `~/.config/pubsub-dashboard/`

**Decision**: Store `pubsub-dashboard:theme` in `localStorage` (browser-only)

**Rationale**: SC-002 (zero FOUC) requires the preference to be readable synchronously during HTML parsing, before the JavaScript bundle loads. `localStorage` satisfies this via an inline `<script>` in `index.html`. The `~/.config/pubsub-dashboard/` JSON file is inaccessible to browser-side code without an HTTP round-trip, which violates the FOUC requirement.

**Scope boundary**: The `~/.config/pubsub-dashboard/` file is for CLI/server preferences (`preferredPort`, `verboseByDefault`, `recentProjects`) — settings that govern Node.js process behavior. Theme is a browser rendering preference.

**Alternatives Considered**:
- `~/.config/pubsub-dashboard/` — server-side, would require an `/api/preferences/theme` endpoint and SSR injection or HTTP prefetch. Both add latency and create FOUC risk on slow connections. Rejected.
- `sessionStorage` — not persisted across tab close/browser restart. Rejected (FR-003).
- Cookie — readable server-side; would allow SSR injection, but this app has no SSR. Overkill. Rejected.

---

## Decision 3 — Anti-FOUC Strategy: Inline Script in `index.html`

**Decision**: Add a synchronous inline `<script>` as the first child of `<head>` in `src/client/index.html`

**Script logic**:
```
1. Read localStorage['pubsub-dashboard:theme']
2. If value is 'dark' → add class 'dark' to <html>
3. If value is 'light' → no class (light is default)
4. If value is 'system' or missing → check window.matchMedia('(prefers-color-scheme: dark)')
   - If matches → add class 'dark' to <html>
   - Otherwise → no class
```

**Rationale**: This script executes synchronously during HTML parsing, before any stylesheet or JavaScript bundle is evaluated. It sets the `dark` class before the browser renders a single pixel, eliminating FOUC completely.

**Size**: ~200 bytes minified — negligible on performance budget.

**Alternatives Considered**:
- Reading preference in React `useEffect` — executes after paint, causing FOUC. Rejected (SC-002).
- CSS `prefers-color-scheme` media query only — does not support pinned preferences. Rejected (FR-005b).

---

## Decision 4 — React Architecture: Context + Custom Hook (no external library)

**Decision**: Implement `ThemeContext` + `useTheme` hook in `src/client/lib/theme.ts`

**Rationale**: The feature needs one piece of shared state (current preference) accessible from `App.tsx` (to apply the class) and `ThemeToggle.tsx` (to render the current state and cycle it). React Context with a custom hook is the standard, zero-dependency solution for this exact scope. No external library (e.g., `next-themes`) is warranted.

**Component breakdown**:
- `theme.ts` — `ThemePreferenceSchema` (Zod), `ThemePreference` type, `STORAGE_KEY` constant, `resolveActiveTheme()` function, `ThemeContext`, `ThemeProvider` component, `useTheme` hook
- `ThemeToggle.tsx` — button with Moon/Sun/Monitor icon, cycles through `dark → light → system → dark`; reads/writes via `useTheme`

**Alternatives Considered**:
- `next-themes` — excellent library, but this is not a Next.js app and adding a new runtime dependency requires written justification per Principle V. The feature is simple enough to implement without it. Rejected.
- Global state (Redux/Zustand) — overkill for a single boolean-equivalent value. Rejected.

---

## Decision 5 — `prefers-reduced-motion` Handling

**Decision**: Apply `transition-colors` Tailwind class conditionally; use CSS `@media (prefers-reduced-motion: reduce)` to set `transition: none` for motion-sensitive users

**Rationale**: The spec (FR-008, clarification Q3) requires instant switch for users with `prefers-reduced-motion`. CSS media query handles this declaratively without JavaScript, covering both programmatic and OS-level changes.

**Implementation**: In `src/client/styles.css`, add:
```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    transition-duration: 0.01ms !important;
    animation-duration: 0.01ms !important;
  }
}
```

---

## Test Plan (Principle II)

### Unit Tests (`tests/unit/theme.test.ts`)
- `ThemePreferenceSchema` accepts `dark`, `light`, `system`; rejects invalid values
- `resolveActiveTheme('dark')` → `'dark'`
- `resolveActiveTheme('light')` → `'light'`
- `resolveActiveTheme('system')` with OS dark → `'dark'`
- `resolveActiveTheme('system')` with OS light → `'light'`
- `resolveActiveTheme(null)` (no stored preference) defaults to system resolution
- `ThemeProvider` reads localStorage on mount and applies correct class

### Component Tests (`tests/unit/ThemeToggle.test.tsx`)
- Renders Moon icon when `dark`
- Renders Sun icon when `light`
- Renders Monitor icon when `system`
- Clicking cycles: dark → light → system → dark
- `aria-label` reflects current state (screen reader)
- Writing to localStorage on each toggle

### E2E Tests (`tests/e2e/theme.spec.ts`)
- Toggle button present in header
- Clicking changes visible color scheme
- Preference persists across page reload
- System preference applied on first load (clear localStorage)
- `prefers-reduced-motion` users see instant switch (check transition duration)
