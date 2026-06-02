# Phase 1 Data Model: Complete UX Redesign — "Kanagawa × Blade Runner"

**Feature**: `006-ux-redesign` | **Date**: 2026-06-01

This redesign introduces **no server-side or persisted-on-disk data**. All
entities below are **client-side view/state models** held in React (providers /
reducers) or in `localStorage` (appearance only). No wire contract, Pub/Sub
schema, or `src/server/**` type changes (FR-026). Existing entities from features
002/003/005 (`Project`, `Topic`, `Subscription`, `ReceivedMessage`, compose draft)
are reused unchanged except for the explicitly noted `receivedMessages` cap.

---

## 1. AppearancePrefs (NEW — persisted)

The user's curated look-and-feel choices. Persisted to `localStorage` and applied
to `<html>` via `data-*` attributes. Extends the feature-004 preference store.

| Field | Type | Default | Notes |
|---|---|---|---|
| `theme` | `'dark' \| 'light' \| 'system'` | `'dark'` | Reuses the existing `ThemePreference` enum + key (`pubsub-dashboard:theme`) from `theme.ts`. **FR-003 override**: when **no** preference is stored, feature 006 resolves to **dark** ("Sumi Ink") on first paint — NOT feature-004's `'system'` fallback (which could resolve to light on a light OS, contradicting FR-003 / US1 AS1). The enum still allows the user to pick `light`/`system` explicitly. |
| `density` | `'compact' \| 'regular' \| 'cozy'` | `'compact'` | Drives `--gap/--pad/--row-pad-y/--fs-base/--fs-label` via `data-density` (FR-012). Compact is the developer-tool default. |
| `accent` | `'cyan' \| 'magenta' \| 'amber' \| 'violet'` | `'cyan'` | Drives `--accent` via `data-accent` (FR-013). |
| `layout` | `'rail' \| 'triptych' \| 'console'` | `'rail'` | Active workspace layout (FR-009/FR-010). |

**Excluded by design (FR-014)**: neon intensity and scanlines/grain are **not**
stored and **not** user-configurable — fixed tasteful defaults, subject only to
`prefers-reduced-motion`.

**Persistence**:
- Key `pubsub-dashboard:appearance` holds `{ density, accent, layout }` as JSON.
- Theme stays under `pubsub-dashboard:theme` (unchanged from feature 004).
- All reads pass through a `zod` schema with safe fallback to defaults on
  parse failure (Principle III; mirrors `ThemePreferenceSchema`).

**Validation rules**:
- Each field MUST be one of its enum members; any other/missing value → field
  default (no throw — corrupted storage must never break first paint).

**State transitions** (via `AppearanceProvider` reducer):

```
SET_DENSITY(d)  → density = d        (persist, set data-density)
SET_ACCENT(a)   → accent  = a        (persist, set data-accent)
SET_LAYOUT(l)   → layout  = l        (persist, set data-layout/grid)
SET_THEME(t)    → delegated to existing ThemeProvider (theme.ts)
RESET           → all fields to defaults (persist)
```

**First-paint application (FR-015 / SC-004)**: a synchronous pre-hydration inline
script reads both keys and sets `data-theme/-density/-accent` on `<html>` before
React mounts, preventing a flash of the wrong appearance.

---

## 2. WorkspaceLayout (NEW — value object)

A named arrangement of the resource / publisher / receiver panels. Not a stored
entity beyond `AppearancePrefs.layout`; modeled here as the contract that drives
the `App.tsx` grid shell.

| Layout | Grid | Panel arrangement |
|---|---|---|
| `rail` (default) | `290px 1fr` | Left column: Topics over Subscriptions (each own scroll). Right column: Publisher \| Receiver. |
| `triptych` | `1fr 1fr 1fr` | Tabbed Topics/Subscriptions panel \| Publisher \| Receiver. |
| `console` | rows `auto 1fr` | Top: Topics \| Subscriptions (~220px). Bottom: Publisher \| Receiver. |

**Invariants**:
- Switching layout MUST preserve active project/topic/subscription, the compose
  draft, and the pulled-message list (FR-010) — guaranteed by keeping all of that
  state in providers (`resourceContext`, `composeDraft`, `receivedMessages`),
  never in layout-specific subtrees.
- All three panels remain present and functional in every layout (US3).
- In `triptych`, the Topics and Subscriptions tabs keep **independent** filter and
  selection state (FR-011).

---

## 3. PaletteEntry (NEW — derived, in-memory)

A searchable, activatable reference to a project, topic, or subscription, built on
demand from the active project's resources (and the project list). Never persisted.

| Field | Type | Notes |
|---|---|---|
| `kind` | `'project' \| 'topic' \| 'subscription'` | Drives icon/color (project=amber `Layers`, topic=cyan `Hash`, subscription=magenta `Radio`). |
| `id` | `string` | Full resource name / projectId — the value passed to the selection action. |
| `label` | `string` | Primary display label (short name). |
| `parentLabel` | `string \| undefined` | Secondary label (e.g., topic's project, subscription's source topic). |
| `matchRange` | `{ start: number; end: number } \| null` | Highlight span against the current query (null when no query). |

**Behavior / rules (FR-006..FR-008)**:
- The flat list = active project's topics + subscriptions + all projects.
- Filtering matches `label` **and** `parentLabel`, case-insensitive; the matched
  substring is highlighted.
