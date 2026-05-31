# Tasks: Publish & Subscribe

**Input**: Design documents from `specs/003-publish-subscribe/`

**Prerequisites**: plan.md ✅ · spec.md ✅ · research.md ✅ · data-model.md ✅ · contracts/http-api.md ✅

**Tests**: MANDATORY per Constitution Principle II (Test-First, NON-NEGOTIABLE). Failing tests are written BEFORE every implementation task. Vitest ≥90% line+branch on `src/**`. Playwright smoke extended to a real publish→pull round-trip via the in-memory demo seam.

**Organization**: Grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Parallelizable with other [P] tasks in the same phase (different files, no incomplete deps)
- **[Story]**: User story label (US1 / US2 / US3 / US4)
- All file paths are project-root-relative

## Story coupling note

- **US1 (publish body)** and **US3 (attributes)** share the `MessagePublisher` component and the publish endpoint; US3 extends US1.
- **US2 (pull/read)** and **US4 (acknowledge)** share the `MessageReceiver` component; US4 extends US2.
- Within `src/server/routes/messaging.ts` the three endpoints live in one file, so endpoint tasks across stories are sequential (not `[P]` with each other). Likewise `tests/integration/routes.messaging.test.ts` is one file — per-story test additions append to it.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Define shared type contracts (zod schemas), extend the DI seam, and create stubs. Types/signatures only — zero behaviour. Must complete before any test or implementation task.

- [x] T001 [P] Create `src/server/schemas/messaging.ts` with all zod schemas and inferred types: `PublishRequestSchema`, `PublishResponseSchema`, `PullRequestSchema`, `ReceivedMessageSchema` (with `dataEncoding: 'utf-8' | 'base64'` discriminator and `deliveryAttempt: number | null`), `PullResponseSchema`, `AckRequestSchema`, `AckResponseSchema` (with `acknowledged` + `expired`) — no logic, types only. Reuse `PubSubErrorSchema` from `src/server/schemas/pubsub.ts`.
- [x] T002 Extend `PubSubClientLike` in `src/server/routes/pubsub.ts` additively with method signatures `publish(topicName, data: Buffer, attributes: Record<string,string>): Promise<string>`, `pull(subscriptionName, maxMessages: number): Promise<RawReceivedMessage[]>`, `acknowledge(subscriptionName, ackIds: string[]): Promise<void>` — signatures only; do NOT modify the existing `getTopics`/`getSubscriptions` methods.
- [x] T003 [P] Add `apiPost` stub to `src/client/lib/api.ts` — signature `apiPost<TRes>(path, body, schema, fetchImpl?)`, returns a rejected/placeholder so callers compile; reuse existing `ApiError`/`ApiResult`.
- [x] T004 [P] Create `src/client/lib/jsonFormat.ts` with `tryPrettyPrintJson(text): { formatted: string; isJson: boolean }` stub (returns `{ formatted: text, isJson: false }`).
- [x] T005 [P] Create `src/client/lib/messaging.ts` with caller stubs `publishMessage`, `pullMessages`, `ackMessages`, and a pure `validateOutboundDraft(draft): { ok: true } | { ok: false; error: string }` stub — signatures only.
- [x] T006 [P] Create `src/client/lib/receivedMessages.ts` with `ReceivedMessagesState`, `ReceivedMessagesAction` union (`APPEND` / `CLEAR` / `MARK_ACKNOWLEDGED`), and stub `receivedMessagesReducer` (returns state unchanged) — stub only.

**Checkpoint**: `tsc --noEmit` passes. Stubs exist so test files can import types.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared transport + server seam wiring that ALL user stories depend on. Written TDD: tests first, then implementation. No user-story endpoint logic yet.

**⚠️ CRITICAL**: No user story work can begin until T008 and T011 pass.

