# Data Model: Publish & Subscribe

**Branch**: `003-publish-subscribe` | **Date**: 2026-05-31

All shapes are `zod` schemas in `src/server/schemas/messaging.ts`, shared between
the Hono server and the React client (Principle III). Inferred TypeScript types
are the single source of truth. No persistent storage — every entity lives in a
request/response payload or in client-side session memory.

---

## Server contract entities (`src/server/schemas/messaging.ts`)

### Attribute (transport form)

Carried inline as a JSON object, not a standalone schema.

| Concept | Type | Rules |
|---------|------|-------|
| key | `string` | Non-empty; unique within one message (enforced client-side, R2) |
| value | `string` | Non-empty |

Transport representation: `attributes: z.record(z.string().min(1))` — a
`Record<string, string>`. Duplicate keys are structurally impossible on the wire.

### PublishRequest

```text
PublishRequestSchema = {
  data:       string  // min length 1 (FR-003); UTF-8 message body
  attributes: Record<string, string>  // optional; each value min length 1 (FR-005/FR-006)
}
```

Validation:
- `data` MUST be non-empty → empty body is rejected `400 INVALID_QUERY` (FR-003).
- `attributes` is optional; when present, values are non-empty strings.
- Per-message body size guard (edge case): reject `400 PAYLOAD_TOO_LARGE` when the
  UTF-8 byte length exceeds the Pub/Sub per-message limit (10 MB) before calling
  the SDK.

### PublishResponse

```text
PublishResponseSchema = {
  messageId: string   // returned by the messaging service (FR-004)
  traceId:   string (uuid)
}
```

### PullRequest

```text
PullRequestSchema = {
  maxMessages: number  // int, 1..10, default 10 (FR-011)
}
```

Validation: `maxMessages` is an integer in `[1, 10]`; values outside the range are
rejected `400 INVALID_QUERY` so a single pull cannot flood the UI. (Contracts and
T019 agree on reject, not clamp.)

### ReceivedMessage

```text
ReceivedMessageSchema = {
  messageId:        string
  ackId:            string                 // opaque; required to acknowledge (FR-017)
  data:             string                 // utf-8 text OR base64 (per dataEncoding)
  dataEncoding:     'utf-8' | 'base64'     // discriminator (R3, FR-014)
  attributes:       Record<string, string> // possibly empty
  publishTime:      string (ISO 8601)      // FR-012
  deliveryAttempt:  number | null          // redelivery indicator; null if unavailable
}
```

Notes:
- `dataEncoding: 'base64'` marks a non-UTF-8 payload; the client renders it in a
  labelled binary block (FR-014). `'utf-8'` payloads may be pretty-printed
  client-side (FR-027, R4).
- `ackId` is the only field needed to acknowledge; it is **not** the messageId
  (ackIds are single-use and expire with the ack deadline).
- `deliveryAttempt` lets the UI flag redeliveries; the same `messageId` may
  legitimately recur across pulls (edge case: duplicate redelivery).

### PullResponse

```text
PullResponseSchema = {
  messages: ReceivedMessage[]   // 0..maxMessages; empty array = "no messages available" (FR-013)
  traceId:  string (uuid)
}
```

An empty `messages` array is a **success**, rendered as the distinct
"no messages currently available" state (FR-013) — never an error.

### AckRequest

```text
AckRequestSchema = {
  ackIds: string[]   // min length 1; the ackIds to acknowledge (FR-017)
}
```

### AckResponse

```text
AckResponseSchema = {
  acknowledged: string[]   // ackIds successfully acknowledged
  expired:      string[]   // ackIds whose deadline had already passed (FR-020, non-fatal)
  traceId:      string (uuid)
}
```

`expired` is non-empty when an ack window lapsed; the client shows a non-fatal
"pull again" hint for those, without breaking the panel (FR-020).

### MessagingError

Reuses the existing `PubSubErrorSchema` from `src/server/schemas/pubsub.ts`
(`code`, `message`, `traceId`, optional `quotaName`). Codes used by this feature:
`INVALID_QUERY` (400), `PAYLOAD_TOO_LARGE` (400), `NOT_FOUND` (404),
`PERMISSION_DENIED` (401), `QUOTA_EXCEEDED` (429), `TIMEOUT` (504),
`INTERNAL_ERROR` (500).

---

## Server dependency seam (`src/server/routes/pubsub.ts`)

`PubSubClientLike` is extended **additively** (feature 002 methods unchanged):

```text
interface PubSubClientLike {
  getTopics(): ...                         // 002, unchanged
  getSubscriptions(): ...                  // 002, unchanged
  publish(topicName, data: Buffer, attributes: Record<string,string>): Promise<string>   // → messageId
  pull(subscriptionName, maxMessages: number): Promise<RawReceivedMessage[]>
  acknowledge(subscriptionName, ackIds: string[]): Promise<void>
}
```

`RawReceivedMessage` is the SDK's raw pull result (an external-boundary `any`)
narrowed into `ReceivedMessage` by the route before it crosses into application
code (Principle III). Topic/subscription **short** names arrive as path params;
the route reconstructs the full resource path
(`projects/{projectId}/topics|subscriptions/{name}`).

---

## Client state entities

### OutboundMessageDraft (`MessagePublisher` local state)

| Field | Type | Notes |
|-------|------|-------|
| body | `string` | The message-body input |
| attributes | `Array<{ key: string; value: string }>` | Editable rows (ordered) |

- Survives a successful publish (FR-007) and a failed publish (FR-008).
- Client-side validation before submit: non-empty body (FR-003); every row has
  non-empty key AND value; keys unique across rows (FR-006). Rows can be added
  and removed (US3 AS1/AS5).

### ReceivedMessagesState (`receivedMessagesReducer`, R7)

```text
ReceivedMessagesState = {
  items: Array<ReceivedMessage & { acknowledged: boolean }>
}

Actions:
  APPEND(messages)         // concat a new pull onto the running list (FR-026)
  CLEAR()                  // empty the list; next pull starts fresh (FR-026 / US2 AS8)
  MARK_ACKNOWLEDGED(ackId) // set acknowledged = true after a successful ack (FR-019)
```

Invariants:
- `APPEND` never drops existing items (FR-026 / US2 AS7).
- The same `messageId` may appear more than once (redelivery); the reducer does
  not destructively de-duplicate.
- `acknowledged` is a view flag; an acknowledged item stays visible, marked, until
  `CLEAR` (FR-019).

---

## Relationships

```text
Active Topic (002 context) ──(publish)──▶ PublishRequest ──▶ messaging service ──▶ messageId
Active Subscription (002 context) ──(pull)──▶ PullResponse.messages[] ──▶ ReceivedMessagesState (APPEND)
ReceivedMessage.ackId ──(ack)──▶ AckRequest ──▶ AckResponse.acknowledged ──▶ MARK_ACKNOWLEDGED
```

The active topic/subscription come from feature 002's `resourceContext`; this
feature reads that selection (FR-023/FR-024) and never modifies it.
