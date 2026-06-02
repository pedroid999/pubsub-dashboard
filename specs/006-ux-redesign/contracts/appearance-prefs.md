# Contract: Appearance Preferences & Settings Surface

**Modules**: `src/client/lib/appearance.ts` (NEW), `AppearanceSettings.tsx` (NEW),
`src/client/lib/theme.ts` (REUSE)
**Traces**: FR-003, FR-012, FR-013, FR-014, FR-015 · US4 · SC-004

## Persisted shape

- **A1** The persisted appearance (`localStorage["pubsub-dashboard:appearance"]`)
  holds exactly `{ density, accent, layout }`; theme stays under
  `localStorage["pubsub-dashboard:theme"]` (feature 004, unchanged).
- **A2** Reading appearance MUST validate via a `zod` schema; any missing/invalid
  field falls back to its default (`density='compact'`, `accent='cyan'`,
  `layout='rail'`, `theme='system'`) without throwing.

## Theme (FR-003)

- **A3** Default theme is dark (via `system` resolving, or explicit dark); toggling
  switches Sumi-Ink (dark) ⇄ Lotus-washi (light) and persists, exactly as
  feature 004.

## Density (FR-012)

- **A4** Given the settings surface, When the user selects a density
  (compact/regular/cozy), Then `data-density` updates on `<html>` and
  `--gap/--pad/--row-pad-y/--fs-base/--fs-label` change consistently across all
  panels.

## Accent (FR-013)

- **A5** Given the settings surface, When the user selects an accent
  (cyan/magenta/amber/violet), Then `data-accent` updates and `--accent` (focus,
  highlights, active states) updates everywhere the primary accent is used, in
  both themes.

## Layout (FR-010/FR-015)

- **A6** Given the settings surface, When the user selects a layout, Then the
  workspace reflows (see `searchable-list.md`/data-model) and the choice persists.

## Fixed defaults (FR-014)

- **A7** Neon intensity and scanlines/grain are NOT present in the settings
  surface and are NOT persisted; they render at a fixed default, minimized/disabled
  only under `prefers-reduced-motion` (FR-004).

## Persistence & first paint

- **A8** Given any appearance change, When the app is reloaded, Then theme,
  density, accent, and layout all persist (SC-004).
- **A9** Given persisted preferences, When the page first paints, Then the correct
  `data-theme/-density/-accent` are applied **before** React mounts (inline
  pre-hydration script) so there is no flash of the wrong appearance (SC-004).

## Reduced motion (FR-004 / SC-007)

- **A10** Given `prefers-reduced-motion: reduce`, When the app renders, Then
  animated/neon/scanline effects are minimized or disabled while all controls stay
  keyboard-reachable with visible focus.