- [x] T007 [P] Write FAILING unit tests for `apiPost` in `tests/unit/messagingApi.test.ts`: success path validates body against schema and surfaces `x-trace-id`; non-2xx body becomes `ApiError` carrying `code`/`message`/`remediation`; sets `content-type: application/json` and serialises the request body.
- [x] T008 Implement `apiPost` in `src/client/lib/api.ts` until `tests/unit/messagingApi.test.ts` passes (mirror `apiGet`: POST, JSON body, zod-validate response, `ApiError` mapping).
- [x] T009 Create `registerMessaging(app, deps)` shell in `src/server/routes/messaging.ts`: imports `AppEnv` and the messaging schemas, accepts `{ createPubSubClient }`, reconstructs full resource paths from `:projectId`/`:topicId`/`:subscriptionId` short names, and reuses/extends a `handleMessagingError` based on feature 002's `handlePubSubError` (specialised permission text: publish → `pubsub.topics.publish`/`roles/pubsub.publisher`; pull/ack → `pubsub.subscriptions.consume`/`roles/pubsub.subscriber`). Also map gRPC `NOT_FOUND` (code 5) → `404 NOT_FOUND` (the 002 handler does not cover code 5; without this it would fall through to 500). No endpoints registered yet.
- [x] T010 Wire `registerMessaging(app, { createPubSubClient: deps.createPubSubClient })` into `buildServer` in `src/server/server.ts`, inside the existing `if (deps.auth) { ... if (deps.createPubSubClient) }` block, after `registerPubSub` and before the `app.all('/api/*')` catch-all.
- [x] T011 Build the real client adapter in `src/server/cli/run.ts`: change the factory to `createPubSubClient: (projectId) => { const pubsub = new PubSub({ projectId }); const sub = new v1.SubscriberClient(); return { getTopics, getSubscriptions (delegate to pubsub), publish (pubsub.topic(name).publishMessage), pull (sub.pull), acknowledge (sub.acknowledge) }; }` — import `{ PubSub, v1 }` from `@google-cloud/pubsub`. No new dependency.
- [x] T011a Extend the CI demo seam for messaging: add an optional in-memory `createPubSubClient` to `DemoOverrides` in `src/server/cli/demo.ts` (a fake whose `publish` stores messages in a per-topic buffer, `pull` returns up to N buffered messages with generated ackIds, `acknowledge` drops them). Wire it in `src/server/cli/run.ts` with precedence **injected dep > demo fake > real `new PubSub()`**. This lets a real publish→pull round-trip run in CI without GCP credentials (Principle II). Unit-test the fake's publish→pull→ack cycle in `tests/unit/demoPubSub.test.ts`.

**Checkpoint**: Transport + seam ready. `apiPost` green. Messaging route mounts (no endpoints yet). User stories can now begin.

---

## Phase 3: User Story 1 — Publish a Message to the Active Topic (Priority: P1) 🎯 MVP

**Goal**: With a topic as active context, compose a message body and publish it, seeing the returned message ID.

**Independent Test**: Set a topic active, type a body, click Publish, see a confirmation with a message ID.

### Tests for User Story 1 (write first, must FAIL)

- [x] T012 [US1] Write FAILING integration tests in `tests/integration/routes.messaging.test.ts` for `POST /api/projects/:projectId/topics/:topicId/publish`: success returns `{ messageId, traceId }` (mocked `createPubSubClient.publish`); empty `data` → 400 `INVALID_QUERY`; oversized body → 400 `PAYLOAD_TOO_LARGE`; permission error → 401 naming `pubsub.topics.publish`; quota → 429 with `quotaName`; timeout → 504; topic-not-found (gRPC code 5) → 404 `NOT_FOUND` (spec edge case "topic deleted before publish").
- [x] T013 [P] [US1] Write FAILING unit tests in `tests/unit/messaging.draft.test.ts` for `validateOutboundDraft`: empty body fails (FR-003); valid body + no attributes passes; (attribute rules covered in US3).

### Implementation for User Story 1

- [x] T014 [US1] Implement the publish endpoint in `src/server/routes/messaging.ts`: validate `PublishRequestSchema`, reject empty body (400) and >10 MB UTF-8 body (400 `PAYLOAD_TOO_LARGE`), call `client.publish(...)`, return `{ messageId, traceId }`; route errors through `handleMessagingError`. Make T012 pass.
- [x] T015 [US1] Implement `publishMessage(projectId, topicId, body, attributes)` and the body-only branch of `validateOutboundDraft` in `src/client/lib/messaging.ts` using `apiPost` + `PublishResponseSchema`. Make T013 pass.
- [x] T016 [US1] Create `src/client/components/MessagePublisher.tsx`: reads the active topic from `resourceContext`; shows the topic path + a body textarea + Publish button; on success shows the message ID and **preserves** body (FR-007); on failure preserves body (FR-008); guidance state with disabled input when no topic is active (FR-009).
- [x] T017 [US1] Mount `MessagePublisher` in the existing app shell next to the resource browser / `ContextIndicator`, visible when a topic is the active context.
- [x] T018 [US1] Add `pino` logging to the publish endpoint: log operation + topic short name + success/failure at `info`; never log `data` or attribute values unless `--verbose` (Principle V).

