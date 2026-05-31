# Quickstart: Publish & Subscribe

**Branch**: `003-publish-subscribe` | **Date**: 2026-05-31

How to exercise the messaging round-trip locally once implemented. Prerequisites:
features 001 (boot/auth) and 002 (resource browser) are in place, and you have
ADC configured (`gcloud auth application-default login`).

## Run

```bash
npm ci
npx pubsub-dashboard            # boots loopback server + opens browser
# or, with payload-level logs:
npx pubsub-dashboard --verbose
```

## Publish a message (US1 + US3)

1. Browse to a project, then click a **topic** to set it as the active context.
2. In the **Publish** panel (shows the active topic path), type a message body —
   e.g. `{"orderId": 42, "status": "paid"}`.
3. (Optional) Add attribute rows, e.g. `eventType = order.paid`.
4. Click **Publish**. A success confirmation shows the returned **message ID**.
   The body and attributes stay put so you can publish again (FR-007).

Guardrails you can verify:
- Empty body → inline validation, nothing sent (FR-003).
- Duplicate attribute key or half-filled row → inline validation (FR-006).
- No topic selected → guidance state, publish disabled (FR-009).

## Pull and read messages (US2)

1. Click a **subscription** to set it as the active context.
2. In the **Receive** panel, click **Pull**. Up to **10** available messages
   render, each showing payload (JSON pretty-printed), attributes, message ID and
   publish time (FR-011/FR-012/FR-027).
3. Click **Pull** again — new messages **append** to the running list (FR-026).
4. Click **Clear** to empty the list (US2 AS8).

Guardrails:
- No messages available → "no messages currently available" state, not an error
  (FR-013).
- Non-text payload → labelled binary (base64) block, list stays intact (FR-014).
- No subscription selected → guidance state, pull disabled (FR-015).

## Acknowledge (US4)

1. On a pulled message, click **Acknowledge**. It is marked acknowledged (FR-019).
2. **Pull** again after the ack deadline — acknowledged messages do not return;
   unacknowledged ones do (FR-016, non-destructive default).

## Full round trip (SC-007)

Publish a message to a topic, then pull from a subscription attached to that
topic and confirm the same body + attributes arrive intact (SC-002).

## Tests

```bash
npm run lint && npx tsc --noEmit
npm run test -- --coverage          # vitest, ≥90% line+branch on src/**
npm run test:e2e                    # playwright smoke incl. a publish round-trip shape
```

Key new tests:
- `tests/integration/routes.messaging.test.ts` — publish / pull / ack, success +
  empty pull + 400 validation + permission/quota/timeout mappings (mocked
  `createPubSubClient`, no GCP I/O).
- `tests/unit/receivedMessages.test.ts` — append / clear / mark-acknowledged.
- `tests/unit/jsonFormat.test.ts` — pretty-print JSON / pass-through / non-UTF-8.
- `tests/unit/messagingApi.test.ts` — `apiPost` success + `ApiError` mapping.
