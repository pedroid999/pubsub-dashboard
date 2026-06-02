# Phase 0 Research: Complete UX Redesign — "Kanagawa × Blade Runner"

**Feature**: `006-ux-redesign` | **Date**: 2026-06-01

The Technical Context has **no open `NEEDS CLARIFICATION`** items (the spec's four
clarifications are already resolved, and the design handoff in
`.claude/redesign/.../design_handoff_pubsub_redesign/README.md` is hi-fi). This
document records the technology/approach decisions that anchor Phase 1, each with
rationale and the alternatives rejected.

---

## Decision 1 — Live JSON highlighting: textarea + overlay, NOT an editor library

**Decision**: Render the composer body as a `<textarea>` with transparent text
(`color: transparent; caret-color: var(--accent)`) layered over an absolutely
positioned `<pre>` that displays the tokenized, colored copy of the same string.
A pure `jsonHighlight.ts` tokenizer produces the colored spans; the textarea
remains the single source of truth for the bytes published.

**Rationale**:
- **Matches reality**: the repo currently ships a plain `<textarea>` in
  `MessagePublisher.tsx` — there is **no** CodeMirror/Monaco in `package.json`
  (verified). The redesign continues the shipped approach.
- **FR-019 / SC-005**: highlighting must be display-only and never alter the
  published bytes. An overlay over the real textarea guarantees byte-for-byte
  fidelity — the colored layer is never read for submission.
- **Principle IV / V**: zero new runtime dependency keeps the < 3 s cold-start
  and bundle-size CI gates intact and needs no Principle-V dependency
  justification.

**Alternatives considered**:
- *CodeMirror 6 / Monaco* (the constitution's named editor primitive): rejected —
  large runtime dependency, bundle/cold-start risk, and overkill for a
  display-only highlight. Tracked as a documented deviation in `plan.md`.
- *`contentEditable` rich editor*: rejected — caret/IME/paste handling is
  notoriously fragile and would risk altering bytes (violates FR-019).

**Implementation notes (from handoff)**: `<pre>` and `<textarea>` MUST share
identical font, font-size (12.5px), line-height (1.55), padding (10px 11px),
`white-space: pre`, `tab-size: 2`; sync `pre.scrollTop = textarea.scrollTop` on
scroll. Tokenize the **raw** text (no reformat) so the overlay stays aligned
char-for-char. Token classes: `.tok-key/.tok-str/.tok-num/.tok-bool/.tok-null/.tok-punct`.

---

## Decision 2 — Keyboard list navigation uses a ref-backed active index

**Decision**: `SearchableList` keeps the active row index in **both** `useState`
(for render) and a `useRef` (for handlers). Arrow/Home/End/Enter handlers
read/write the ref; a `filteredRef` mirrors the current filtered array. Scroll the
active row into view by computing `offsetTop`/`offsetHeight` and setting
`container.scrollTop` manually — never `scrollIntoView`.

**Rationale**:
- **The original bug (handoff §Navegación por teclado GOTCHA)**: fast successive
  keypresses within one React tick capture a stale `state` closure, so `Enter`
  selects the wrong item. Reading the ref eliminates the stale-closure mis-select.
- **`scrollIntoView` is rejected** because it can scroll ancestor containers and
  produce jarring page jumps; manual `scrollTop` keeps the active row in view
  inside the bounded panel only (FR-017, edge case "very long resource lists").
- The pure clamp/move logic lives in `searchListNav.ts` so it can be unit-tested
  to ≥90% branch without a DOM.

**Alternatives considered**:
- *State-only active index*: rejected — reproduces the original keyboard bug.
- *A list/combobox library*: rejected — new dependency for behavior we fully
  specify; also harder to match the exact filter+highlight+bounded-scroll combo.

---

## Decision 3 — Design tokens as CSS custom properties + Tailwind `extend`

**Decision**: Define all palette/typography/spacing tokens as CSS custom
properties in `src/client/styles.css`, scoped by `:root[data-theme="dark|light"]`,
`[data-density="compact|regular|cozy"]`, and `[data-accent="cyan|magenta|amber|violet"]`
on `<html>`. Surface the tokens to Tailwind via `theme.extend` (colors/fontFamily/
spacing reference `var(--…)`), keeping Tailwind utility ergonomics the team uses.

**Rationale**:
- One source of truth; theme/density/accent switch by flipping a single
  attribute on `<html>` with no React re-render of the tree (CSS does the work).
- Reuses the existing Tailwind `darkMode: 'class'` mechanism — map `data-theme`
  to the `dark` class so existing `dark:` utilities keep working during the
  incremental restyle (FR-002 no-regression safety).
- Matches the handoff's explicit token tables (dark/light palettes, radii, glows,
  spacing scales per density).

