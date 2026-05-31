# Implementation Plan: Publish & Subscribe

**Branch**: `003-publish-subscribe` | **Date**: 2026-05-31 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/003-publish-subscribe/spec.md`

## Summary

Add the messaging round-trip to the Pub/Sub Dashboard on top of the active
context delivered by feature 002. With a topic selected, the user composes a
message body plus optional key/value attributes and **publishes** it, receiving
the returned message ID. With a subscription selected, the user **pulls** up to
10 currently available messages on demand, sees each message's decoded payload
(JSON auto pretty-printed, non-text shown safely), attributes, message ID and
publish time, accumulates successive pulls into a running list with an explicit
**Clear**, and can **acknowledge** individual messages — acknowledgement is
always explicit, so a plain pull never removes messages from a shared
subscription.

The server exposes three new Hono endpoints, registered through the existing
`createPubSubClient` dependency seam:

- `POST /api/projects/:projectId/topics/:topicId/publish`
- `POST /api/projects/:projectId/subscriptions/:subscriptionId/pull`
- `POST /api/projects/:projectId/subscriptions/:subscriptionId/ack`

Publish uses the high-level `PubSub` topic API; synchronous on-demand pull and
acknowledge use the `v1.SubscriberClient` from the **same** `@google-cloud/pubsub`
package (no new dependency). The React client gains a `MessagePublisher` and a
`MessageReceiver` component, an `apiPost` helper, a small received-messages
reducer (append / clear / mark-acknowledged), and a client-side JSON
pretty-print helper. JSON formatting is performed entirely on the client.

## Technical Context

**Language/Version**: TypeScript 5.6+, Node.js ≥ 20 LTS (unchanged from features 001–002)

**Primary Dependencies**:

- **No new runtime dependency.** `@google-cloud/pubsub` (`^5.3.0`) is already
  present from feature 002 and is the constitution-mandated Pub/Sub client. The
  feature uses two surfaces of that one package: the high-level `PubSub` for
  publish, and `v1.SubscriberClient` for synchronous pull/acknowledge
  (justified in `research.md` R1).
- **Existing runtime** (unchanged): `hono`, `google-auth-library`, `zod`,
  `pino`, `react`, `react-dom`, `tailwindcss`, `lucide-react`.
- **Existing devDependencies** (unchanged): all tooling from features 001–002.

**Storage**: N/A — no new persistent state. Composed messages and the pulled
running list live in React client-side memory for the browser session only.

**Testing**:

- Unit + integration: `vitest` with `@vitest/coverage-v8`, threshold ≥90% line
  and branch on `src/**`.
- New integration tests: `routes.messaging.test.ts` — exercises publish, pull,
  and ack via `app.request()` with the `createPubSubClient` seam mocked
  (`vi.fn`), covering success, empty pull, validation 400s, and the
  permission / quota / timeout error mappings.
- New unit tests: `receivedMessages.test.ts` (append / clear / mark-acknowledged
  reducer), `jsonFormat.test.ts` (pretty-print valid JSON, pass-through non-JSON,
  non-UTF-8 fallback), `messagingApi.test.ts` (`apiPost` success + `ApiError`
  mapping).
- E2E: a new in-memory `createPubSubClient` demo seam (extending
  `demoOverridesFromEnv`) lets the Playwright smoke run a **real publish→pull
  round-trip** in CI without GCP credentials — publish a message, pull it back,
  assert body + attributes match — satisfying the constitution's "at least one
  publish/subscribe round-trip on every PR" requirement (Principle II).

**Target Platform**: macOS + Linux (same as features 001–002). Single-process
Node web app, no deployment-model change.

**Project Type**: Single-process Node web app (Hono + Vite-built React).

**Performance Goals**:

- `POST .../publish`: success confirmation (message ID) within ~3 s p95 (SC-001).
- `POST .../pull`: up to 10 messages retrieved and rendered within 5 s p95 (SC-003).
- Client-side JSON pretty-print of a pulled batch (≤10 messages): < 16 ms,
  imperceptible.
- Cold-start budget (< 3 s) is unaffected: the new endpoints are never called
  during boot.

**Constraints**:

- All GCP calls are outbound only to `pubsub.googleapis.com` (Principle I).
- Message payloads and attributes MUST NOT appear in logs unless `--verbose`
  (Principle V); at `info` level only message counts and trace IDs are logged.
- Publish and acknowledge are state-mutating — the first write operations in the
  product. They occur **only** on explicit user action; pull never auto-acks
  (FR-016/FR-018). This is the deliberate, documented departure from feature
  002's read-only constraint.
- No new client-side dependency: JSON formatting uses `JSON.parse`/`JSON.stringify`;
  no Monaco/CodeMirror in this feature (structured JSON composition is feature 004).

**Scale/Scope**: Single authenticated GCP identity; bounded pull of 10 messages
per request; running list grows only by explicit re-pull and is reset by Clear.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Local-First & Zero-Config** — ✅ The three new endpoints call
  `pubsub.googleapis.com` only. No remote backend, no telemetry, no non-loopback
  bind. Auth continues through the existing ADC seam; no new credential handling.
- **II. Test-First (NON-NEGOTIABLE)** — ✅ Plan schedules contract/integration
  tests for all three endpoints and unit tests for the reducer, the JSON
  formatter, and `apiPost` **before** implementation. ≥90% line+branch
  maintained. Playwright smoke extended to cover a publish round-trip shape.
- **III. Type Safety End-to-End** — ✅ All new request/response shapes defined as
  `zod` schemas in `src/server/schemas/messaging.ts`, shared with the client.
  Raw Pub/Sub message attributes (an external-boundary `any`) are narrowed via
  zod before entering application code. `tsc --noEmit` stays clean.
- **IV. Instant DX (One-Command UX)** — ✅ Boot path untouched; endpoints not
  invoked during cold start. Permission (403→401), quota (429), and timeout
  (504) failures produce specific, actionable messages reusing feature 002's
  `handlePubSubError` mapping, extended with publish/consume permission names.
- **V. Operational Excellence** — ✅
  - **No new dependency** — reuses `@google-cloud/pubsub`; `v1.SubscriberClient`
    is part of that same package. Alternatives considered in `research.md` R1.
  - `pino` trace IDs propagate to all three endpoints via existing
    `traceMiddleware`; the trace ID is returned in every response body.
  - Message payloads/attributes are redacted at `info` level; only counts and
    IDs logged unless `--verbose`.
  - No new persistent state; client-side session memory only.

**Verdict**: No violations. Zero new dependencies; write operations are explicit,
user-initiated, and confined to the new endpoints.

## Project Structure

### Documentation (this feature)

```text
specs/003-publish-subscribe/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── contracts/
│   └── http-api.md      # Phase 1 output (3 new endpoints)
├── checklists/
│   └── requirements.md  # Already created by /speckit-specify
└── tasks.md             # Phase 2 output (NOT created by /speckit-plan)
```

### Source Code (additions to repository root)

The feature follows the extension contract in `docs/extension-points.md` exactly:
a new route file, a new schema file, one registration call in `buildServer`, and
new React components — without touching `bin/`, `boot.ts`, or `auth/**`.

```text
src/
├── server/
│   ├── routes/
│   │   └── messaging.ts        # POST publish / pull / ack  (registerMessaging)
│   └── schemas/
│       └── messaging.ts        # zod: PublishRequest/Response, PullRequest,
│                               #      ReceivedMessage, PullResponse,
│                               #      AckRequest/Response
├── client/
│   ├── components/
│   │   ├── MessagePublisher.tsx # publish panel: body + attribute rows + send
│   │   └── MessageReceiver.tsx  # receive panel: pull, running list, clear, ack
│   └── lib/
│       ├── api.ts               # EXTENDED: add apiPost (typed POST helper)
│       ├── messaging.ts         # publishMessage/pullMessages/ackMessages callers
│       ├── receivedMessages.ts  # reducer: APPEND / CLEAR / MARK_ACKED
│       └── jsonFormat.ts        # tryPrettyPrintJson(text) → formatted | original

tests/
├── integration/
│   └── routes.messaging.test.ts # publish/pull/ack — mocked createPubSubClient
└── unit/
    ├── receivedMessages.test.ts # reducer: append, clear, mark-acked, redelivery
    ├── jsonFormat.test.ts       # pretty-print JSON, pass-through, non-UTF-8
    └── messagingApi.test.ts     # apiPost success + ApiError mapping
```

**Shared seam change** (`src/server/routes/pubsub.ts`): the `PubSubClientLike`
interface is extended additively with `publish`, `pull`, and `acknowledge`
methods. The topics/subscriptions routes from feature 002 are unchanged; only
the interface grows. `src/server/cli/run.ts` builds the real adapter
(`new PubSub({ projectId })` + a shared `v1.SubscriberClient`) — `run.ts` is the
CLI orchestration layer and is **not** in the frozen set.

`src/server/server.ts` `buildServer` gains one `registerMessaging(app, { createPubSubClient })`
call inside the existing `if (deps.auth && deps.createPubSubClient)` block,
following the established `registerHealth` / `registerSession` /
`registerProjects` / `registerPubSub` pattern.

**Structure Decision**: Single-project layout unchanged. New files slot into the
established `routes/` + `schemas/` + `components/` + `lib/` pattern. The only edits
to existing files are additive: extend `PubSubClientLike`, extend the `run.ts`
factory, add one `registerMessaging` call, add `apiPost`, and mount the two new
components in the existing app shell next to the resource browser.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No violations recorded. Table intentionally empty.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|--------------------------------------|
| _(none)_  | _(n/a)_    | _(n/a)_                              |
