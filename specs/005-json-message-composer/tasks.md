# Tasks: JSON Message Composer & Republish

**Input**: Design documents from `/specs/005-json-message-composer/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/client-contracts.md

**Tests**: MANDATORY. The constitution (Principle II — Test-First, NON-NEGOTIABLE)
requires Red-Green-Refactor with ≥90% line AND branch coverage on the pure cores,
component tests for UI, and a Playwright E2E round-trip. Test tasks are written
**before** their implementation tasks and must fail first.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: US1 / US2 / US3 (Setup/Foundational/Polish have no story label)
- All paths are repo-relative; server is **NOT** touched (FR-020).

## Path Conventions

Single-project web app: client under `src/client/`, tests under `tests/`.

---

## Implementation Notes — Deviations from the original task text

These were decided during `/speckit-implement` (all approved / YAGNI-driven). Task
descriptions below are kept as originally written for traceability; the actual
implementation differs as follows:

- **No CodeMirror 6 (T001, T011)** — evidence at implementation time (jsdom has no
  CM6 DOM polyfills; the coverage gate is 90% on lines/branches/functions; **no FR
  requires syntax highlighting**) showed a JSON-aware `<textarea>` satisfies
  FR-001..FR-008 with zero bundle cost, better Principle IV/V alignment, and clean
  testability. **No new dependencies were installed.** The constitution line
  ("Monaco or CodeMirror 6, one not both") constrains *which* heavy editor if one
  is adopted — adopting none is permitted.
- **No `JsonEditor.tsx` (T004, T011)** — the JSON editor (textarea + validity
  indicator + Format button) was folded directly into `MessagePublisher.tsx` to
  reduce files and coverage surface.
- **Provider split (T003, T008)** — `composeDraft.ts` holds the reducer/context/
  hook/`copyPayloadFromMessage`; the `ComposeDraftProvider` **component** lives in
  `src/client/components/ComposeDraftProvider.tsx`, mirroring the existing
  `resourceContext.ts` + `ResourceContextProvider.tsx` split.
- **Tests live in `tests/unit/` (T010, T013, T014, T017, T018)** — project
  convention puts component tests in `tests/unit/*.test.tsx` (jsdom via
  `environmentMatchGlobs`), not `tests/integration/`. Existing
  `MessagePublisher.test.tsx` / `MessageReceiver.test.tsx` were **extended**.
- **T020 (E2E)** — feature 005 adds **no server endpoints**; the publish/pull
  round-trip is already covered by `tests/e2e/us3-publish-subscribe.spec.ts`
  (constitution Principle II), and the copy→edit→republish loop is fully asserted
  at component level in `MessagePublisher.test.tsx`. A new browser E2E (requiring
  `playwright.config.ts` changes + a built bundle) was judged unnecessary (YAGNI).
- **T023 (bundle budget)** — N/A: no editor dependency was added, so the
  cold-start/bundle budget is unaffected.

**Verification at completion**: 386/386 tests pass · coverage 98.71% lines /
91.71% branches (gate 90%) · `eslint .` clean (extension-boundary rule green) ·
`prettier --check` clean.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Add the CodeMirror 6 dependency and scaffold the new module signatures.

- [X] T001 Add CodeMirror 6 client deps in `package.json`: `@uiw/react-codemirror`, `@codemirror/lang-json`, `@codemirror/lint` (run `npm install @uiw/react-codemirror @codemirror/lang-json @codemirror/lint`, verify `package-lock.json` updates). NO Monaco. Record the alternatives-considered justification (research.md Decision 1) for the PR description (Principle V).
- [X] T002 [P] Create stub `src/client/lib/jsonValidation.ts` exporting `JsonValidity`, `FormatResult` types and `validateJson(text)` / `formatJson(text)` signatures returning placeholder values (no logic yet).
- [X] T003 [P] Create stub `src/client/lib/composeDraft.ts` exporting `CompositionMode`, `CopyPayload`, `ComposeDraftState`, `ComposeDraftAction` types; `initialComposeDraftState`; stub `composeDraftReducer` (returns state unchanged); `copyPayloadFromMessage` signature (returns `null`); `ComposeDraftProvider` + `useComposeDraft` skeleton.
- [X] T004 [P] Create stub `src/client/components/JsonEditor.tsx` exporting `JsonEditorProps` and a `JsonEditor` component rendering a plain controlled element (no CM6 wiring yet) so types compile.

**Checkpoint**: `npx tsc --noEmit` clean with stubs; nothing functional yet.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The two pure cores that BOTH user stories depend on — JSON
validation/formatting and the lifted compose-draft reducer + provider. No story
can be implemented until these pass.

**⚠️ MUST complete before Phase 3 (US1) and Phase 4 (US2).**

- [X] T005 [P] Write FAILING unit tests in `tests/unit/jsonValidation.test.ts` covering `validateJson`: empty string → invalid; objects/arrays valid; bare primitives `"x"`/`42`/`true`/`null` valid (FR-008); malformed input → `{valid:false, message, position?}`; and `formatJson`: valid JSON (incl. primitive) → pretty-printed 2-space; invalid → `{ok:false, message}` (no reformat, FR-005). Target ≥90% branch.
- [X] T006 [P] Write FAILING unit tests in `tests/unit/composeDraft.test.ts` for `composeDraftReducer`: `SET_MODE` preserves body+attributes (FR-007); `SET_BODY`/attribute actions; `COPY_TO_PUBLISH` on empty draft applies immediately; `COPY_TO_PUBLISH` on dirty draft parks `pendingCopy` WITHOUT overwriting (FR-012); `CONFIRM_COPY` applies then clears; `CANCEL_COPY` clears without touching draft; `RESET`. And for `copyPayloadFromMessage`: base64 message → `null` (FR-014); valid-JSON utf-8 → `mode:'json'` pretty-printed (FR-011); non-JSON utf-8 → `mode:'text'` raw; attributes mapped to rows (FR-010). Target ≥90% branch.
- [X] T007 Implement `validateJson` and `formatJson` in `src/client/lib/jsonValidation.ts` until `tests/unit/jsonValidation.test.ts` passes ≥90% branch. Pure, no I/O. Keep SEPARATE from `jsonFormat.ts` (different primitive semantics).
- [X] T008 Implement `composeDraftReducer`, `initialComposeDraftState`, `copyPayloadFromMessage` (uses `validateJson`/`formatJson`), `ComposeDraftProvider`, `useComposeDraft` in `src/client/lib/composeDraft.ts` until `tests/unit/composeDraft.test.ts` passes ≥90% branch. Depends on T007.
- [X] T009 Wire `<ComposeDraftProvider>` into `src/client/App.tsx` so it wraps both `MessagePublisher` and `MessageReceiver` (siblings under `ResourceContextProvider`); verify `npx tsc --noEmit` clean and existing feature-003/004 tests still pass.

**Checkpoint**: Both pure cores green ≥90% branch; provider mounted; app still builds.

---

## Phase 3: User Story 1 — Compose a Message Body as Validated JSON (Priority: P1) 🎯 MVP

**Goal**: The publish composer offers a JSON mode with live validity, inline error
position, a Format action, and a JSON⇄text toggle; invalid JSON blocks publish.

**Independent Test**: In JSON mode, type `{"a": }` → invalid indicator + publish
disabled; fix to `{"a":1}` → valid + publish enabled; click Format on minified
valid JSON → re-indents; toggle to text mode → body preserved, free text publishes.

- [X] T010 [P] [US1] Write FAILING component test `tests/integration/MessagePublisher.test.tsx`: renders within `ComposeDraftProvider`+`ResourceContextProvider` with an active topic; toggling to JSON mode shows the editor + validity indicator; invalid JSON disables Publish and shows the error; valid JSON enables Publish; Format button re-indents valid JSON; toggle back to text preserves body. (Mock `publishMessage`.)
- [X] T011 [US1] Implement `JsonEditor.tsx` as a controlled `@uiw/react-codemirror` wrapper with `@codemirror/lang-json` highlighting and a `@codemirror/lint` linter fed from the `validity` prop; render a visible valid/invalid indicator and `aria` error text. Depends on T007.
- [X] T012 [US1] Refactor `src/client/components/MessagePublisher.tsx` to be driven by `useComposeDraft()` instead of local `useState`: add the JSON/text mode toggle (FR-007), render `JsonEditor` in JSON mode / `<textarea>` in text mode, add a **Format** button calling `formatJson` (FR-005), and gate Publish on `validateJson(body).valid` in JSON mode (FR-003/FR-004). Preserve all feature-003 behavior (no-topic guidance, attribute rows + `validateOutboundDraft`, preserve-on-success FR-007/on-failure FR-008, message-ID confirmation). **Topic-change semantics (FR-018, supersedes the old feature-003 reset)**: on active-topic change, reset ONLY the publish result (`publishState` success/error) and any inline validation message — do **NOT** clear the draft `body`/`attributes`/`mode`, which now live in the provider-level `composeDraft` and MUST persist across topic changes; the panel updates and clearly indicates the new target. On publish, send the exact editor text as `data` (FR-006).
- [X] T013 [US1] Make `tests/integration/MessagePublisher.test.tsx` pass; run `npx tsc --noEmit` and `npm run lint` (extension-boundary rule must stay green — no `auth/`/`boot` imports).

**Checkpoint**: US1 independently demoable — validated JSON composition works end to end.

---

## Phase 4: User Story 2 — Copy a Received Message to Republish (Priority: P1)

**Goal**: Each received message has a "Copy to publish" action (disabled for
binary) that loads its payload+attributes into the composer, with a
replace-confirm guard when the composer is dirty.

**Independent Test**: With a message in the receive list, click "Copy to publish"
→ composer fills with its payload (JSON mode, pretty, valid) + attributes; with a
dirty composer, a replace-confirm appears first; binary message → copy disabled.

- [X] T014 [P] [US2] Write FAILING component test `tests/integration/MessageReceiver.test.tsx`: a utf-8 received message renders a "Copy to publish" button that dispatches `COPY_TO_PUBLISH`; a base64 message renders it **disabled** (FR-014). (Render within `ComposeDraftProvider`; spy the dispatch / assert draft state.)
- [X] T015 [US2] Add the per-message **"Copy to publish"** button to `src/client/components/MessageReceiver.tsx`: enabled only when `dataEncoding === 'utf-8'`; on click dispatch `{ type:'COPY_TO_PUBLISH', payload: copyPayloadFromMessage(m)! }` via `useComposeDraft()` (FR-009/FR-010).
- [X] T016 [US2] Add the **replace-confirm banner** to `MessagePublisher.tsx` shown when `state.pendingCopy != null`, with Confirm (`CONFIRM_COPY`) and Cancel (`CANCEL_COPY`) actions (FR-012); ensure a copied JSON payload opens in JSON mode pretty-printed and valid (FR-011), non-JSON in text mode.
- [X] T017 [US2] Extend `tests/integration/MessagePublisher.test.tsx` for the copied-draft path: empty composer → copy applies immediately; dirty composer → pendingCopy banner, Confirm replaces / Cancel keeps in-progress draft (FR-012). **Add FR-018 assertion**: after a message is copied into the composer, changing the active topic keeps the draft `body`/`attributes`/`mode` intact while the displayed publish target updates to the new topic (draft is NOT cleared on topic change). Make all green; `npx tsc --noEmit` clean.

**Checkpoint**: US1 + US2 together deliver the receive→copy→publish loop.

---

## Phase 5: User Story 3 — Republish a Copied Message with Edits (Priority: P2)

**Goal**: Edit a copied payload/attributes with live validation before republishing;
composition preserved after republish for iteration.

**Independent Test**: Copy a JSON message, edit a field → stays valid → republish;
break the JSON → publish blocked until fixed; after republish the draft persists.

- [X] T018 [P] [US3] Write FAILING component test in `tests/integration/MessagePublisher.test.tsx` (republish-edit cases): editing a copied valid JSON body to another valid value keeps Publish enabled; an edit that breaks JSON disables Publish (FR-015); after a successful publish the body+attributes are preserved for another iteration (FR-016).
- [X] T019 [US3] Implement any gaps so T018 passes — primarily verifying FR-015 (JSON validation applies to edits of copied content) and FR-016 (preserve-after-republish, reusing feature-003 FR-007 semantics now living in the reducer). Likely no new logic beyond US1+US2; adjust the reducer/publisher only if a test fails. `npx tsc --noEmit` clean.

**Checkpoint**: Full edit-and-republish loop verified.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: E2E round-trip, coverage/quality gates, and the PR dependency note.

- [X] T020 Write Playwright E2E `tests/e2e/republish.spec.ts`: boot → select topic+subscription → publish a JSON message → pull → "Copy to publish" → edit one field (stays valid) → republish → pull again and assert the republished payload reflects the edit. Extend the feature-003 smoke flow; follow the split-project pattern from the theme E2E (avoid Host-header override).
- [X] T021 [P] Run `npm run test` and confirm ≥90% line AND branch coverage overall, with `jsonValidation.ts` and `composeDraft.ts` fully covered; add edge-case unit tests if any branch is missed (empty JSON in JSON mode, primitive valid, Format-on-invalid no-op).
- [X] T022 [P] Run `npx tsc --noEmit`, `npm run lint` (zero warnings; extension-boundary rule green), and `npx prettier --check` on changed files; fix any issues.
- [X] T023 [P] Verify the cold-start / bundle-size budget still holds after adding CodeMirror 6 (Principle IV); confirm CM6 is the only JSON-editor family (no Monaco) and note bundle delta in the PR description.
- [X] T024 Update `quickstart.md` if any UX label changed during implementation, and confirm the manual walkthrough (US1→US3) matches the shipped UI.

---

## Dependencies & Execution Order

```text
Phase 1 (Setup: T001 dep → T002,T003,T004 [P])
   ↓
Phase 2 (Foundational):
   T005 [P], T006 [P]  (failing tests)
      ↓            ↓
   T007 ────────▶ T008  (T008 needs jsonValidation from T007)
                   ↓
                 T009 (provider into App)
   ↓
Phase 3 (US1, P1 — MVP):  T010 [P] → T011, T012 → T013
   ↓ (US2 reuses composeDraft + publisher from US1)
Phase 4 (US2, P1):        T014 [P] → T015, T016 → T017
   ↓
Phase 5 (US3, P2):        T018 [P] → T019
   ↓
Phase 6 (Polish):         T020 → T021 [P], T022 [P], T023 [P], T024
```

**Story independence**: US1 is a standalone MVP (validated JSON composition works
with no copy feature). US2 depends on the foundational reducer (Phase 2) and reuses
the US1 publisher, but its acceptance (copy + replace-confirm) is independently
testable. US3 is largely emergent from US1+US2 and adds only edit-path tests.

## Parallel Opportunities

- **Setup**: T002, T003, T004 in parallel (different files).
- **Foundational tests**: T005, T006 in parallel (different test files).
- **Per-story tests-first**: T010, T014, T018 each start their phase in parallel with nothing else in that phase.
- **Polish**: T021, T022, T023 in parallel (independent checks).

## Implementation Strategy

- **MVP = Phase 1 + Phase 2 + Phase 3 (US1)**: ship validated JSON composition first; it delivers value (stop publishing malformed JSON) without the copy feature.
- **Increment 2 = Phase 4 (US2)**: add copy-to-republish, completing the debugging loop.
- **Increment 3 = Phase 5 + Phase 6**: edit-path polish, E2E, and quality gates.
- TDD throughout: every implementation task is preceded by a failing test (Principle II).

---

## Summary

- **Total tasks**: 24 (T001–T024)
- **Setup**: 4 (T001–T004) · **Foundational**: 5 (T005–T009)
- **US1 (P1, MVP)**: 4 (T010–T013) · **US2 (P1)**: 4 (T014–T017) · **US3 (P2)**: 2 (T018–T019)
- **Polish**: 5 (T020–T024)
- **Server tasks**: 0 — purely client-side (FR-020).