**Checkpoint**: US1 fully functional — a developer can publish a body-only message and see its message ID. MVP deliverable.

---

## Phase 4: User Story 2 — Pull and Read Messages from the Active Subscription (Priority: P1)

**Goal**: With a subscription active, pull up to 10 messages on demand and read payload (JSON pretty-printed), attributes, message ID, and publish time; successive pulls accumulate; Clear empties the list.

**Independent Test**: Set a subscription active with ≥1 message available, click Pull, see the messages with payloads and attributes; Pull again appends; Clear empties.

### Tests for User Story 2 (write first, must FAIL)

- [x] T019 [US2] Write FAILING integration tests in `tests/integration/routes.messaging.test.ts` for `POST /api/projects/:projectId/subscriptions/:subscriptionId/pull`: success returns up to 10 `ReceivedMessage`s with UTF-8 `data`; non-UTF-8 payload returns `dataEncoding: 'base64'` (FR-014); empty pull returns `{ messages: [], traceId }` as 200 (FR-013); `maxMessages` out of `1..10` → 400; permission → 401 naming `pubsub.subscriptions.consume`; quota → 429.
- [x] T020 [P] [US2] Write FAILING unit tests in `tests/unit/jsonFormat.test.ts` for `tryPrettyPrintJson`: valid JSON → indented + `isJson: true`; non-JSON text → original + `isJson: false`; empty string handled.
- [x] T021 [P] [US2] Write FAILING unit tests in `tests/unit/receivedMessages.test.ts` for `receivedMessagesReducer`: `APPEND` concatenates without dropping existing items (FR-026/US2 AS7); `APPEND` keeps duplicate `messageId`s (redelivery, no destructive de-dup); `CLEAR` empties (US2 AS8); initial state shape.

### Implementation for User Story 2

- [x] T022 [US2] Implement the pull endpoint in `src/server/routes/messaging.ts`: validate `PullRequestSchema` (default 10, **reject** outside `1..10` with 400), call `client.pull(...)`, narrow each raw message → `ReceivedMessage` (UTF-8-strict decode → `dataEncoding`, map `attributes`, `publishTime` ISO, `ackId`, `deliveryAttempt`), return `{ messages, traceId }`. Make T019 pass.
- [x] T023 [P] [US2] Implement `tryPrettyPrintJson` in `src/client/lib/jsonFormat.ts`. Make T020 pass.
- [x] T024 [P] [US2] Implement `receivedMessagesReducer` `APPEND`/`CLEAR` in `src/client/lib/receivedMessages.ts`. Make T021 pass (MARK_ACKNOWLEDGED in US4).
- [x] T025 [US2] Implement `pullMessages(projectId, subscriptionId, maxMessages)` in `src/client/lib/messaging.ts` using `apiPost` + `PullResponseSchema`.
- [x] T026 [US2] Create `src/client/components/MessageReceiver.tsx`: reads the active subscription from `resourceContext`; Pull button (disabled + guidance when no subscription, FR-015); renders the running list via `receivedMessagesReducer` (APPEND on each pull); per message shows pretty-printed JSON (`tryPrettyPrintJson`) or labelled base64 binary block (FR-014), attributes, message ID, publish time; distinct "no messages available" state (FR-013); Clear button.
- [x] T027 [US2] Mount `MessageReceiver` in the app shell next to `MessagePublisher`, visible when a subscription is the active context.
- [x] T028 [US2] Add `pino` logging to the pull endpoint: log operation + subscription short name + message **count** at `info`; never log payloads/attributes unless `--verbose` (Principle V).

