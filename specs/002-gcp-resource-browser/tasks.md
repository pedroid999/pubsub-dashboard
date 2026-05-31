# Tasks: GCP Resource Browser

**Input**: Design documents from `specs/002-gcp-resource-browser/`

**Prerequisites**: plan.md ✅ · spec.md ✅ · research.md ✅ · data-model.md ✅ · contracts/http-api.md ✅

**Tests**: MANDATORY per Constitution Principle II (Test-First, NON-NEGOTIABLE). Failing tests are written BEFORE every implementation task. Vitest ≥90% line+branch on `src/**`. Playwright smoke extended to cover `/api/projects`.

**Organization**: Grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Parallelizable with other [P] tasks in the same phase
- **[Story]**: User story label (US1 / US2 / US3 / US4)
- All file paths are project-root-relative

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Install new dependency and define shared type contracts (schemas + client state types). Zero behaviour — only types and stubs. Must complete before any test or implementation task.

- [ ] T001 Add `@google-cloud/pubsub` to `package.json` runtime dependencies (run `npm install @google-cloud/pubsub` and verify `package-lock.json` updates)
- [ ] T002 [P] Create `src/server/schemas/pubsub.ts` with all zod schemas: `GcpProjectSchema`, `ProjectsResponseSchema`, `TopicSchema`, `TopicsResponseSchema`, `SubscriptionSchema`, `SubscriptionsResponseSchema`, `PubSubErrorSchema` and their inferred TypeScript types — no logic, types only
- [ ] T003 [P] Create `src/client/lib/resourceContext.ts` with `ResourceContextState`, `ResourceContextAction` union type, stub `resourceContextReducer` (returns state unchanged), `ResourceContextProvider`, and `useResourceContext` hook — stub only, no reducer logic yet
- [ ] T004 [P] Create `src/client/lib/resourceFilter.ts` with exported function signature stubs: `filterByQuery(items, query)` and `highlightMatch(text, query)` — type signatures only, implementations return identity/empty

**Checkpoint**: `tsc --noEmit` passes. No tests yet — stubs exist so test files can import types.

---

## Phase 2: Foundational (Tests → Implementations)

**Purpose**: Shared client-side infrastructure (reducer + filter) that all UI user stories depend on. Written TDD: tests first, then implementations. No user story code yet.

**⚠️ CRITICAL**: No US implementation can begin until T007 and T008 pass.

