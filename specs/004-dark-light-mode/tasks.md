# Tasks: Dark/Light Mode Selector

**Input**: Design documents from `specs/004-dark-light-mode/`

**Prerequisites**: plan.md ✅ | spec.md ✅ | research.md ✅ | data-model.md ✅ | contracts/ ✅

**Tests**: MANDATORY — Constitution Principle II (Test-First) is NON-NEGOTIABLE. All test tasks are written and verified FAILING before the implementation task they cover.

**Organization**: Tasks are grouped by user story (US1 → US2 → US3) to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no blocking dependency on incomplete sibling tasks)
- **[Story]**: User story this task belongs to — US1, US2, US3

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Enable dark mode at the tooling level — required before any story work can begin.

- [x] T001 Enable Tailwind dark mode class strategy: add `darkMode: 'class'` to `tailwind.config.ts`
- [x] T002 Add `dark:` CSS baseline and `@media (prefers-reduced-motion: reduce)` override block to `src/client/styles.css`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core theme primitives, anti-FOUC script, and test infrastructure. MUST complete before ANY user story work begins.

**⚠️ CRITICAL**: No user story work can start until this phase is complete.

- [x] T003 Create theme primitives in `src/client/lib/theme.ts`: `ThemePreferenceSchema` (Zod enum), `ThemePreference` type, `ActiveTheme` type, `STORAGE_KEY` constant, `THEME_CYCLE` array, and pure `resolveActiveTheme(preference, osPrefersDark): ActiveTheme` function — no React, no side effects
- [x] T004 Add anti-FOUC inline `<script>` as first child of `<head>` in `src/client/index.html` — reads `localStorage`, resolves preference, adds `dark` class to `<html>` synchronously before any other script or stylesheet (see data-model.md for exact script)
- [x] T005 Add `window.matchMedia` mock to `tests/setup.client.ts` so jsdom tests don't throw on theme initialization — mock must support both `.matches` property and `.addEventListener`/`.removeEventListener` for `change` events

**Checkpoint**: Primitives defined, anti-FOUC in place, test infra ready. User story work can now begin.

---

## Phase 3: User Story 1 — Manual Theme Toggle (Priority: P1) 🎯 MVP

**Goal**: User can switch between dark, light, and system mode via a toggle in the header; choice persists across reloads.

**Independent Test**: Click the toggle three times and verify the class on `<html>` cycles `dark → (none) → (os-driven)`. Reload the page and verify the correct class is applied before React mounts (no FOUC). Run `vitest run tests/unit/client.theme.test.ts tests/unit/ThemeToggle.test.tsx`.

### Tests for User Story 1 ⚠️ Write FIRST — verify FAIL before implementing

- [x] T006 [P] [US1] Write unit tests for theme primitives in `tests/unit/client.theme.test.ts`: schema accepts `dark`/`light`/`system` and rejects invalid values; `resolveActiveTheme` returns correct `ActiveTheme` for all 6 input combinations (3 preferences × 2 OS states); localStorage read-write roundtrip; invalid stored value falls back to `system`
- [x] T007 [P] [US1] Write component tests for `ThemeToggle` in `tests/unit/ThemeToggle.test.tsx`: renders Moon icon when preference=`dark`, Sun when `light`, Monitor when `system`; click cycles `dark→light→system→dark`; each click writes the new preference to `localStorage`; verify test FAILS before component exists

### Implementation for User Story 1

