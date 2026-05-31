# Research: Publish & Subscribe

**Branch**: `003-publish-subscribe` | **Date**: 2026-05-31

Phase 0 research resolving the technical unknowns for the messaging round-trip.
No `NEEDS CLARIFICATION` markers remained in the spec after `/speckit-clarify`;
the open items below are implementation-strategy decisions.

---

## R1 — Synchronous, on-demand pull and acknowledge

**Decision**: Use `v1.SubscriberClient` from the already-installed
`@google-cloud/pubsub` package for `pull` and `acknowledge`. Use the high-level
`PubSub.topic(name).publishMessage(...)` for publish.

**Rationale**:

- FR-010/FR-011 require an **explicit, user-triggered, bounded** pull (max 10),
  not a continuous stream. The high-level `Subscription` object is designed for
  **streaming** pull (event-emitter, long-lived, auto-managed flow control),
  which is the wrong shape for a one-shot "pull on demand" button and would also
  make FR-016 (no auto-ack) and FR-018 harder to guarantee.
- `v1.SubscriberClient` exposes exactly the synchronous primitives we need:
  `pull({ subscription, maxMessages })` returns a finite batch and
  `acknowledge({ subscription, ackIds })` removes specific messages. Pulled
  messages are **not** acknowledged by the act of pulling — they redeliver after
  the ack deadline — which is precisely the non-destructive default the spec
  mandates.
- It is part of the **same** constitution-mandated package
  (`import { PubSub, v1 } from '@google-cloud/pubsub'`), so it adds **zero new
  runtime dependencies** (Principle V).

**Alternatives considered**:

- *High-level `Subscription` streaming pull with a manual stop-after-N*: rejected
  — fights the API's intent, complicates flow control, and risks acking on
  message handling; harder to keep non-destructive.
- *Raw REST calls to `pubsub.googleapis.com/v1/...:pull`*: rejected — would
  re-implement auth, retries, and proto (un)marshalling that the SDK already
  provides; the constitution names `@google-cloud/pubsub` as the only supported
  client.

---

## R2 — Publish payload encoding and attributes

**Decision**: The client sends the message body as a UTF-8 string and an
optional `attributes` object (`Record<string, string>`). The server encodes the
body with `Buffer.from(data, 'utf-8')` and calls
`topic.publishMessage({ data, attributes })`, returning the resulting
`messageId`.

**Rationale**:

- Pub/Sub message data is bytes; a developer composing a test message types
  text (often JSON), so UTF-8 is the correct, lossless default for v1.
- Attributes are transported as a JSON object, so **duplicate keys cannot exist
  on the wire** — the FR-006 uniqueness rule is a client-side *form* concern (two
  attribute rows with the same key), enforced before the request is built. The
  request schema validates each value is a non-empty string.
- Binary/base64 publish input is out of scope for v1 (not in the spec); raw
  bytes can be added later without breaking this contract.

**Alternatives considered**:

- *Accept base64 body with an encoding flag on publish*: deferred — no spec
  requirement; adds UI/validation surface better suited to feature 004.

---

## R3 — Receiving non-UTF-8 payloads safely (FR-014)

**Decision**: The server attempts to decode each pulled message's data as UTF-8
using a strict decoder (`TextDecoder('utf-8', { fatal: true })`). On success it
returns `{ data: <text>, dataEncoding: 'utf-8' }`; on failure it returns
`{ data: <base64>, dataEncoding: 'base64' }`. The client renders `utf-8` payloads
as text (and may pretty-print, see R4) and renders `base64` payloads in a
labelled "binary (base64)" block.

**Rationale**:

- Keeps the non-text fallback decision on the server where the raw bytes live,
  and gives the client an unambiguous, zod-narrowed discriminator instead of
  guessing. One message with binary data never breaks rendering of the rest of
  the batch.

**Alternatives considered**:

- *Always send base64 and decode on the client*: rejected — pushes text decoding
  and validity detection to every client render and loses the clean
  discriminated shape.

---

## R4 — Client-side JSON pretty-printing (FR-027)

**Decision**: A pure client helper `tryPrettyPrintJson(text): { formatted: string; isJson: boolean }`
attempts `JSON.parse(text)` then `JSON.stringify(parsed, null, 2)`. On parse
failure it returns the original text with `isJson: false`. Performed only for
`dataEncoding: 'utf-8'` payloads, at render time.

**Rationale**:

- FR-027 is display-only; doing it on the client keeps the server dumb and the
  contract stable, and avoids re-formatting work on the server for payloads the
  user may never expand. The batch is ≤10 messages, so cost is negligible.
