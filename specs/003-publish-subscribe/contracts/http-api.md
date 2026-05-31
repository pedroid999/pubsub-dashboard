# HTTP API Contracts: Publish & Subscribe

**Branch**: `003-publish-subscribe` | **Date**: 2026-05-31

Three new state-changing endpoints added to the Hono server. All endpoints:
- Require an active ADC session (return `401` if ADC is invalid/expired).
- Accept and return JSON (`Content-Type: application/json`).
- Include the request `traceId` in every response (success and error).
- Are registered in `buildServer()` via `registerMessaging()`, inside the
  existing `if (deps.auth && deps.createPubSubClient)` block, following the
  extension contract in `docs/extension-points.md`.
- Reuse `handlePubSubError` (feature 002) for the permission/quota/timeout/
  internal error mapping, with permission text specialised per operation.

Path params are **short** names (e.g. `topicId`, `subscriptionId`); the server
reconstructs the full resource path
`projects/{projectId}/topics|subscriptions/{name}`.

---

## `POST /api/projects/:projectId/topics/:topicId/publish`

Publish a single message to the active topic (FR-001…FR-008).

**Auth**: ADC. IAM: `pubsub.topics.publish` (`roles/pubsub.publisher`).

**Request body**:
```json
{
  "data": "{\"orderId\": 42, \"status\": \"paid\"}",
  "attributes": { "eventType": "order.paid", "source": "checkout" }
}
```
- `data` (string, **required**, min length 1). UTF-8 message body.
- `attributes` (object, optional). `Record<string,string>`; each value non-empty.

**Success `200`**:
```json
{ "messageId": "10000000000001", "traceId": "f47ac10b-58cc-4372-a567-0e02b2c3d479" }
```

**Errors**:
| Status | code | When |
|--------|------|------|
| 400 | `INVALID_QUERY` | blank `projectId`/`topicId`, missing/empty `data`, or an attribute value that is empty |
| 400 | `PAYLOAD_TOO_LARGE` | UTF-8 body exceeds the 10 MB per-message limit |
| 401 | `PERMISSION_DENIED` | missing `pubsub.topics.publish`; message names the permission and `roles/pubsub.publisher` |
| 404 | `NOT_FOUND` | target topic no longer exists (gRPC NOT_FOUND, code 5, from the service) |
| 429 | `QUOTA_EXCEEDED` | rate-limited; includes `quotaName` when available |
| 504 | `TIMEOUT` | request to Pub/Sub timed out |
| 500 | `INTERNAL_ERROR` | unexpected failure |

> Attribute-key uniqueness (FR-006) is enforced **client-side** before the
> request is built; on the wire `attributes` is an object so duplicate keys cannot
> occur.

---

## `POST /api/projects/:projectId/subscriptions/:subscriptionId/pull`

Pull up to N currently available messages, without acknowledging them
(FR-010…FR-016). A plain pull is **non-destructive**: unacknowledged messages
redeliver after their ack deadline.

**Auth**: ADC. IAM: `pubsub.subscriptions.consume` (`roles/pubsub.subscriber`).

**Request body**:
```json
{ "maxMessages": 10 }
```
- `maxMessages` (integer, optional, default `10`, range `1..10`). Values outside
  the range are rejected `400`.

**Success `200`** (messages available):
```json
{
  "messages": [
    {
      "messageId": "10000000000001",
      "ackId": "PROJECT_ACK_ID_OPAQUE",
      "data": "{\"orderId\": 42, \"status\": \"paid\"}",
      "dataEncoding": "utf-8",
      "attributes": { "eventType": "order.paid" },
      "publishTime": "2026-05-31T10:15:30.000Z",
      "deliveryAttempt": 1
    }
  ],
  "traceId": "f47ac10b-58cc-4372-a567-0e02b2c3d479"
}
```

**Success `200`** (none available — FR-013, distinct from any error):
```json
{ "messages": [], "traceId": "f47ac10b-58cc-4372-a567-0e02b2c3d479" }
```

- `dataEncoding: "utf-8"` → `data` is decoded text (client may pretty-print JSON,
  FR-027). `dataEncoding: "base64"` → `data` is base64 of a non-UTF-8 payload,
  rendered in a labelled binary block (FR-014).

**Errors**: same mapping as publish, except the permission text names
`pubsub.subscriptions.consume` / `roles/pubsub.subscriber`. `400 INVALID_QUERY`
for blank ids or out-of-range `maxMessages`.

---

## `POST /api/projects/:projectId/subscriptions/:subscriptionId/ack`

Explicitly acknowledge one or more pulled messages, removing them from the
subscription (FR-017…FR-020). Acknowledgement is **only** ever invoked by
explicit user action; the server never acks as a side effect of pulling.

**Auth**: ADC. IAM: `pubsub.subscriptions.consume` (`roles/pubsub.subscriber`).

**Request body**:
```json
{ "ackIds": ["PROJECT_ACK_ID_OPAQUE", "PROJECT_ACK_ID_OPAQUE_2"] }
```
- `ackIds` (string array, **required**, min length 1).

**Success `200`**:
```json
{
  "acknowledged": ["PROJECT_ACK_ID_OPAQUE"],
  "expired": ["PROJECT_ACK_ID_OPAQUE_2"],
  "traceId": "f47ac10b-58cc-4372-a567-0e02b2c3d479"
}
```
- `acknowledged`: ackIds removed from the subscription.
- `expired`: ackIds whose deadline had already passed (FR-020) — **non-fatal**;
  the client shows a "pull again" hint for these without breaking the panel.

**Errors**:
| Status | code | When |
|--------|------|------|
| 400 | `INVALID_QUERY` | blank ids or empty `ackIds` array |
| 401 | `PERMISSION_DENIED` | missing `pubsub.subscriptions.consume` |
| 429 | `QUOTA_EXCEEDED` | rate-limited |
| 504 | `TIMEOUT` | request timed out |
| 500 | `INTERNAL_ERROR` | unexpected failure |

---

## Cross-cutting

- **Trace IDs**: every response carries `traceId`; the `x-trace-id` header is set
  by the existing trace middleware and surfaced by `apiPost` on the client.
- **Logging**: at `info` level only operation name, resource short name, and
  message **counts** are logged — never payloads or attribute values (Principle
  V). `--verbose` raises to `debug` with redaction still applied to payloads.
- **Registration order**: `registerMessaging` is mounted after `registerPubSub`
  and before the `app.all('/api/*')` JSON-404 catch-all.
- **DI seam**: routes depend only on `createPubSubClient(projectId)` returning a
  `PubSubClientLike` with `publish`/`pull`/`acknowledge`; integration tests inject
  a `vi.fn()` adapter, so no real GCP I/O occurs in tests.
