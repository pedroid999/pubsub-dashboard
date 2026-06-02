---
description: "Task list for feature 006 — Complete UX Redesign (Kanagawa × Blade Runner)"
---

# Tasks: Complete UX Redesign — "Kanagawa × Blade Runner"

**Input**: Design documents from `/specs/006-ux-redesign/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: INCLUDED and MANDATORY — Constitution Principle II (Test-First, NON-NEGOTIABLE): ≥90% line AND branch coverage, component tests, and a Playwright E2E smoke on every PR. Write tests FIRST and ensure they FAIL before implementing.

**Organization**: Tasks are grouped by user story (P1→P3 from spec.md) so each story is independently implementable and testable.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: US1..US8 (maps to spec.md user stories)
- All paths are repository-relative (single-project web app: `src/client/**`, `tests/**`)

## Scope guardrails (apply to every task)

- **Client-only**: do NOT touch `src/server/**`, `src/shared/**`, `bin/**`, auth, boot, or any API/Pub/Sub schema (FR-026).
- **Zero new runtime dependencies** (Principle IV/V). Icons via existing `lucide-react`; fonts self-hosted (FR-025).
- **Preserve all feature 002–005 behavior** (FR-002) — restyle, never remove.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Bring in the visual-system assets the whole redesign depends on.

- [X] T001 [P] Add self-hosted font files (Space Grotesk, JetBrains Mono, Zen Kaku Gothic New — woff2, required weights) under `src/client/assets/fonts/` and confirm Vite serves them locally (no CDN, FR-025)
- [X] T002 [P] Add a unit guard `tests/unit/assets.fonts.test.ts` asserting the expected font files exist and that `styles.css` references only local `url(...)` (no `fonts.googleapis.com` / `gstatic`) — must FAIL before T010

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The design-token system + theme wiring that EVERY restyled surface needs.

**⚠️ CRITICAL**: No user story work begins until this phase is complete.

- [X] T003 [P] Define the dark ("Sumi Ink") and light ("Lotus") token sets as CSS custom properties in `src/client/styles.css`, scoped by `:root[data-theme="dark|light"]` (palette, `--line*`, `--fg*`, neon vars, `--danger/--success/--warn`, radii, glows) per data-model + handoff token tables
- [X] T004 [P] Add density tokens (`--gap/--pad/--row-pad-y/--fs-base/--fs-label`) scoped by `[data-density="compact|regular|cozy"]` and accent mapping (`--accent`) scoped by `[data-accent="cyan|magenta|amber|violet"]` in `src/client/styles.css`
- [X] T005 Extend `tailwind.config.ts` `theme.extend` (colors/fontFamily/spacing) to reference the CSS vars, keeping `darkMode: 'class'` so existing `dark:` utilities keep working during the incremental restyle
- [X] T006 [P] Add the fixed ambient layer in `src/client/styles.css`: scanlines/grain `.fx-overlay`, HUD corner `.ticks`, `.rise` entrance keyframes — all gated by `@media (prefers-reduced-motion: reduce)` (FR-004/FR-014); do NOT animate opacity on entrance
- [X] T007 Extend `src/client/lib/theme.ts` so applying a theme also sets `data-theme` on `<html>` (in addition to the existing `dark` class), preserving the feature-004 `dark/light/system` contract; **and change the no-stored-preference fallback from `'system'` to `'dark'`** so first paint is Sumi-Ink dark (FR-003 / US1 AS1 — resolves analyze finding N1)
- [X] T008 [P] Add a pre-hydration inline script in `src/client/index.html` that synchronously reads `localStorage["pubsub-dashboard:theme"]` and `["pubsub-dashboard:appearance"]` and sets `data-theme/-density/-accent` on `<html>` before React mounts, defaulting to **dark** when no theme is stored (FR-003/FR-015/SC-004 no-flash)
- [X] T009 [P] Unit test `tests/unit/client.theme.test.ts` (extend existing) asserting `data-theme` is set alongside the `dark` class for each preference, AND that the no-stored-preference default resolves to **dark** (N1) — must FAIL before T007

**Checkpoint**: Tokens, fonts, theme attributes, ambient layer, and no-flash bootstrap are ready.

---

## Phase 3: User Story 1 — Redesigned dashboard, all capabilities intact (Priority: P1) 🎯 MVP

**Goal**: Re-skin header, context bar, resource panels, publisher, receiver into the new language with the default **Rail** layout; bound resource-list height so editors stay visible; preserve every 002/003/005 flow + light/dark.

**Independent Test**: Complete select project → topic & subscription → publish w/ attribute → pull → copy-to-republish → acknowledge, and toggle light/dark — zero loss of capability (SC-001).

### Tests for User Story 1 (write first, must FAIL)

- [X] T010 [P] [US1] E2E regression `tests/e2e/us1-redesign-smoke.spec.ts`: full 002/003/005 round-trip against the redesigned UI + dark default + light toggle persistence (FR-002/FR-003)
- [X] T011 [P] [US1] Component test `tests/unit/client.App.test.tsx` (extend) asserting the Rail grid renders header + context bar + Topics/Subscriptions panels + Publisher + Receiver simultaneously, editors visible with a topic selected
- [X] T012 [P] [US1] Component test `tests/unit/ResourceList.test.tsx` (extend) asserting each list has a bounded-height scroll container (does not push siblings off-screen)

### Implementation for User Story 1

- [X] T013 [US1] Rewrite `src/client/App.tsx` into the single-page shell (`100vh`, `overflow:hidden`): header zone, context bar zone, body zone with the **Rail** grid (`290px 1fr`; left = Topics over Subscriptions, right = Publisher | Receiver) using `.panel`/`.ticks`
- [X] T014 [P] [US1] Restyle `src/client/components/ResourceList.tsx` with bounded-height scroll + new panel/row styling (cyan for topics, magenta for subs) — keep current selection behavior (full keyboard rewrite is US5)
- [X] T015 [P] [US1] Restyle `src/client/components/ResourceBrowser.tsx` (panel headers "TOPICS"/"SUBSCRIPTIONS" + JP tags トピック/サブスク + count chips, meta: retention / backlog / delivery type) preserving feature-002 filtering & selection
- [X] T016 [P] [US1] Restyle `src/client/components/MessagePublisher.tsx` shell (segmented TEXT/JSON, Format, validity indicator, attribute rows, fixed primary footer button) — preserve all feature-003/005 behavior; highlight overlay deferred to US6
- [X] T017 [P] [US1] Restyle `src/client/components/MessageReceiver.tsx` shell (Pull/Clear toolbar, message cards with magenta left border, acked = green, attribute chips, Copy/Acknowledge) — preserve feature-003/005 behavior; auto-poll deferred to US7
- [X] T018 [P] [US1] Restyle `src/client/components/ProjectBrowser.tsx` and `DiagnosticsPanel.tsx`/`SessionBadge.tsx` to the new tokens
- [X] T019 [US1] Mount the `.fx-overlay` (scanlines/grain) and ensure the dark "Sumi Ink" theme is the first-paint default via the bootstrap from T008

**Checkpoint**: MVP — the redesigned dashboard does everything the old one did, restyled. STOP and validate.

---

## Phase 4: User Story 2 — Command palette (Priority: P1)

**Goal**: ⌘K / Ctrl+K navigation-only palette over projects/topics/subscriptions.

**Independent Test**: ⌘K → type → arrows → Enter selects the resource; Esc closes with no side effects; ≤3 keystrokes to any resource (SC-002).

### Tests for User Story 2 (write first, must FAIL)

- [X] T020 [P] [US2] Unit test `tests/unit/searchListNav.test.ts` for the pure nav core (clamp, move ±1, Home/End absolute, empty-list → 0, out-of-range clamp) — ≥90% branch
- [X] T021 [P] [US2] Component test `tests/unit/CommandPalette.test.tsx` covering contracts C1–C11 (open/close, filter+highlight, arrows, Enter dispatch per kind, empty state, ref-based correctness on rapid keys, no action/operation entries)
- [X] T022 [P] [US2] E2E `tests/e2e/us2-command-palette.spec.ts`: open with ⌘K, filter a topic, Enter activates it, Esc closes

### Implementation for User Story 2

- [X] T023 [P] [US2] Create the pure nav core `src/client/lib/searchListNav.ts` (`move(active, {delta|absolute}, len)` → clamped index; query-change reset helper)
- [X] T024 [US2] Create `src/client/components/CommandPalette.tsx`: global `keydown` toggle (`(meta||ctrl)+k`, `preventDefault`), centered blurred overlay, flat `PaletteEntry[]` (projects + active project's topics/subscriptions), match highlight, ref-backed keyboard nav, Enter → dispatch `SELECT_PROJECT/TOPIC/SUBSCRIPTION` via `useResourceContext`, Esc/outside-click close, empty state (navigation-only, FR-006)
- [X] T025 [US2] Mount `CommandPalette` in `src/client/App.tsx` and add the header ⌘K affordance button that opens it

**Checkpoint**: US1 + US2 both work independently.

---

## Phase 5: User Story 3 — Workspace layouts (Priority: P2)

**Goal**: Rail / Triptych / Console layouts switchable and persisted; reflow preserves selection + draft + pulled list.

**Independent Test**: Switch Rail→Triptych→Console; selection and compose draft survive each switch (SC-003).

### Tests for User Story 3 (write first, must FAIL)

- [X] T026 [P] [US3] Unit test `tests/unit/appearance.test.ts` for the appearance reducer + zod schema (defaults, invalid-value fallback, SET_LAYOUT/SET_DENSITY/SET_ACCENT/RESET) — ≥90% branch
- [X] T027 [P] [US3] Component test `tests/unit/App.layouts.test.tsx`: each layout renders all panels; switching layout keeps active topic/subscription and draft (state lives in providers)
- [X] T028 [P] [US3] E2E `tests/e2e/us3-layouts.spec.ts`: switch all three layouts and assert selection + draft survive and layout persists across reload

### Implementation for User Story 3

- [X] T029 [US3] Create `src/client/lib/appearance.ts`: `AppearancePrefs` types + zod schema (`density/accent/layout`), reducer, `AppearanceProvider`, `useAppearance` hook; persist to `localStorage["pubsub-dashboard:appearance"]` with safe-fallback reads (mirrors `theme.ts`)
- [X] T030 [US3] Wrap the app in `AppearanceProvider` in `src/client/App.tsx` and drive the body grid from `appearance.layout`, setting `data-density`/`data-accent` on `<html>`
- [X] T031 [P] [US3] Implement the **Triptych** layout (`1fr 1fr 1fr`) with a tabbed Topics/Subscriptions resources panel keeping independent filter + selection per tab (FR-011) in `src/client/App.tsx` (+ a small `ResourceTabs` piece if needed)
- [X] T032 [P] [US3] Implement the **Console** layout (rows `auto 1fr`: resources on top, Publisher | Receiver beneath) in `src/client/App.tsx`

**Checkpoint**: US1–US3 independently functional; layouts persist.

---

## Phase 6: User Story 4 — Personalize density & accent (Priority: P2)

**Goal**: A settings surface to change density and accent; immediate apply + persistence (theme + layout also surfaced).

**Independent Test**: Change density and accent, reload → both persisted and reflected everywhere (SC-004).

> Depends on US3's `appearance.ts` store. Independently testable for its own density/accent behavior.

### Tests for User Story 4 (write first, must FAIL)

- [X] T033 [P] [US4] Component test `tests/unit/AppearanceSettings.test.tsx` covering contracts A4–A9 (density updates `data-density`, accent updates `data-accent`, theme toggle, layout select, persistence; neon/scanlines absent per A7)
- [X] T034 [P] [US4] E2E `tests/e2e/us4-appearance.spec.ts`: set density + accent, reload, assert persisted with no wrong-appearance flash

### Implementation for User Story 4

- [X] T035 [US4] Create `src/client/components/AppearanceSettings.tsx`: density (compact/regular/cozy), accent (cyan/magenta/amber/violet), theme (reuse `ThemeToggle`/`useTheme`), and layout selector — wired to `useAppearance`; explicitly NO neon/scanline controls (FR-014)
- [X] T036 [US4] Add a header `Settings` (gear) affordance in `src/client/App.tsx` that opens `AppearanceSettings`

**Checkpoint**: US1–US4 independently functional.

---

## Phase 7: User Story 5 — Keyboard-navigable resource lists w/ highlight (Priority: P2)

**Goal**: Rewrite resource lists into a full `SearchableList` (type-to-filter + match highlight + ↑/↓/Home/End/Enter/Esc + bounded scroll), reusing the US2 nav core.

**Independent Test**: In Topics, type a filter, see highlight, move with arrows, Enter selects — no mouse.

> Reuses `src/client/lib/searchListNav.ts` from US2.

### Tests for User Story 5 (write first, must FAIL)

- [X] T037 [P] [US5] Unit test `tests/unit/resourceFilter.test.ts` (extend) for filter + match-range computation used by highlighting
- [X] T038 [P] [US5] Component test `tests/unit/ResourceList.test.tsx` (extend) covering contracts L1–L11 (filter+highlight, arrows/Home/End, Enter select, Esc clear, MouseEnter sync, ref-based rapid-key correctness, query-change reset, manual scroll-into-view not `scrollIntoView`)

### Implementation for User Story 5

- [X] T039 [P] [US5] Add match-range helper to `src/client/lib/resourceFilter.ts` and a `HighlightedText` render helper (reused by palette + lists)
- [X] T040 [US5] Rewrite `src/client/components/ResourceList.tsx` into `SearchableList`: filter input owning `onKeyDown`, ref-backed active index (via `searchListNav`), manual `scrollTop` to keep active row in view, independent state per Topics/Subscriptions list (FR-016/FR-017)

**Checkpoint**: US1–US5 independently functional.

---

## Phase 8: User Story 6 — Live JSON syntax highlighting in composer (Priority: P2)

**Goal**: Display-only highlight overlay over the existing publisher `<textarea>`; never alters published bytes.

**Independent Test**: JSON mode colors keys/strings/numbers; invalid still blocks publish; published bytes == text shown (SC-005).

### Tests for User Story 6 (write first, must FAIL)

- [X] T041 [P] [US6] Unit test `tests/unit/jsonHighlight.test.ts`: tokenizer emits key/string/number/boolean/null/punctuation; concatenated token values reproduce input exactly (char-for-char); best-effort on invalid JSON — ≥90% branch
- [X] T042 [P] [US6] Component test `tests/unit/MessagePublisher.test.tsx` (extend) covering contract US6 AS1–AS4: overlay aligns, invalid indicator/publish-block preserved (feature 005), published payload === textarea text, no highlight in text mode

### Implementation for User Story 6

- [X] T043 [P] [US6] Create the pure tokenizer `src/client/lib/jsonHighlight.ts` returning `JsonToken[]` over raw (unformatted) text
- [X] T044 [US6] Add the highlight overlay to `src/client/components/MessagePublisher.tsx`: absolute `<pre>` behind a transparent-text `<textarea>` sharing identical font/size/line-height/padding/`white-space:pre`/`tab-size`; sync `pre.scrollTop` on scroll; `.tok-*` classes; only in JSON mode (FR-018/FR-019) — textarea remains the byte source of truth

**Checkpoint**: US1–US6 independently functional.

---

## Phase 9: User Story 7 — Receiver auto-poll (Priority: P3)

**Goal**: Opt-in Auto mode pulling every 2.5 s with visible indicator; list capped at 60; strict lifecycle; highlighted message render.

**Independent Test**: Enable Auto → messages arrive w/ indicator; disable (or change sub) → stops within one interval (SC-006).

### Tests for User Story 7 (write first, must FAIL)

- [X] T045 [P] [US7] Unit test `tests/unit/receivedMessages.test.ts` (extend) for the 60-cap on `APPEND` (keeps newest 60, drops oldest; CLEAR empties; MARK_ACKNOWLEDGED unchanged) — ≥90% branch
- [X] T046 [P] [US7] Component test `tests/unit/MessageReceiver.test.tsx` (extend) with fake timers covering contracts R1–R11 (2.5s interval, indicator, toggle-off stops, subscription change resets + clears, unmount clears, error pauses, manual Pull always available)

### Implementation for User Story 7

- [X] T047 [US7] Edit `src/client/lib/receivedMessages.ts` `APPEND` to cap the running list at the 60 newest messages (FR-020)
- [X] T048 [US7] Add the Auto toggle + 2.5 s `setInterval` lifecycle to `src/client/components/MessageReceiver.tsx`: pulsing active indicator, clear on toggle-off / active-subscription change / unmount, pause-on-error (feature-003 error handling), manual Pull preserved (FR-020/FR-021)
- [X] T049 [US7] Render received message payloads with the US6 `jsonHighlight` tokenizer (display-only) in `src/client/components/MessageReceiver.tsx`

**Checkpoint**: US1–US7 independently functional.

---

## Phase 10: User Story 8 — Header, context bar & status feedback (Priority: P3)

**Goal**: Header (brand, project switcher, ADC status, ⌘K, theme toggle), context breadcrumb, transient non-blocking status flashes.

**Independent Test**: Switch project via header → breadcrumb updates; copy-to-publish → brief flash auto-dismisses.

### Tests for User Story 8 (write first, must FAIL)

- [X] T050 [P] [US8] Component test `tests/unit/ContextIndicator.test.tsx` (extend): breadcrumb shows Project · Topic · Subscription with explicit "none" states (FR-022)
- [X] T051 [P] [US8] Component test `tests/unit/Header.test.tsx`: project switcher lists/switches projects, ADC status indicator present, ⌘K + theme toggle present; status flash appears and auto-dismisses (FR-022/FR-023)

### Implementation for User Story 8

- [X] T052 [P] [US8] Build the header in `src/client/App.tsx` (or extract `src/client/components/Header.tsx`): brand + JP wordmark, `ProjectSwitcher` dropdown, ADC `SessionBadge` status chip, ⌘K affordance, `ThemeToggle`
- [X] T053 [P] [US8] Restyle `src/client/components/ContextIndicator.tsx` into the breadcrumb bar (Project mono · Topic cyan `Hash` · Subscription magenta `Radio`, "none" states)
- [X] T054 [US8] Add a lightweight, non-blocking status-flash mechanism (transient chip in header) fired on publish success and copy-to-publish, auto-dismissing (~1.8 s) (FR-023); ensure decorative JP labels never replace meaning-bearing labels (FR-024)

**Checkpoint**: All user stories independently functional.

---

## Phase 11: Polish & Cross-Cutting Concerns

- [X] T055a Update the existing E2E specs broken by the redesign DOM/selector changes — `tests/e2e/us1-first-run.spec.ts`, `tests/e2e/us3-publish-subscribe.spec.ts`, `tests/e2e/theme.spec.ts` — to the new header/layout/panel structure so the Principle-II smoke flow stays green on every PR (resolves analyze finding G1)
- [X] T055 [P] Verify reduced-motion: with `prefers-reduced-motion`, neon/scanline/entrance effects are minimized and all controls keyboard-reachable with visible focus (SC-007) — add `tests/e2e/a11y-reduced-motion.spec.ts`
- [X] T056 [P] Verify local-first: assert no third-party network request on load (SC-008) in an E2E/network check
- [X] T057 [P] Verify both themes meet the legibility bar (accent + primary text readable) across panels (SC-007)
- [X] T058 Run `npm run typecheck`, `npm run lint`, `npm run test` (coverage ≥90% line AND branch) and fix any gaps
- [X] T059 Run `npm run e2e` (full smoke + new flows) end-to-end — 23/23 green. Fixed never-run specs: routed Playwright projects by fixture (page vs request) instead of name glob, injected the projects mock into us2/us3 browser specs, emulated reduced-motion explicitly, and re-entered the project after reload to assert layout persistence.
- [X] T060 [P] Update `README.md` / `docs/` with the redesign notes (layouts, palette, settings) without changing the quickstart boot path

---

## Phase 11: Closeout enhancements (post-spec, user-requested)

Two small UX refinements requested at feature closeout. Client-only, no server/boot/schema changes (FR-026); both covered by unit tests at the ≥90% line+branch gate.

- [X] T061 Header session badge follows the active project: `SessionBadge` takes an optional `activeProjectId` prop (container-presentational); `Header` passes `resourceContext.state.activeProjectId`. The badge shows the gcloud default (`session.projectId`) only at startup before a project is selected, then the selected project — so badge and project switcher never disagree. Files: `src/client/components/SessionBadge.tsx`, `src/client/components/Header.tsx`; tests in `tests/unit/client.SessionBadge.test.tsx`, `tests/unit/Header.test.tsx`.
- [X] T062 Load a JSON body from a local file in the publisher: a "Load" button + hidden `<input type="file">` reads a local file via `FileReader` (local-only, FR-025; never leaves the browser), replaces the composer body and switches to JSON mode, letting the existing live-validity indicator flag the result. Files: `src/client/components/MessagePublisher.tsx`; tests in `tests/unit/MessagePublisher.test.tsx`.

---

## Dependencies & Execution Order

### Phase dependencies

- **Setup (P1)** → no deps.
- **Foundational (P2)** → depends on Setup; **BLOCKS all user stories** (tokens/theme/fonts/ambient/bootstrap).
- **US1 (P1, MVP)** → after Foundational. The re-skin baseline.
- **US2 (P1)** → after Foundational. Creates `searchListNav.ts` (shared with US5).
- **US3 (P2)** → after Foundational. Creates `appearance.ts` store (shared with US4).
- **US4 (P2)** → after US3 (`appearance.ts`).
- **US5 (P2)** → after US2 (`searchListNav.ts`); rewrites the US1-restyled list.
- **US6 (P2)** → after Foundational. Creates `jsonHighlight.ts` (shared with US7).
- **US7 (P3)** → after US6 (`jsonHighlight.ts`) for highlighted render; cap edit is independent.
- **US8 (P3)** → after US1 shell; uses US2 palette + US4 settings affordances if present.
- **Polish (P11)** → after all desired stories.

### Within each story

- Tests written and FAILING before implementation (Principle II, Red-Green-Refactor).
- Pure cores (`searchListNav`, `appearance`, `jsonHighlight`, reducer caps) before the components that consume them.

### Parallel opportunities

- Setup: T001, T002 in parallel.
- Foundational: T003, T004, T006, T008, T009 in parallel; T005 after T003/T004; T007 before T009 validates.
- US1: restyle tasks T014–T018 in parallel (different files) after the T013 shell.
- Cores T023 / T029 / T043 and the 60-cap T047 can be built in parallel across stories.
- All `[P]` test tasks within a story run in parallel.

---

## Parallel Example: User Story 1

```bash
# After the T013 shell lands, restyle panels in parallel (different files):
Task: "Restyle ResourceList.tsx (bounded scroll + tokens)"          # T014
Task: "Restyle ResourceBrowser.tsx (panel heads + JP tags + meta)"  # T015
Task: "Restyle MessagePublisher.tsx shell"                          # T016
Task: "Restyle MessageReceiver.tsx shell"                           # T017
Task: "Restyle ProjectBrowser/Diagnostics/SessionBadge"             # T018
```

---

## Implementation Strategy

### MVP first (User Story 1 only)
1. Phase 1 Setup → Phase 2 Foundational → Phase 3 US1.
2. STOP and validate the full 002/003/005 round-trip + light/dark on the new skin (SC-001).
3. Ship the re-skinned MVP.

### Incremental delivery
- US1 (MVP) → US2 palette → US3 layouts → US4 customization → US5 list nav → US6 JSON highlight → US7 auto-poll → US8 orientation. Each adds value without breaking prior stories.

### Parallel team strategy
- After Foundational: Dev A → US1; Dev B → US2 (+ core for US5); Dev C → US6 (+ core for US7). Then US3/US4 and US5/US7/US8 fan out.

---

## Notes

- `[P]` = different files, no incomplete-task dependency.
- Every task is client-only; server/auth/boot/schemas are untouched (FR-026).
- No new runtime dependency may be added (Principle IV/V); justify in PR only if unavoidable.
- Coverage gate is CI-blocking at ≥90% line AND branch (Principle II).
- Commit per task or logical group (Conventional Commits; no AI co-author trailers).