- [x] T008 [US1] Add `ThemeContext`, `ThemeProvider` component, and `useTheme` hook to `src/client/lib/theme.ts` — provider reads localStorage on mount, resolves activeTheme, applies/removes `dark` class on `document.documentElement`, exposes `{ preference, activeTheme, setPreference }` (depends on T006 tests failing then T003 primitives)
- [x] T009 [US1] Create `src/client/components/ThemeToggle.tsx` — `<button type="button">` cycling `dark→light→system→dark` via `useTheme`, renders Lucide `Moon`/`Sun`/`Monitor` icon per preference (depends on T007 tests failing then T008)
- [x] T010 [US1] Wrap `<App>` root in `<ThemeProvider>` and insert `<ThemeToggle />` in the `<header>` in `src/client/App.tsx` — place toggle to the left of `<SessionBadge />` in the header flex row
- [x] T011 [P] [US1] Add `dark:` Tailwind variants to header and main layout in `src/client/App.tsx` — replace hardcoded `bg-white`, `bg-slate-50`, `text-slate-900`, `border-slate-200`, `text-slate-700` with dark-mode counterparts (`dark:bg-slate-900`, `dark:bg-slate-800`, `dark:text-slate-100`, `dark:border-slate-700`, `dark:text-slate-300`)
- [x] T012 [P] [US1] Add `dark:` variants to `src/client/components/SessionBadge.tsx`
- [x] T013 [P] [US1] Add `dark:` variants to `src/client/components/DiagnosticsPanel.tsx`
- [x] T014 [P] [US1] Add `dark:` variants to `src/client/components/ProjectBrowser.tsx`
- [x] T015 [P] [US1] Add `dark:` variants to `src/client/components/ResourceBrowser.tsx`
- [x] T016 [P] [US1] Add `dark:` variants to `src/client/components/MessagePublisher.tsx`
- [x] T017 [P] [US1] Add `dark:` variants to `src/client/components/MessageReceiver.tsx`
- [x] T018 [P] [US1] Add `dark:` variants to `src/client/components/ContextIndicator.tsx` and `src/client/components/ResourceList.tsx`
- [x] T019 [US1] Verify `tests/unit/client.App.test.tsx` still passes after ThemeProvider is added — add any missing matchMedia mock assertions and confirm ThemeToggle renders within the App tree

**Checkpoint**: US1 fully functional. Toggle visible in header, theme cycles correctly, preference persists across reload, all components themed. Run `vitest run tests/unit/client.theme.test.ts tests/unit/ThemeToggle.test.tsx tests/unit/client.App.test.tsx` — all green.

---

## Phase 4: User Story 2 — System Preference Auto-Detection (Priority: P2)

**Goal**: First-time visitors automatically get the OS color scheme; users who have set a manual preference are unaffected by OS changes.

**Independent Test**: Clear localStorage, set OS to dark, open the app — dark mode is active without any click. Set OS to light while app is open with preference=`system` — app follows. Change OS while preference=`dark` — app stays dark. Run `vitest run tests/unit/client.theme.test.ts`.

### Tests for User Story 2 ⚠️ Write FIRST — verify FAIL before implementing

- [x] T020 [US2] Add US2 describe block to `tests/unit/client.theme.test.ts`: (a) `ThemeProvider` with no stored preference resolves activeTheme from OS `matchMedia`; (b) OS `change` event while preference=`system` triggers re-render to new OS value; (c) OS `change` event while preference=`dark` does NOT change activeTheme — verify these tests FAIL before T021

### Implementation for User Story 2

- [x] T021 [US2] Add `MediaQueryList` event listener in `ThemeProvider` (useEffect) in `src/client/lib/theme.ts` — on `prefers-color-scheme: dark` `change` event, re-compute and apply `activeTheme` only when stored preference is `system`; remove listener on cleanup

**Checkpoint**: US2 functional. System preference drives theme on first load and live-updates when preference=`system`. Manually pinned dark/light preferences are unaffected. Run `vitest run tests/unit/client.theme.test.ts` — all green.

---

## Phase 5: User Story 3 — Accessible Toggle Control (Priority: P3)

**Goal**: Keyboard-only and screen-reader users can fully operate the theme toggle.

**Independent Test**: Navigate to toggle via Tab, activate with Enter/Space, confirm `<html>` class changes. Check that `aria-label` text reflects current state ("Switch to light mode", "Switch to system theme", etc.). Run `vitest run tests/unit/ThemeToggle.test.tsx`.

### Tests for User Story 3 ⚠️ Write FIRST — verify FAIL before implementing

- [x] T022 [US3] Add US3 accessibility describe block to `tests/unit/ThemeToggle.test.tsx`: (a) `aria-label` is present and describes the next action (not current state) for each preference value; (b) `role="button"` or `type="button"` ensures keyboard activation; (c) component has `data-testid="theme-toggle"` for testability — verify FAIL before T023

### Implementation for User Story 3

- [x] T023 [US3] Update `src/client/components/ThemeToggle.tsx` — add dynamic `aria-label` that describes the NEXT action (e.g., when dark: "Switch to light mode"; when light: "Switch to system theme"; when system: "Switch to dark mode"), add `data-testid="theme-toggle"`, ensure visible focus ring via `focus-visible:ring-2` Tailwind class

**Checkpoint**: US3 functional. Toggle fully keyboard-accessible and screen-reader friendly. Run `vitest run tests/unit/ThemeToggle.test.tsx` — all green.