**Checkpoint**: US1 + US2 work independently — full publish→pull round trip is demonstrable (SC-007).

---

## Phase 5: User Story 3 — Attach Attributes to a Published Message (Priority: P2)

**Goal**: Add/remove key/value attribute rows on the publish panel; send them with the message; validate completeness and key-uniqueness before submit.

**Independent Test**: Add two attribute pairs, publish, and (via US2 on a sub of the same topic) confirm both attributes arrive.

### Tests for User Story 3 (write first, must FAIL)

- [x] T029 [P] [US3] Extend `tests/unit/messaging.draft.test.ts` with FAILING cases for `validateOutboundDraft` attribute rules: row with key but no value (and vice-versa) fails (FR-006/US3 AS3); duplicate keys fail (FR-006/US3 AS4); complete unique pairs pass; removing a row excludes it (US3 AS5).
- [x] T030 [US3] Extend the publish integration tests in `tests/integration/routes.messaging.test.ts` with a FAILING case asserting `attributes` are forwarded to `client.publish` and an empty attribute value is rejected 400.

### Implementation for User Story 3

- [x] T031 [US3] Implement the attribute branch of `validateOutboundDraft` in `src/client/lib/messaging.ts` (non-empty key AND value per row; unique keys across rows). Make T029 pass.
- [x] T032 [US3] Ensure the publish endpoint forwards validated `attributes` to `client.publish` and rejects empty values in `src/server/routes/messaging.ts`. Make T030 pass.
- [x] T033 [US3] Extend `src/client/components/MessagePublisher.tsx` with attribute rows: add-row, remove-row, key+value inputs (US3 AS1/AS5), inline validation messages from `validateOutboundDraft` blocking submit (US3 AS3/AS4); attributes preserved across publish (FR-007).

**Checkpoint**: US1 + US2 + US3 work — messages carry attributes end-to-end (SC-002).

---

## Phase 6: User Story 4 — Acknowledge (Remove) Received Messages (Priority: P3)

**Goal**: Explicitly acknowledge an individual pulled message to remove it from the subscription; pulling alone never acks.

**Independent Test**: Pull a message, click Acknowledge, pull again after the deadline, confirm it is not redelivered while unacked ones are.

### Tests for User Story 4 (write first, must FAIL)

- [x] T034 [US4] Write FAILING integration tests in `tests/integration/routes.messaging.test.ts` for `POST /api/projects/:projectId/subscriptions/:subscriptionId/ack`: success returns `{ acknowledged, expired, traceId }` (mocked `client.acknowledge`); empty `ackIds` → 400; expired ackIds surface in `expired` non-fatally (FR-020); permission → 401.
- [x] T035 [P] [US4] Extend `tests/unit/receivedMessages.test.ts` with FAILING `MARK_ACKNOWLEDGED` cases: flags the matching item by `ackId`, item stays visible and marked (FR-019), no-op for unknown ackId.

### Implementation for User Story 4

- [x] T036 [US4] Implement the ack endpoint in `src/server/routes/messaging.ts`: validate `AckRequestSchema` (non-empty `ackIds`), call `client.acknowledge(...)`, return `{ acknowledged, expired, traceId }`; classify expired-deadline failures into `expired` (FR-020). Make T034 pass.
- [x] T037 [P] [US4] Implement `receivedMessagesReducer` `MARK_ACKNOWLEDGED` in `src/client/lib/receivedMessages.ts`. Make T035 pass.
- [x] T038 [US4] Implement `ackMessages(projectId, subscriptionId, ackIds)` in `src/client/lib/messaging.ts` using `apiPost` + `AckResponseSchema`.
- [x] T039 [US4] Extend `src/client/components/MessageReceiver.tsx` with a per-message Acknowledge action: on success dispatch `MARK_ACKNOWLEDGED` and mark the item (FR-019); show a non-fatal "pull again" hint for `expired` ackIds (FR-020); pulling still never acks (FR-018).
- [x] T040 [US4] Add `pino` logging to the ack endpoint: log operation + subscription short name + acked **count** at `info` (Principle V).