- [ ] T005 [P] Write FAILING unit tests for `resourceContextReducer` in `tests/unit/resourceContext.test.ts` covering: initial state shape, `SELECT_PROJECT` creates empty context entry, `SELECT_TOPIC` stores topic per project, `SELECT_SUBSCRIPTION` stores subscription per project, `DESELECT_TOPIC`/`DESELECT_SUBSCRIPTION` clears individual fields, `NAVIGATE_BACK` clears `activeProjectId` but preserves `contextMap`, per-project isolation (switching projects does not clear previous project's context), returning to previous project restores its selection
- [ ] T006 [P] Write FAILING unit tests for filter utilities in `tests/unit/resourceFilter.test.ts` covering: empty query returns full list unchanged, partial substring match (case-insensitive), no-match returns empty array, `highlightMatch` splits text correctly around match, `highlightMatch` with empty query returns single unsplit segment, multiple items filtered correctly
- [ ] T007 Implement `resourceContextReducer` in `src/client/lib/resourceContext.ts` — all actions — until `tests/unit/resourceContext.test.ts` passes with ≥90% branch coverage
- [ ] T008 [P] Implement `filterByQuery` and `highlightMatch` in `src/client/lib/resourceFilter.ts` until `tests/unit/resourceFilter.test.ts` passes with ≥90% branch coverage
- [ ] T009 Update `src/server/server.ts` — extend `BuildServerDeps` interface with `auth: GoogleAuth` field (no route registration yet); verify `tsc --noEmit` is clean and existing integration tests still pass

**Checkpoint**: `npm test` passes. Reducer and filter are correct. Server typechecks with new `auth` field.

---

## Phase 3: User Story 1 — Browse and Search GCP Projects (Priority: P1) 🎯 MVP

**Goal**: User opens the dashboard and sees a searchable list of all GCP projects accessible via ADC. Selecting a project transitions the view.

**Independent Test**: Boot the server, call `GET /api/projects` with a mocked ADC response, assert the response conforms to `ProjectsResponseSchema`. Open the browser, verify the project list renders and the search input filters the visible items client-side.

### Tests for User Story 1

> **Write these first — they MUST FAIL before implementation begins**

- [ ] T010 [P] [US1] Write FAILING integration test for `GET /api/projects` in `tests/integration/routes.projects.test.ts`: mock `google-auth-library` to return a fake access token; mock CRM v3 REST response with 2 projects; assert HTTP 200, response body matches `ProjectsResponseSchema`, `traceId` is present
- [ ] T011 [P] [US1] Write FAILING integration test for `GET /api/projects` error paths in `tests/integration/routes.projects.test.ts`: mock 403 → assert `PERMISSION_DENIED`; mock 429 with quota name → assert `QUOTA_EXCEEDED` + `quotaName` field; mock timeout → assert `TIMEOUT` 504

### Implementation for User Story 1

- [ ] T012 [US1] Implement `src/server/routes/projects.ts`: `registerProjects(app, { auth })` — fetch all pages from CRM v3 `GET /v3/projects` using `google-auth-library` access token + Node `fetch`; map to `GcpProjectSchema`; handle 403 → `PERMISSION_DENIED`, 429 → `QUOTA_EXCEEDED` (parse `ErrorInfo.metadata.quota_metric`), timeout → `TIMEOUT`; attach `traceId` from `c.var.traceId` to all responses (makes T010 and T011 pass)
- [ ] T013 [US1] Register `registerProjects` in `src/server/server.ts` `buildServer` — insert after `registerDiagnostics`, before the `app.all('/api/*')` catch-all; pass `deps.auth`; verify existing integration tests still pass
- [ ] T014 [P] [US1] Write FAILING React component test for `ProjectBrowser` in `tests/unit/ProjectBrowser.test.tsx` using `@testing-library/react`: mock `apiGet('/api/projects')` to return 2 projects; assert both display names render; type in search input; assert only matching project remains visible; assert `onSelectProject` callback is called with correct projectId on click
- [ ] T015 [US1] Implement `src/client/components/ProjectBrowser.tsx`: fetch `/api/projects` on mount; render a search input (controlled, clears on ×); render filtered list using `filterByQuery` + `highlightMatch` from `src/client/lib/resourceFilter.ts`; show "No matching projects" when filter yields nothing; show empty state when no projects; show `PERMISSION_DENIED` / `QUOTA_EXCEEDED` / generic error states with actionable messages; call `onSelectProject(projectId)` on item click (makes T014 pass)
- [ ] T016 [US1] Wire `ProjectBrowser` into `src/client/App.tsx`: render `ProjectBrowser` when no project is active (no `activeProjectId` in context); pass `onSelectProject` handler that dispatches `SELECT_PROJECT` to `ResourceContextProvider`; surround tree with `ResourceContextProvider`

**Checkpoint**: `npm test` + `npm run typecheck` pass. `GET /api/projects` returns correct JSON. ProjectBrowser renders, filters in real time, and dispatches `SELECT_PROJECT`. US1 is independently demonstrable.

---

## Phase 4: User Story 2 + User Story 4 — Browse and Filter Topics & Subscriptions (Priority: P2)

**Goal**: After selecting a project, the user sees two independently filterable panels: topics and subscriptions. Each has a real-time search input with match highlighting. Subscriptions show their parent topic name. Filtering is fully client-side.

**Independent Test**: Select a project, call `GET /api/projects/:id/topics` and `/subscriptions` with mocked SDK responses, assert correct schemas. In the browser, type in each filter independently and verify only the matching items remain visible without triggering new API calls.

### Tests for User Story 2 + US4

> **Write these first — they MUST FAIL before implementation begins**

- [ ] T017 [P] [US2] Write FAILING integration test for `GET /api/projects/:projectId/topics` in `tests/integration/routes.pubsub.test.ts`: mock `@google-cloud/pubsub` `PubSub.getTopics()` to return 3 topics; assert HTTP 200, response matches `TopicsResponseSchema`, `displayName` is the last path segment, `traceId` present
- [ ] T018 [P] [US2] Write FAILING integration test for `GET /api/projects/:projectId/subscriptions` in `tests/integration/routes.pubsub.test.ts`: mock `PubSub.getSubscriptions()` to return 2 subs (one pull, one push with deleted topic); assert `deliveryType` derivation, `topicName: "_deleted-topic_"` passes through, response matches `SubscriptionsResponseSchema`
- [ ] T019 [P] [US2] Write FAILING integration tests for error paths in `tests/integration/routes.pubsub.test.ts`: empty `projectId` → 400 `INVALID_QUERY`; gRPC `RESOURCE_EXHAUSTED` (code 8) → 429 `QUOTA_EXCEEDED` + `quotaName`; gRPC `PERMISSION_DENIED` → 401; timeout → 504 `TIMEOUT`
- [ ] T020 [P] [US4] Write FAILING React component test for `ResourceList` in `tests/unit/ResourceList.test.tsx`: render with 5 items; type partial name → assert filtered list; clear input → assert all items return; assert no-match state shows "No matching topics"; assert match text is wrapped in `<mark>` element

### Implementation for User Story 2 + US4

- [ ] T021 [US2] Implement `src/server/routes/pubsub.ts`: `registerPubSub(app, { auth })` — instantiate `PubSub({ projectId, authClient })` per request; `getTopics()` → map to `TopicSchema` (derive `displayName` from last path segment); `getSubscriptions()` → map to `SubscriptionSchema` (derive `deliveryType`, pass through `_deleted-topic_`); handle gRPC error codes (8 → `QUOTA_EXCEEDED`, 7 → `PERMISSION_DENIED`, timeout → `TIMEOUT`); validate non-empty `projectId` (→ 400); attach `traceId` (makes T017–T019 pass)
- [ ] T022 [US2] Register `registerPubSub` in `src/server/server.ts` `buildServer` — insert after `registerProjects`; verify all existing integration tests still pass
- [ ] T023 [P] [US4] Implement `src/client/components/ResourceList.tsx`: accept `items: { name: string; displayName: string; [extra fields] }[]`, `query: string`, `onSelect: (name) => void`, `selectedName?: string`, `emptyMessage: string`, `noMatchMessage: string`; filter via `filterByQuery`; render highlight via `highlightMatch` wrapping matches in `<mark>`; highlight selected item; show correct empty/no-match states (makes T020 pass)
- [ ] T024 [US2] Implement `src/client/components/ResourceBrowser.tsx`: fetch `/api/projects/:projectId/topics` and `/api/projects/:projectId/subscriptions` in parallel on `projectId` change; maintain independent `topicQuery` and `subscriptionQuery` filter states (no coupling); render two `ResourceList` panels side by side; render explicit refresh button per panel (re-fetches, preserves filter, preserves context selection per FR-024); show per-panel error states with retry; show delivery type badge (`Pull` / `Push`) on subscription items; show "Topic deleted" warning when `topicName === "_deleted-topic_"`; dispatch `SELECT_TOPIC` / `SELECT_SUBSCRIPTION` to `ResourceContextProvider` on item click
- [ ] T025 [US2] Wire `ResourceBrowser` into `src/client/App.tsx`: render when `activeProjectId` is set in context; pass `projectId` from context; add a "← Projects" back button that dispatches `NAVIGATE_BACK`

**Checkpoint**: `npm test` + `npm run typecheck` pass. Both panels load, filter independently, show correct error/empty states, refresh without losing filters. US2 and US4 independently demonstrable.

---

## Phase 5: User Story 3 — Active Context Selection (Priority: P3)

**Goal**: Selected topic and subscription are visually highlighted and shown in a persistent context indicator. Navigating between projects restores each project's previous selection.

**Independent Test**: Select a topic in project A, navigate to project B, select a subscription, navigate back to project A — topic T is still highlighted and shown in the context indicator.

### Tests for User Story 3

> **Write these first — they MUST FAIL before implementation begins**

- [ ] T026 [P] [US3] Write FAILING React component test for `ContextIndicator` in `tests/unit/ContextIndicator.test.tsx`: render with project + topic + subscription → assert all three names visible; render with project only → assert "No topic selected" placeholder; assert component renders nothing when `activeProjectId` is undefined
- [ ] T027 [P] [US3] Write FAILING integration test for per-project context persistence in `tests/unit/resourceContext.test.ts` (add to existing): simulate SELECT_PROJECT(A) → SELECT_TOPIC(A, t1) → NAVIGATE_BACK → SELECT_PROJECT(B) → SELECT_SUBSCRIPTION(B, s1) → NAVIGATE_BACK → SELECT_PROJECT(A); assert `contextMap[A].selectedTopicName === t1`

### Implementation for User Story 3

- [ ] T028 [US3] Implement `src/client/components/ContextIndicator.tsx`: read `activeProjectId`, `selectedTopicName`, `selectedSubscriptionName` from `useResourceContext`; render a persistent banner/bar showing project ID, topic name (or "No topic selected"), subscription name (or "No subscription selected"); render nothing when `activeProjectId` is undefined (makes T026 pass)
- [ ] T029 [US3] Add `ContextIndicator` to `src/client/App.tsx` — render it persistently above the main content area regardless of whether `ProjectBrowser` or `ResourceBrowser` is shown
- [ ] T030 [US3] Verify `ResourceList` already dispatches `SELECT_TOPIC` / `SELECT_SUBSCRIPTION` (wired in T024); confirm selected item highlight in `ResourceList` reads `selectedName` from `useResourceContext` for the active project; add an acceptance test scenario in `tests/integration/routes.projects.test.ts` asserting that `GET /api/projects` on a second call (project switch simulation) returns a clean response unaffected by previous state

**Checkpoint**: `npm test` + `npm run typecheck` pass. Context indicator updates on each selection. Navigating back to project A restores its selection. US3 independently demonstrable.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: E2E coverage, observability verification, and final wiring correctness.

- [ ] T031 [P] Extend Playwright smoke test in `tests/e2e/us1-first-run.spec.ts`: add an `apiRequestContext.get('/api/projects')` assertion that the response status is 200 and body matches the expected JSON schema shape (use `zod` `.safeParse` in the assertion helper)
- [ ] T032 [P] Verify `pino` trace ID propagation for all three new endpoints: add assertions in `tests/integration/routes.projects.test.ts` and `tests/integration/routes.pubsub.test.ts` that the `traceId` in every response body matches the `X-Trace-Id` response header set by `traceMiddleware`
- [ ] T033 Run `npm run verify` (lint + format-check + typecheck + vitest coverage + playwright) and confirm all gates pass with coverage ≥90% on `src/**`; fix any coverage gaps in new files before marking done
- [ ] T034 Update `README.md` to document the new GCP Resource Browser section: required IAM roles (`resourcemanager.projects.list`, `roles/pubsub.viewer`), screenshot placeholder, and the copy-pastable `gcloud projects add-iam-policy-binding` command for granting `pubsub.viewer`

**Checkpoint**: `npm run verify` exits 0. All 6 phases complete. Feature is shippable.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 — BLOCKS all user story phases
- **Phase 3 (US1 P1)**: Depends on Phase 2 — can start as soon as foundational passes
- **Phase 4 (US2+US4 P2)**: Depends on Phase 2; integrates with Phase 3 artifacts (ResourceList reused)
- **Phase 5 (US3 P3)**: Depends on Phase 3 and Phase 4 (ContextIndicator needs both selection types)
- **Phase 6 (Polish)**: Depends on all previous phases

### User Story Dependencies

- **US1 (P1)**: Depends only on Phase 2 foundational
- **US2+US4 (P2)**: Depends on Phase 2; reuses `ResourceList` from US1 implementation
- **US3 (P3)**: Depends on US1 and US2+US4 (needs both topic and subscription selection wired)

### Within Each Phase

1. Tests (T00x) written first → must FAIL → then implementation
2. Schema/types before services
3. Server route before client component
4. Component before `App.tsx` wiring

### Parallel Opportunities

- T002, T003, T004 run in parallel (different files)
- T005, T006 run in parallel (different test files)
- T007, T008 run in parallel (different implementation files)
- T010, T011 run in parallel (same test file, different `describe` blocks — write sequentially if in same session)
- T014 can start while T012/T013 are in progress (component test is independent of server route)
- T017, T018, T019, T020 run in parallel
- T026, T027 run in parallel
- T031, T032 run in parallel

---

## Parallel Example: User Story 1

```bash
# Phase 3 — launch tests in parallel (all must FAIL first):
Task T010: integration test for GET /api/projects happy path
Task T011: integration test for GET /api/projects error paths
Task T014: React component test for ProjectBrowser

# Then implement in sequence:
T012 → T013 → T015 → T016
```

## Parallel Example: User Story 2 + US4

```bash
# Phase 4 — launch tests in parallel:
Task T017: integration test for GET topics
Task T018: integration test for GET subscriptions
Task T019: integration test for error paths
Task T020: React component test for ResourceList

# Then implement:
T021 → T022 → T023 (parallel with T021) → T024 → T025
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories)
3. Complete Phase 3: US1 — project list with search
4. **STOP and VALIDATE**: `GET /api/projects` works, ProjectBrowser renders and filters
5. Demo if ready

### Incremental Delivery

1. Setup + Foundational → shared infrastructure ready
2. US1 → searchable project list → demo (MVP)
3. US2+US4 → topic/subscription browsing with filters → demo
4. US3 → active context selection with persistence → demo
5. Polish → E2E + coverage → ship

### Parallel Team Strategy

After Phase 2:
- Dev A: Phase 3 (US1 — server route + ProjectBrowser)
- Dev B: Phase 4 tests (T017–T020) in parallel with Dev A's work

---

## Notes

- `[P]` tasks = different files, no shared mutable state, safe to run concurrently
- TDD is non-negotiable: every test task must be committed and confirmed FAILING before its paired implementation task begins
- `vi.mock('@google-cloud/pubsub')` and `vi.mock('google-auth-library')` are the mocking strategy for integration tests — no real GCP credentials needed in CI
- Coverage exclusions remain the same as feature 001: `bin/**`, `*.d.ts`, `src/client/components/ui/**` (shadcn primitives)
- Commit after each checkpoint — do not batch multiple phases into one commit
- `src/server/server.ts` is touched in T009, T013, and T022 — coordinate if working in parallel to avoid merge conflicts on that file
