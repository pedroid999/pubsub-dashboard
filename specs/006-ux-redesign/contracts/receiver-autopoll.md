# Contract: Receiver Auto-Poll & Message Cap

**Modules**: `src/client/components/MessageReceiver.tsx` (EDIT),
`src/client/lib/receivedMessages.ts` (EDIT — 60-cap)
**Traces**: FR-020, FR-021 · US7 · SC-006 · feature-003 FR-023

## Auto mode (opt-in)

- **R1** Given an active subscription, When the user enables **Auto**, Then the
  system pulls every **2.5 seconds**, appends results to the running list, and
  shows a clear active/polling indicator (pulsing dot).
- **R2** Given Auto is on, When the user disables it, Then automatic polling stops
  immediately and only manual **Pull** remains.
- **R3** Manual **Pull** remains available at all times, with or without Auto.

## Lifecycle (no invisible polling — FR-021 / SC-006)

- **R4** Given Auto is on, When the active subscription changes, Then auto-polling
  resets for the new subscription, the running list is cleared, and messages are
  never mixed across subscriptions (feature-003 FR-023).
- **R5** Given Auto is on, When the user leaves the receiver context (unmount),
  Then the interval is cleared (no background polling).
- **R6** Auto MUST NOT poll without the visible active indicator; disabling it (or
  changing subscription) stops it within one poll interval (SC-006).

## Error handling (FR-021)

- **R7** Given Auto polling, When a pull fails, Then the error is surfaced as in
  feature 003 and auto-polling **pauses** pending user action rather than retrying
  indefinitely.

## Running-list cap (FR-020)

- **R8** The running list is capped at the **60 newest** messages; appending beyond
  60 drops the oldest. Applies to both manual and auto appends.
- **R9** The explicit **Clear** action still empties the list entirely.
- **R10** `receivedMessagesReducer` `APPEND` enforces the cap purely (unit-tested):
  appending N messages to a list of M keeps `min(M+N, 60)` items, retaining the
  newest; `MARK_ACKNOWLEDGED` and per-subscription reset behavior are unchanged.

## Display

- **R11** Each message renders messageId + relative time, a JSON-highlighted
  payload body (display-only, reusing the composer tokenizer), attribute chips,
  and "Copy to publish" + "Acknowledge" actions (feature 003/005 behavior
  preserved, restyled).