**Checkpoint**: All four user stories independently functional.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [x] T041 Handle active-context change while content is on screen in both panels (FR-023): when the active topic/subscription changes, the panel reflects the new target and indicates the change rather than acting on a stale resource.
- [x] T042 Extend the Playwright smoke (`tests/e2e/`) to exercise a real **publish→pull round-trip** against the in-memory demo seam (T011a): publish a message to a topic, then pull from a subscription on that topic and assert the same body + attributes come back. Satisfies the constitution's "at least one publish/subscribe round-trip on every PR" requirement (Principle II). Depends on T011a.
- [x] T043 [P] Verify `lint` (zero warnings) + `prettier --check` + `tsc --noEmit` are clean across all new/changed files.
- [x] T044 Run `vitest run --coverage` and confirm ≥90% line AND branch on `src/**`; add targeted tests for any uncovered branch (error paths, base64 fallback).
- [x] T045 [P] Run `specs/003-publish-subscribe/quickstart.md` end-to-end against the demo/CI seam to validate the documented flow.

---

## Dependencies & Execution Order

### Phase dependencies

- **Setup (Phase 1)**: no dependencies — start immediately. T001/T003/T004/T005/T006 are `[P]`; T002 edits `pubsub.ts`.
- **Foundational (Phase 2)**: depends on Setup. **Blocks all user stories.** T008 (apiPost) and T009–T011 (route shell + wiring + adapter) must complete first.
- **User Stories (Phase 3–6)**: depend on Foundational.
  - US1 (P1) and US2 (P1) are independent of each other and form the MVP round trip.
  - US3 (P2) depends on US1 (extends `MessagePublisher` + publish endpoint).
  - US4 (P3) depends on US2 (extends `MessageReceiver` + reducer).
- **Polish (Phase 7)**: after the desired stories are complete.

### Within each story

- Tests written and FAILING before implementation (Principle II).
- Server endpoint and pure client helpers before the React component that consumes them.
- `messaging.ts` (route) and `routes.messaging.test.ts` are single files — endpoint/test tasks across stories are sequential, not `[P]`.

### Parallel opportunities

- Phase 1: T001, T003, T004, T005, T006 in parallel (distinct files).
- Phase 2: T007 (test) parallel with route-shell drafting; T008 gates story work.
- US2: T020 (jsonFormat test) and T021 (reducer test) in parallel; T023 and T024 in parallel.
- Cross-story (if staffed): US1+US3 (publisher track) and US2+US4 (receiver track) can run as two parallel tracks once Foundational is done.

---

## Parallel Example: Phase 1 Setup

```bash
Task: "Create src/server/schemas/messaging.ts (zod schemas, types only)"
Task: "Add apiPost stub to src/client/lib/api.ts"
Task: "Create src/client/lib/jsonFormat.ts stub"
Task: "Create src/client/lib/messaging.ts caller + validate stubs"
Task: "Create src/client/lib/receivedMessages.ts reducer stub"
```

---

## Implementation Strategy

### MVP (the round trip)

1. Phase 1 Setup → Phase 2 Foundational.
2. Phase 3 (US1 publish) → STOP and validate: publish a body, see message ID.
3. Phase 4 (US2 pull) → STOP and validate: pull and read; full publish→pull round trip (SC-007).
4. Deploy/demo — this is the meaningful MVP.

### Incremental delivery

1. Setup + Foundational → foundation ready.
2. US1 → independently testable (publish body-only).
3. US2 → independently testable (pull/read) → round-trip demo.
4. US3 → attributes end-to-end.
5. US4 → explicit acknowledge.

### Parallel team strategy

- After Foundational: Track A = US1 + US3 (publisher); Track B = US2 + US4 (receiver). The two tracks touch mostly disjoint files (`MessagePublisher` vs `MessageReceiver`, distinct lib files); coordinate only on the shared `messaging.ts` route and its integration test file.

---

## Notes

- `[P]` = different files, no incomplete dependencies.
- Tests MUST fail before implementing (Red-Green-Refactor, Principle II).
- Never log message payloads/attributes at `info`; redact unless `--verbose` (Principle V).
- No new runtime dependency — `@google-cloud/pubsub` (`v1.SubscriberClient`) is already present.
- Do not touch `bin/`, `src/server/boot.ts`, or `src/server/auth/**` (extension contract).
- Commit after each task or logical group (Conventional Commits; no AI co-author trailer).
