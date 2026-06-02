# Quickstart: Complete UX Redesign — "Kanagawa × Blade Runner"

**Feature**: `006-ux-redesign` · client-side only · no server/auth/boot change.

This quickstart shows how to run the redesigned dashboard locally and how to
verify each user story. It assumes the feature-001 boot path is intact (Google
ADC configured).

## Prerequisites

```bash
gcloud auth application-default login   # ADC (unchanged from feature 001)
node -v                                 # ≥ 20 LTS
npm ci
```

## Run locally

```bash
npm run dev        # Vite client + Hono watcher (two-process dev only)
# or the production single-process path:
npm run build && npx pubsub-dashboard
```

The app opens on `http://127.0.0.1:<port>` with the dark **Sumi-Ink** theme by
default. No third-party network request is made (fonts are self-hosted, FR-025).

## Verify the redesign (per user story)

### US1 — Everything still works, restyled (P1, MVP)
1. Select a project → browse/filter topics & subscriptions → set active topic &
   subscription.
2. Publish a message with an attribute → see the returned message ID.
3. Pull → copy a received message to publish → acknowledge.
4. Toggle light/dark (Sumi-Ink ⇄ Lotus-washi); reload → theme persists.
   - **Pass**: the full 002/003/005 flow completes with zero loss of capability
     (FR-002 / SC-001).

### US2 — Command palette (P1)
1. Press `⌘K` / `Ctrl+K` → palette opens, search focused.
2. Type part of a topic name → list filters with the match highlighted.
3. `ArrowDown`/`ArrowUp` to move, `Enter` to activate → topic becomes active and
   palette closes. `Esc` closes with no change.
   - **Pass**: navigate to any resource in ≤3 keystrokes after opening (SC-002).

### US3 — Workspace layouts (P2)
1. Open settings → switch Rail → Triptych → Console.
   - **Pass**: all panels remain present/functional; active selection and compose
     draft survive every switch (SC-003).

### US4 — Density & accent (P2)
1. Settings → change density (compact/regular/cozy) and accent
   (cyan/magenta/amber/violet) → applies immediately.
2. Reload → choices persist with no flash of wrong appearance (SC-004).

### US5 — Keyboard list nav + highlight (P2)
1. In Topics, type a filter → matched substring highlighted.
2. `↑/↓/Home/End` move the active row (kept in view); `Enter` selects; `Esc`
   clears the filter — all without the mouse.

### US6 — Live JSON highlighting (P2)
1. Composer JSON mode → type an object → keys/strings/numbers colored distinctly.
2. Make it invalid → publish stays blocked (feature-005 indicator).
   - **Pass**: published bytes are byte-for-byte the text shown (SC-005).

### US7 — Auto-poll (P3)
1. Active subscription → enable **Auto** → new messages arrive every 2.5 s with a
   visible active indicator; list caps at 60.
2. Disable Auto (or change subscription) → polling stops within one interval
   (SC-006).

### US8 — Orientation & feedback (P3)
1. Switch project via the header switcher → breadcrumb updates
   (Project · Topic · Subscription).
2. Copy-to-publish → a brief non-blocking flash appears and auto-dismisses.

## Automated verification

```bash
npm run typecheck    # tsc --noEmit (strict) — Principle III
npm run lint         # eslint, zero warnings
npm run test         # vitest + coverage ≥90% line AND branch — Principle II
npm run e2e          # Playwright: smoke (FR-002 no-regression) + palette + persistence
npm run verify       # all of the above (CI parity)
```

> Per house rule, do **not** run a build after changes unless explicitly asked;
> use `typecheck`/`test`/`e2e` to verify.

## Accessibility & local-first checks
- Enable OS "Reduce motion" → neon/scanline effects minimized; all controls remain
  keyboard-reachable with visible focus (SC-007).
- Confirm DevTools → Network shows **no** third-party request on load (SC-008).

## What did NOT change
- `src/server/**`, `src/shared/**`, `bin/**`, auth, boot path, and all API/Pub/Sub
  contracts are untouched (FR-026). No new runtime dependency was added.