---

## Phase 6: E2E & Polish

**Purpose**: End-to-end coverage, regression guard, and final quality gate.

- [x] T024 [P] Write E2E smoke test suite in `tests/e2e/theme.spec.ts`: (a) ThemeToggle is present in header; (b) clicking cycles the theme visually (check `html.classList`); (c) reload preserves preference (check `localStorage` survives navigation); (d) clear localStorage → app matches OS preference on fresh load; (e) `prefers-reduced-motion` emulation verifies no transition occurs
- [x] T025 [P] Add `data-testid="theme-toggle"` query to `tests/unit/client.App.test.tsx` as a regression guard confirming toggle renders inside the App
- [x] T026 Run `npm run verify` (eslint + prettier + typecheck + vitest + playwright) — fix any TypeScript strict-mode errors, ESLint warnings, or coverage gaps in new files to maintain ≥90% line/branch threshold

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Requires Phase 1 completion — **BLOCKS all user stories**
- **US1 (Phase 3)**: Requires Phase 2 completion. Write tests (T006, T007) in parallel, then implement
- **US2 (Phase 4)**: Requires Phase 3 completion (ThemeProvider must exist to add the listener)
- **US3 (Phase 5)**: Requires Phase 3 completion (ThemeToggle must exist to add a11y attributes). Can run in parallel with Phase 4
- **E2E & Polish (Phase 6)**: Requires all user story phases complete

### User Story Dependencies

- **US1 (P1)**: Unblocked after Phase 2 — no story dependencies
- **US2 (P2)**: Depends on US1 ThemeProvider structure existing
- **US3 (P3)**: Depends on US1 ThemeToggle component existing; independent of US2

### Within Each User Story

- Tests MUST be written and verified FAILING before the implementation task they cover
- Foundational primitives (T003) before context/hook (T008)
- Context/hook (T008) before component (T009)
- Component (T009) before integration into App (T010)
- Dark: variants (T011–T018) can run in parallel with each other after T010 (ThemeProvider context is wired)

---

## Parallel Opportunities

### Phase 1–2 (Sequential by necessity)
T001 → T002 (both setup, fast) → T003 + T004 + T005 in parallel

### Phase 3 — US1 Tests (parallel before implementation)
```
T006 (client.theme.test.ts)   ←── write in parallel
T007 (ThemeToggle.test.tsx)   ←──
```

### Phase 3 — US1 Dark Variants (parallel after T010)
```
T011 (App.tsx)            ←──
T012 (SessionBadge)       ←── all in parallel — different files
T013 (DiagnosticsPanel)   ←──
T014 (ProjectBrowser)     ←──
T015 (ResourceBrowser)    ←──
T016 (MessagePublisher)   ←──
T017 (MessageReceiver)    ←──
T018 (ContextIndicator +  ←──
      ResourceList)
```

### Phase 5–6 (can overlap once Phase 3 complete)
```
Phase 4 (US2 listener)    ←── in parallel with
Phase 5 (US3 a11y)        ←──
```

---

## Implementation Strategy

### MVP (User Story 1 Only)

1. Phase 1: Setup (T001–T002)
2. Phase 2: Foundational (T003–T005)
3. Phase 3: US1 (T006–T019)
4. **STOP and VALIDATE**: `npm run test` — all green, coverage ≥90%
5. Demo: toggle in header, all components themed, preference persists

### Incremental Delivery

1. Setup + Foundational → infra ready
2. US1 → MVP: visible toggle, persistence, full UI theming
3. US2 → adds OS auto-detection and live update
4. US3 → adds keyboard/screen-reader accessibility
5. E2E + Polish → CI gate satisfied

---

## Notes

- `[P]` tasks touch different files — safe to run simultaneously
- Tests marked `[US1]`, `[US2]`, `[US3]` map to spec.md user stories
- Constitution Principle II: EVERY test task must produce a FAILING test before its paired implementation task runs — no exceptions
- `window.matchMedia` is not in jsdom by default — T005 (setup.client.ts mock) must precede any theme test that renders ThemeProvider
- Dark: variant changes (T011–T018) are mechanical Tailwind class additions — review each component file for hardcoded `bg-*`, `text-*`, `border-*` color utilities and add `dark:` counterparts
- `src/client/components/ui/` is excluded from coverage per vitest.config.ts — no changes needed there
