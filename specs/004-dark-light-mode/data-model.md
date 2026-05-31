# Data Model: Dark/Light Mode Selector

**Feature**: 004-dark-light-mode | **Date**: 2026-05-31

This feature involves no database entities and no server-side persistence. The data model is limited to client-side state and the browser storage schema.

---

## Entity 1 — ThemePreference (client storage value)

**Location**: `src/client/lib/theme.ts`
**Persistence**: `localStorage` under key `pubsub-dashboard:theme`

```typescript
// Zod schema — source of truth for the stored value
export const ThemePreferenceSchema = z.enum(['dark', 'light', 'system']);
export type ThemePreference = z.infer<typeof ThemePreferenceSchema>;
// → 'dark' | 'light' | 'system'
```

**Valid values**:

| Value | Meaning | Active theme |
|-------|---------|--------------|
| `'dark'` | User explicitly wants dark | Always `dark` |
| `'light'` | User explicitly wants light | Always `light` |
| `'system'` | Follow OS color scheme | `dark` or `light` depending on `prefers-color-scheme` |

**Default**: `'system'` (applied when `localStorage` entry is absent or invalid)

**Storage rules**:
- Key: `pubsub-dashboard:theme`
- Written on every user toggle
- Read synchronously by the anti-FOUC inline script before React mounts
- Validated through `ThemePreferenceSchema.safeParse()` on read; invalid values fall back to `'system'`

---

## Entity 2 — ActiveTheme (derived, runtime only)

**Not persisted** — derived at runtime from ThemePreference + OS media query.

```typescript
export type ActiveTheme = 'dark' | 'light';

export function resolveActiveTheme(
  preference: ThemePreference,
  osPrefersDark: boolean,
): ActiveTheme {
  if (preference === 'dark') return 'dark';
  if (preference === 'light') return 'light';
  return osPrefersDark ? 'dark' : 'light'; // 'system' case
}
```

---

## Entity 3 — ThemeContextValue (React context shape)

**Location**: `src/client/lib/theme.ts`

```typescript
export interface ThemeContextValue {
  preference: ThemePreference;      // stored value ('dark' | 'light' | 'system')
  activeTheme: ActiveTheme;         // resolved runtime value ('dark' | 'light')
  setPreference: (p: ThemePreference) => void;  // persists to localStorage + updates context
}
```

**Context initialization**:
1. Read `localStorage.getItem(STORAGE_KEY)`
2. Parse with `ThemePreferenceSchema.safeParse()` — fall back to `'system'` if invalid
3. Resolve `activeTheme` from preference + `window.matchMedia('(prefers-color-scheme: dark)').matches`
4. Apply or remove `dark` class on `document.documentElement`

---

## Constants

```typescript
export const STORAGE_KEY = 'pubsub-dashboard:theme' as const;

export const THEME_CYCLE: readonly ThemePreference[] = ['dark', 'light', 'system'] as const;
// Used by ThemeToggle to cycle: dark → light → system → dark
```

---

## Anti-FOUC Inline Script (not a module — plain JS in index.html)

```javascript
// Runs synchronously during HTML parsing. No import/export.
(function () {
  try {
    var stored = localStorage.getItem('pubsub-dashboard:theme');
    var valid = stored === 'dark' || stored === 'light' || stored === 'system';
    var pref = valid ? stored : 'system';
    var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    var applyDark = pref === 'dark' || (pref === 'system' && prefersDark);
    if (applyDark) document.documentElement.classList.add('dark');
  } catch (_) {
    // Silently ignore (private browsing may block localStorage)
  }
})();
```

**Placement**: First child of `<head>` in `src/client/index.html` — before any `<link>` or `<script type="module">` tags.
