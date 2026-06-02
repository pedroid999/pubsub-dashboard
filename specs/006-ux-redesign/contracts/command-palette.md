# Contract: Command Palette (⌘K)

**Component**: `src/client/components/CommandPalette.tsx` (NEW)
**Traces**: FR-005, FR-006, FR-007, FR-008 · US2

## Scope

Navigation-only palette. It **selects** a project / topic / subscription by
dispatching existing `resourceContext` actions. It MUST NOT expose global actions
(theme, layout) or resource operations (publish, pull, ack).

## Open / close

- **C1** Given the app is focused, When the user presses `⌘K` (macOS) or `Ctrl+K`
  (other), Then the palette opens centered with the search input focused, and the
  default browser behavior is prevented.
- **C2** Given the palette is open, When the user presses the same shortcut again,
  Then it toggles closed.
- **C3** Given the palette is open, When the user presses `Escape` OR clicks the
  backdrop/outside the panel, Then it closes and **no** selection changes.

## Contents & filtering

- **C4** Given an active project, When the palette opens, Then it lists that
  project's topics and subscriptions plus all projects, each row showing a
  kind icon/color (project=amber, topic=cyan, subscription=magenta), a primary
  label, a secondary/parent label, and a kind tag.
- **C5** Given a typed query, When filtering runs, Then rows whose `label` OR
  `parentLabel` match (case-insensitive) are shown and the matched substring is
  highlighted; non-matching rows are hidden.
- **C6** Given a project with no topics/subscriptions, When resource entries are
  queried, Then the palette still opens and shows projects (and an empty state for
  the empty resource section).

## Keyboard operation

- **C7** Given filtered results, When the user presses `ArrowDown`/`ArrowUp`, Then
  the active row moves (clamped to bounds) and is kept scrolled into view.
- **C8** Given an active row, When the user presses `Enter`, Then the active
  item is activated — `SELECT_PROJECT` | `SELECT_TOPIC` | `SELECT_SUBSCRIPTION` is
  dispatched with the correct id — and the palette closes.
- **C9** Given a query with **no** matches, When the user presses `Enter`, Then
  nothing happens (no dispatch, palette stays open) and an explicit empty state is
  shown.

## Correctness

- **C10** Given rapid successive keypresses within one render tick, When `Enter`
  fires, Then the item activated is the one indicated by the active **ref** (not a
  stale state closure) — i.e., the visually highlighted row.

## Non-goals (assert absence)

- **C11** The palette MUST contain no entries that toggle theme, change layout,
  publish, pull, or acknowledge (navigation-only, FR-006).