**Alternatives considered**:
- *Tailwind-only (no CSS vars)*: rejected — accent/density are runtime-switchable
  per user; encoding 4 accents × 3 densities × 2 themes as static utilities
  explodes the config and the bundle.
- *CSS-in-JS / styled-components*: rejected — new dependency, runtime cost, and
  divergence from the established Tailwind convention.

---

## Decision 4 — Appearance persistence extends the feature-004 localStorage pattern

**Decision**: Store the curated appearance subset (theme, density, accent,
layout) under a single `localStorage` key (`pubsub-dashboard:appearance`),
validated by a `zod` schema with safe fallbacks — mirroring
`ThemePreferenceSchema` / `STORAGE_KEY` in `theme.ts`. Theme keeps its existing
key. Apply persisted values on first paint via a tiny inline pre-hydration script
that sets the `data-*` attributes before React mounts.

**Rationale**:
- **Principle V (Simplicity/YAGNI + no DB)** and the spec's "reuse the feature-004
  single preference store" assumption — no server file, no remote state.
- **FR-015 / SC-004 (no flash of wrong appearance)**: setting `data-*` before
  first paint avoids the FOUC; the inline script reads localStorage synchronously.
- `zod` validation guards against corrupted/old values (Principle III).

**Alternatives considered**:
- *Server-side JSON file under `~/.config/pubsub-dashboard/`* (constitution
  Principle V wording): rejected for this feature — feature 004 already
  established client `localStorage` for preferences; introducing a server
  read/write path would violate FR-026 ("no boot/auth path change") and add a new
  endpoint. Consistency with the shipped preference store wins.
- *In-memory only*: rejected — fails the persistence requirement (FR-015).

---

## Decision 5 — Self-hosted fonts (no runtime CDN)

**Decision**: Bundle Space Grotesk (UI/titles), JetBrains Mono (data/IDs), and
Zen Kaku Gothic New (JP accents) as local static assets served by the Hono static
layer, declared via `@font-face` in `styles.css`. No `<link>` to Google Fonts at
runtime.

**Rationale**:
- **FR-025 / SC-008 / Principle I**: the app is local-first with no third-party
  runtime network request; a Google Fonts `<link>` would be an outbound CDN
  dependency and break the no-outbound posture and CSP.
- Self-hosting also removes a first-paint latency/availability dependency,
  protecting the < 3 s cold-start (Principle IV).

**Alternatives considered**:
- *Google Fonts CDN `<link>`*: rejected — violates FR-025 (no runtime CDN).
- *System-font fallback only*: rejected — the design is hi-fi and the typeface
  trio is part of the brand identity; we keep a sensible fallback stack but ship
  the real faces locally.

---

## Decision 6 — Command palette is a self-contained navigation-only overlay

**Decision**: A new `CommandPalette.tsx` mounts a fixed `inset:0` overlay
(backdrop blur, centered panel) toggled by a global `keydown` listener for
`(metaKey||ctrlKey) && key==='k'` (with `preventDefault`). It flattens the active
project's projects + topics + subscriptions into one searchable list, reusing the
same ref-backed keyboard core as `SearchableList`. Enter dispatches the existing
`resourceContext` selection actions and closes; Esc / outside-click closes with no
side effects.

**Rationale**:
- **FR-005..FR-008**: global open, keyboard-operable, navigation-only (selects
  resources, dispatches no global actions or operations), explicit empty state.
