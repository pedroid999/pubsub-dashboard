# Implementation Plan: Complete UX Redesign — "Kanagawa × Blade Runner"

**Branch**: `006-ux-redesign` | **Date**: 2026-06-01 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/006-ux-redesign/spec.md`

## Summary

Re-skin and enrich the entire dashboard with a "Kanagawa × Blade Runner" visual
language (Sumi-Ink dark + Lotus-washi light themes, neon accents, JP signage,
HUD framing) while preserving **every** shipped capability from features 002–005
with zero behavioral regression (FR-002). On top of the re-skin, deliver six
net-new interaction patterns: a navigation-only ⌘K **command palette**, three
switchable **workspace layouts** (Rail / Triptych / Console), an **appearance
settings surface** (theme + density + accent + layout, persisted), **keyboard
navigation + match highlighting** in resource lists, **live JSON syntax
highlighting** in the composer, and an opt-in **2.5 s auto-poll** in the receiver
capped at the 60 newest messages.

**Technical approach** (from research): the work is **client-side only** (FR-026)
— no server, schema, auth, or boot-path change. Design tokens move into
`tailwind.config.ts` + `src/client/styles.css` as CSS custom properties keyed by
`data-theme` / `data-density` / `data-accent` on `<html>`. The existing
`<textarea>`-based composer (the repo ships **no** CodeMirror/Monaco — verified)
gains a display-only highlight overlay, consistent with the shipped feature-005
design. `ResourceList` is rewritten into a keyboard-navigable `SearchableList`
(ref-based active index to avoid stale-closure mis-selects). A new
`CommandPalette` and an `AppearanceProvider` (extending the feature-004
preference pattern) round out the work. Fonts are **self-hosted** to honor the
local-first / no-CDN constraint (FR-025).

## Technical Context

**Language/Version**: TypeScript 5.6+ (`strict: true`, `noUncheckedIndexedAccess`), Node.js ≥ 20 LTS — unchanged from features 001–005.

**Primary Dependencies**:
- Existing (reused): React 18, Vite 5, Tailwind CSS 3.4, `lucide-react` (already a devDependency — provides every icon the design names: Search, Send, Hash, Radio, Command, Zap, Layers, Wand2, Download, Copy, Check, Moon, Sun, Settings, …), `zod`. Hono/`@google-cloud/pubsub` server is **untouched**.
- **New runtime dependencies: NONE.** Syntax highlighting is a hand-rolled tokenizer + overlay (no editor library); fonts are self-hosted static assets, not a package.

**Storage**: Browser `localStorage` only, reusing the feature-004 client preference pattern (`pubsub-dashboard:theme` → add `:appearance`). No server-side file, DB, or remote state. In-session UI state (palette open, received-message list, compose draft) stays in React state as today.

**Testing**: `vitest` + `@vitest/coverage-v8` (≥90% line AND branch, CI-blocking) for pure cores (filter/highlight tokenizer, JSON highlight tokenizer, appearance reducer, message-cap logic) and component tests via `@testing-library/react` (keyboard nav, palette, auto-poll with fake timers); `@playwright/test` E2E extending the existing smoke flow to assert no regression + palette navigation + theme persistence.

**Target Platform**: Local-only browser app served by the single Hono process bound to `127.0.0.1` (unchanged).

**Project Type**: Single-process Node web app (Hono API + Vite-built React client). Single project structure.

**Performance Goals**: Preserve the < 3 s cold-start budget and the bundle-size CI gate — adding **zero** runtime deps is the primary lever. Keystroke-time work (filter, JSON tokenize, scroll-into-view) must be imperceptible at typical Pub/Sub scales (no virtualization, per feature 002). Auto-poll fixed at 2.5 s. Honor `prefers-reduced-motion`.

**Constraints**: No new server endpoint, Pub/Sub operation, auth-path, or boot-path change (FR-026). No third-party runtime network request — fonts/assets served locally (FR-025), CSP unaffected. Palette is navigation-only (FR-006). Neon intensity + scanlines are fixed defaults, not user-configurable (FR-014).

**Scale/Scope**: ~4 new client modules (`appearance.ts`, `searchListNav.ts`, `jsonHighlight.ts`, `CommandPalette.tsx`) + `AppearanceProvider`/settings surface; rewrites of `App.tsx` (layout shell), `ResourceList.tsx` (→ SearchableList), `MessagePublisher.tsx` (highlight overlay), `MessageReceiver.tsx` (auto-poll + render), `ContextIndicator.tsx`/header (orientation); token changes in `tailwind.config.ts` + `styles.css`. One message under composition; receive list capped at 60 (new FR-020 cap).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|---|---|---|
| **I. Local-First & Zero-Config** | ✅ PASS | No remote backend, telemetry, or new config. All logic runs in the browser. Fonts **self-hosted** (no runtime CDN) per FR-025 → preserves the no-outbound posture and `127.0.0.1` binding. |
| **II. Test-First (NON-NEGOTIABLE)** | ✅ PASS (planned) | All net-new logic isolated as pure functions/reducers (`appearance` reducer, list-nav clamp/move, JSON tokenizer, 60-cap) → unit-tested first to ≥90% branch (Red-Green-Refactor). Component tests for keyboard nav, palette, auto-poll (fake timers). Playwright extends the smoke flow to prove FR-002 no-regression + palette + persistence. |
| **III. Type Safety End-to-End** | ✅ PASS | `strict: true` maintained, no new `any`. New types (`AppearancePrefs`, `Density`, `Accent`, `WorkspaceLayout`, `PaletteEntry`, `JsonToken`) explicit; persisted appearance validated through a `zod` schema before use (same pattern as `ThemePreferenceSchema`). No wire-contract change. |
| **IV. Instant Developer Experience** | ✅ PASS | Zero new runtime deps protects the < 3 s cold start and bundle gate. Persisted theme/appearance applied on first paint (pre-hydration inline script) to avoid wrong-appearance flash (FR-015/SC-004). No boot/quickstart change. |
| **V. Operational Excellence (Obs/Sec/Simplicity)** | ✅ PASS | **Security**: no new network surface; CSP unaffected; self-hosted fonts. **Simplicity/YAGNI**: highlighting is a lightweight overlay (no editor lib — explicitly permitted by constitution v1.1.0); UI preferences via `localStorage` with `zod` validation (permitted by constitution v1.1.0); customization is a curated subset (theme/density/accent/layout) — neon/scanlines fixed (FR-014). **Dependencies**: none added → no Principle-V justification required. |

**Result**: PASS. Both prior tensions (textarea highlight overlay; `localStorage` UI preferences) are now codified in **constitution v1.1.0** — no remaining deviations or violations.

## Project Structure

### Documentation (this feature)

```text
specs/006-ux-redesign/
├── plan.md              # This file (/speckit.plan output)
├── spec.md              # Feature specification (input)
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (UI/interaction contracts)
│   ├── command-palette.md
│   ├── appearance-prefs.md
│   ├── searchable-list.md
│   └── receiver-autopoll.md
└── tasks.md             # Phase 2 output (/speckit.tasks — NOT created here)
```

### Source Code (repository root)

```text
src/client/
├── App.tsx                       # REWRITE: layout shell (rail/triptych/console), header, context bar
├── styles.css                    # EDIT: design tokens (CSS vars), scanline/grain overlay, fonts @font-face
├── lib/
│   ├── theme.ts                  # REUSE: dark/light/system (feature 004)
│   ├── appearance.ts             # NEW: AppearancePrefs schema + reducer + provider hook (density/accent/layout)
│   ├── searchListNav.ts          # NEW: pure keyboard-nav core (clamp/move, active index)
│   ├── jsonHighlight.ts          # NEW: pure JSON tokenizer for the overlay
│   ├── resourceContext.ts        # REUSE: project/topic/subscription selection
│   ├── composeDraft.ts           # REUSE: publish draft + copy-to-publish
│   ├── receivedMessages.ts       # EDIT: APPEND caps at 60 newest (FR-020)
│   ├── resourceFilter.ts         # REUSE/EXTEND: filter + match-range for highlight
│   └── messaging.ts              # REUSE: publish/pull/ack
├── components/
│   ├── CommandPalette.tsx        # NEW: ⌘K navigation-only palette
│   ├── AppearanceSettings.tsx    # NEW: settings surface (theme/density/accent/layout)
│   ├── ResourceList.tsx          # REWRITE: SearchableList (filter + bounded scroll + keyboard + highlight)
│   ├── MessagePublisher.tsx      # EDIT: JSON highlight overlay (display-only)
│   ├── MessageReceiver.tsx       # EDIT: auto-poll toggle + highlighted render + 60-cap
│   ├── ContextIndicator.tsx      # EDIT: breadcrumb (Project · Topic · Subscription)
│   ├── ThemeToggle.tsx           # REUSE
│   └── …                         # other existing components restyled
└── ...

tests/
├── unit/                         # pure cores + component tests (vitest, ≥90%)
├── integration/                  # API-boundary tests (unchanged server)
└── e2e/                          # Playwright smoke + redesign flows
```

**Structure Decision**: Single-project web app (Hono + React), unchanged from
features 001–005. All redesign work lands under `src/client/**` and `tests/**`;
`src/server/**`, `src/shared/**`, and `bin/**` are untouched (FR-026).

## Complexity Tracking

> No outstanding deviations. The two tensions flagged during `/speckit.analyze`
> (textarea highlight overlay vs. Monaco/CodeMirror; `localStorage` vs. the
> `~/.config` preferences file) were resolved by amending the constitution to
> **v1.1.0**, which now explicitly permits a display-only highlight overlay over a
> native `<textarea>` and `localStorage` for client-only UI presentation
> preferences. Both choices add zero runtime dependencies and remain local-first.

| Deviation | Status |
|-----------|--------|
| _(none)_ | Constitution Check passes with no justified violations. |