- This is explicitly **not** structured JSON composition/validation/editing —
  that (and a Monaco/CodeMirror editor) is feature 004 per the constitution's
  "one JSON editor" constraint, intentionally not pulled in here.

**Alternatives considered**:

- *Server-side pretty-printing*: rejected — couples display formatting to the
  API contract and wastes work for collapsed messages.

---

## R5 — Error mapping for write/consume operations

**Decision**: Reuse and extend feature 002's `handlePubSubError(err, traceId, c)`
mapping. The gRPC status codes map identically:
`8 → 429 QUOTA_EXCEEDED` (with `quotaName`), `7|16 → 401 PERMISSION_DENIED`,
`5 (NOT_FOUND) → 404 NOT_FOUND` (a publish/pull against a resource deleted after
selection; the 002 handler lacked this and defaulted to 500),
`AbortError → 504 TIMEOUT`, otherwise `500 INTERNAL_ERROR`. The permission
message is specialised per operation: publish names
`pubsub.topics.publish` (grant `roles/pubsub.publisher`); pull/ack name
`pubsub.subscriptions.consume` (grant `roles/pubsub.subscriber`). An expired ack
deadline surfaces as a non-fatal `ACK_EXPIRED` response (FR-020) rather than a
hard error.

**Rationale**:

- Consistency with feature 002 (FR-022) means one error vocabulary across the
  whole dashboard and one tested mapping. Specialising only the permission text
  keeps the diff minimal while satisfying FR-021's "name the missing permission".

**Alternatives considered**:

- *A second, parallel error mapper*: rejected — duplicates logic and risks
  drift between read and write error vocabularies.

---

## R6 — Client transport: `apiPost`

**Decision**: Extend `src/client/lib/api.ts` with `apiPost<TReq, TRes>(path, body, resSchema, fetchImpl?)`
mirroring the existing `apiGet`: it JSON-serialises `body`, sets
`content-type: application/json`, validates the success response against the zod
schema, surfaces `x-trace-id`, and converts non-2xx bodies into the existing
`ApiError` (carrying `code`/`message`/`remediation`).

**Rationale**:

- The publish/pull/ack endpoints are POSTs; the client currently only has
  `apiGet`. A single symmetric helper keeps all transport, validation, and error
  translation in one place and reuses the proven `ApiError` contract.

**Alternatives considered**:

- *Inline `fetch` per caller*: rejected — scatters error handling and zod
  validation, and would not be uniformly covered by the ≥90% gate.

---

## R7 — Received-messages list state (US2 AS7 / FR-026)

**Decision**: Hold the pulled batch in a dedicated `useReducer`
(`receivedMessagesReducer`) local to `MessageReceiver`, with actions
`APPEND` (concatenate a new pull), `CLEAR` (empty the list), and
`MARK_ACKNOWLEDGED` (flag a message by `ackId` after a successful ack). This is
separate from feature 002's `resourceContext` reducer, which keeps the
per-project topic/subscription selection.

**Rationale**:

- The running accumulation + explicit Clear is a view concern scoped to the
  receive panel and the browser session; it has no place in the per-project
  selection map. A small, independently unit-tested reducer satisfies FR-026 and
  keeps redeliveries identifiable by message ID without destructive
  de-duplication.

**Alternatives considered**:

- *Append into `resourceContext`*: rejected — pollutes the selection model with
  transient view data and complicates the 002 reducer's tested invariants.
- *Plain `useState` array*: workable but the three explicit transitions are
  clearer and more testable as a reducer (Principle II coverage).

---

## Summary of decisions

| # | Decision | Zero new deps? |
|---|----------|----------------|
| R1 | `v1.SubscriberClient` for sync pull/ack; high-level `PubSub` for publish | ✅ |
| R2 | UTF-8 body + `Record<string,string>` attributes; uniqueness is client-side | ✅ |
| R3 | Server UTF-8-strict decode → `dataEncoding: 'utf-8' \| 'base64'` discriminator | ✅ |
| R4 | Client-side `tryPrettyPrintJson`; no JSON editor (that's 004) | ✅ |
| R5 | Reuse/extend 002 `handlePubSubError`; specialise permission text; `ACK_EXPIRED` | ✅ |
| R6 | Add symmetric `apiPost` to `api.ts` | ✅ |
| R7 | Dedicated `receivedMessagesReducer` (APPEND/CLEAR/MARK_ACKNOWLEDGED) | ✅ |

All decisions stay within the existing dependency set and the
`docs/extension-points.md` surface. No constitution violations.