- **Navigation-only**: activating an entry dispatches the corresponding
  `resourceContext` action (`SELECT_PROJECT` / `SELECT_TOPIC` /
  `SELECT_SUBSCRIPTION`) and closes the palette. Entries MUST NOT represent global
  actions (theme/layout) or operations (publish/pull).
- Empty query result set → explicit empty state; Enter on empty does nothing.

---

## 4. SearchableListState (NEW — per-list view state)

Internal state of the rewritten `ResourceList` / `SearchableList`. One instance per
list (Topics, Subscriptions; and the palette reuses the same nav core). Not
persisted.

| Field | Type | Notes |
|---|---|---|
| `query` | `string` | Current filter text. |
| `filtered` | `Item[]` | Items matching `query` (with match ranges for highlight). |
| `activeIndex` | `number` | Highlighted row; clamped to `[0, filtered.length-1]`. |
| `activeRef` | `Ref<number>` | Mirror of `activeIndex` read by key handlers (Decision 2 — avoids stale-closure mis-select). |

**Transitions / rules (FR-016/FR-017)**:
- `query` change → recompute `filtered`, reset `activeIndex` to 0, re-clamp ref.
- `ArrowDown/ArrowUp` → move active by ±1, clamped; scroll active row into view via
  manual `scrollTop` (never `scrollIntoView`).
- `Home/End` → first/last.
- `Enter` → select `filtered[activeRef.current]` via `onSelect(item)`.
- `Escape` → if `query` non-empty, clear it (stop propagation); else no-op.
- `MouseEnter` on a row → sets `activeIndex` (hover and keyboard share state).
- Two lists keep independent `query`/`activeIndex` (Topics vs Subscriptions, FR-016).

---

## 5. JsonToken (NEW — derived, in-memory)

The output of the pure `jsonHighlight.ts` tokenizer that feeds the composer
overlay. Display-only; never affects published bytes (FR-019/SC-005).

| Field | Type | Notes |
|---|---|---|
| `type` | `'key' \| 'string' \| 'number' \| 'boolean' \| 'null' \| 'punctuation' \| 'plain'` | Maps to `.tok-*` CSS classes / accent colors. |
| `value` | `string` | The exact raw substring (no reformatting). |

**Rules**:
- Tokenizing concatenated `value`s MUST reproduce the input string exactly
  (char-for-char), so the overlay `<pre>` aligns with the `<textarea>`.
- Tokenization is independent of validity: malformed JSON still renders
  best-effort tokens; the feature-005 validity indicator/publish-block is
  unaffected (FR-018).
- Only applied in JSON mode; plain-text mode emits no highlighting (FR-019).

---

## 6. ReceivedMessagesState (EDIT — add 60-cap)

Reuses the existing `receivedMessages` reducer (feature 003/005) with one change to
honor FR-020.

| Aspect | Before | After |
|---|---|---|
| `APPEND` | concatenates all pulled messages, unbounded | concatenates, then **keeps only the 60 newest** (drops oldest beyond cap) |
| `CLEAR` | empties list | unchanged — still empties |
| `MARK_ACKNOWLEDGED` | flags by `ackId` | unchanged |

**Rules**:
- Cap constant = **60** (FR-020). Applies to both manual pull and auto-poll
  appends (US7 AS1).
- Acknowledged flag and per-subscription isolation (feature-003 FR-023) preserved;
  changing the active subscription still resets the list.

---

## 7. AutoPollState (NEW — receiver-local)

In-component state for the opt-in auto-poll loop (not persisted, not a reducer
entity — documented for completeness).

| Field | Type | Notes |
|---|---|---|
| `enabled` | `boolean` | Auto toggle; shows a pulsing active indicator when true (FR-020). |
| `intervalId` | `ReturnType<typeof setInterval> \| null` | The 2.5 s timer; cleared on toggle-off / subscription change / unmount. |
| `paused` | `boolean` | Set true after a failed auto-pull; surfaces the error and stops retrying (FR-021). |

**Lifecycle rules (FR-021 / SC-006)**:
- Start: `setInterval(pull, 2500)` only when `enabled` and an active subscription
  exists.
- Stop conditions (all clear the interval): explicit toggle-off, active
  subscription change, leaving the receiver context (unmount).
- Never polls without the visible active indicator; never retries indefinitely on
  error.

---

## Relationships

```
AppearanceProvider ──persists──> localStorage[:appearance]   (density, accent, layout)
ThemeProvider      ──persists──> localStorage[:theme]        (theme)         [feature 004, reused]
        │
        └─ sets data-theme/-density/-accent/-layout on <html> ─> CSS tokens drive every panel

App.tsx (layout shell) ── reads AppearancePrefs.layout ──> WorkspaceLayout grid
        ├── ResourceList(Topics)        ─ SearchableListState ─┐
        ├── ResourceList(Subscriptions) ─ SearchableListState ─┤ both dispatch ─> resourceContext
        ├── CommandPalette ─ PaletteEntry[] ──────────────────┘ (SELECT_PROJECT/TOPIC/SUBSCRIPTION)
        ├── MessagePublisher ─ uses jsonHighlight(JsonToken[]) over composeDraft.body
        └── MessageReceiver  ─ AutoPollState + ReceivedMessagesState(cap 60) ─ messaging.pull/ack
```

All selection still flows through the **existing** `resourceContext` reducer, so
the redesigned surfaces and the live data behave identically to features 002–005
(FR-002).