- Reuses `resourceContext` dispatch (`SELECT_PROJECT/TOPIC/SUBSCRIPTION`) — no new
  state machine, no behavioral divergence from clicking in the lists (FR-002).
- Shares the Decision-2 nav core → one tested implementation, two surfaces.

**Alternatives considered**:
- *A command framework (e.g., `cmdk`)*: rejected — new dependency; our palette is
  navigation-only and small enough to own, and we already need the same keyboard
  core for lists.

---

## Decision 7 — Receiver auto-poll: `setInterval` with strict lifecycle + 60-cap

**Decision**: An opt-in **Auto** toggle starts `setInterval(pull, 2500)`. The
interval is cleared on toggle-off, on active-subscription change, and on unmount
(leaving the receiver context). A failed auto-pull surfaces the error (feature-003
handling) and pauses the loop rather than retrying. The running list is capped at
the **60 newest** messages (oldest dropped); explicit **Clear** still empties it —
implemented in the `receivedMessages` reducer's `APPEND` branch.

**Rationale**:
- **FR-020 / FR-021 / SC-006**: fixed 2.5 s interval, always-visible active
  indicator, no invisible polling, bounded memory via the 60-cap.
- Centralizing the cap in the pure reducer makes it unit-testable and keeps the
  component thin. Lifecycle cleanup via `useEffect` return + dependency on the
  active subscription id prevents cross-subscription message mixing (FR-021,
  feature-003 FR-023).

**Alternatives considered**:
- *Long-poll / SSE / WebSocket streaming*: rejected — requires server changes
  (violates FR-026) and is out of scope; fixed-interval pull reuses the existing
  pull endpoint unchanged.
- *Uncapped list*: rejected — unbounded memory growth on a long-running Auto
  session; the spec fixes the cap at 60.

---

## Decision 8 — Three layouts via a CSS-grid shell driven by one `layout` value

**Decision**: `App.tsx` becomes a single-page (`100vh`, `overflow:hidden`) shell
whose body grid is selected by the persisted `layout` value: **Rail**
(`290px 1fr`, resources stacked left, publisher/receiver right — DEFAULT),
**Triptych** (`1fr 1fr 1fr`, tabbed resources | publisher | receiver), **Console**
(rows `auto 1fr`, resources on top, publisher/receiver beneath). The same panel
components render in every layout; only the grid container changes.

**Rationale**:
- **FR-009..FR-011**: same panels rearranged; switching never unmounts panels, so
  active selection, compose draft, and pulled list survive the reflow (FR-010,
  edge case "layout switch mid-compose") because state lives in providers, not in
  layout-specific subtrees.
- Pure CSS grid keeps switching instantaneous (SC-003) with no data movement.
- Triptych's tabbed resources keep independent topic/subscription filters
  (FR-011) by preserving each `SearchableList`'s own filter state.

**Alternatives considered**:
- *Separate component trees per layout*: rejected — remounting would drop local
  state and risk losing the draft/selection (violates FR-010); also triples the
  surface area to keep in sync.
- *A drag-and-drop dock/grid library*: rejected — new dependency and far beyond
  the three fixed arrangements the spec requires (YAGNI).

---

## Resolved unknowns summary

| Topic | Resolution |
|---|---|
| JSON highlighting tech | Hand-rolled tokenizer + textarea/overlay (no editor lib) — Decision 1 |
| Keyboard list nav correctness | Ref-backed active index + manual `scrollTop` — Decision 2 |
| Theming mechanism | CSS custom properties keyed by `data-*` + Tailwind `extend` — Decision 3 |
| Appearance persistence | `localStorage` + `zod`, extends feature 004; pre-paint apply — Decision 4 |
| Fonts / no-CDN | Self-hosted `@font-face` static assets — Decision 5 |
| Command palette | Self-owned navigation-only overlay reusing nav core — Decision 6 |
| Auto-poll | `setInterval(2500)` strict lifecycle + 60-cap in reducer — Decision 7 |
| Layout switching | One CSS-grid shell, state in providers — Decision 8 |
| New runtime dependencies | **None** |
