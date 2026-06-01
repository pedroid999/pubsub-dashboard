# Data Model: JSON Message Composer & Republish

**Feature**: 005-json-message-composer | **Date**: 2026-06-01

All entities are **client-side, in-memory** for the browser session. No database,
no persistence, no new wire schema (the publish request still uses feature 003's
`PublishRequestSchema` — `{ data: string, attributes?: Record<string,string> }`).

---

## 1. CompositionMode

```ts
type CompositionMode = 'json' | 'text';
```

- `'json'` — body is edited in the CodeMirror JSON editor; `validateJson` gates publish.
- `'text'` — body is free text (feature-003 behavior); no JSON validation enforced.

**Transitions**: user toggles modes (FR-007, body text preserved across toggle);
"Copy to publish" sets the mode automatically from the payload (FR-011).

---

## 2. JsonValidity  (output of `validateJson`, in `jsonValidation.ts`)

```ts
type JsonValidity =
  | { valid: true }
  | { valid: false; message: string; position?: number };
```

**Validation rules** (FR-002, FR-003, FR-008):
| Input | Result |
|---|---|
| `""` (empty) in JSON mode | `{ valid: false, message: 'Body is empty — enter valid JSON.' }` (edge case) |
| `{"a":1}` / `[1,2]` | `valid: true` |
| `"hello"` / `42` / `true` / `null` (bare primitive) | `valid: true` — **any** well-formed JSON value (FR-008) |
| `{"a":}` / `{a:1}` / trailing comma | `{ valid: false, message: <parser reason>, position: <index> }` (FR-003) |

`position` is derived from the `SyntaxError` message where the runtime exposes it
(e.g. "...at position N"); absent ⇒ omit. Drives the CM6 lint gutter and the
inline error text.

---

## 3. FormatResult  (output of `formatJson`, in `jsonValidation.ts`)

```ts
type FormatResult =
  | { ok: true; formatted: string }
  | { ok: false; message: string };
```

**Rules** (FR-005):
- Valid JSON (incl. primitives) ⇒ `{ ok: true, formatted: JSON.stringify(parsed, null, 2) }`.
- Invalid JSON ⇒ `{ ok: false, message }` — **no reformatting**; surfaces the parse error.

> Distinct from `jsonFormat.tryPrettyPrintJson` (receive display, FR-027), which
> treats primitives as non-JSON. Do not merge the two — different semantics.

---

## 4. AttributeRow  (reused from feature 003, `messaging.ts`)

```ts
interface AttributeRow { key: string; value: string }
```

Unchanged. Validation for publish stays `validateOutboundDraft()` (non-empty key
& value, unique keys). Copied attributes populate these rows (FR-010) and are
subject to the same validation before republish (FR-015).

---

## 5. ComposeDraftState  (the lifted publish draft, in `composeDraft.ts`)

```ts
interface CopyPayload {
  body: string;
  attributes: AttributeRow[];
  mode: CompositionMode;        // derived from payload validity (FR-011)
}

interface ComposeDraftState {
  mode: CompositionMode;        // current editor mode
  body: string;                 // current body text
  attributes: AttributeRow[];   // current attribute rows
  pendingCopy: CopyPayload | null;  // parked copy awaiting replace-confirmation (FR-012)
}
```

**Initial state**: `{ mode: 'text', body: '', attributes: [], pendingCopy: null }`
(preserves feature-003 default of free-text composition).

**Derived**: `isDirty(state) = state.body.length > 0 || state.attributes.length > 0`.
Used internally by the reducer to decide immediate-apply vs. park-pending.

---

## 6. ComposeDraftAction  (reducer actions)

```ts
type ComposeDraftAction =
  | { type: 'SET_MODE'; mode: CompositionMode }          // FR-007 toggle (body preserved)
  | { type: 'SET_BODY'; body: string }                   // editor edits (FR-001/FR-015)
  | { type: 'ADD_ATTRIBUTE' }
  | { type: 'UPDATE_ATTRIBUTE'; index: number; patch: Partial<AttributeRow> }
  | { type: 'REMOVE_ATTRIBUTE'; index: number }
  | { type: 'COPY_TO_PUBLISH'; payload: CopyPayload }    // from receiver (FR-009/FR-010)
  | { type: 'CONFIRM_COPY' }                             // apply parked pendingCopy (FR-012)
  | { type: 'CANCEL_COPY' }                              // discard pendingCopy (FR-012)
  | { type: 'RESET' };                                   // clear draft
```

**Reducer behavior (state transitions)**:

| Action | When | Effect |
|---|---|---|
| `SET_MODE` | always | swap `mode`; **keep** `body` & `attributes` (FR-007) |
| `SET_BODY` | always | replace `body` |
| `ADD/UPDATE/REMOVE_ATTRIBUTE` | always | mutate `attributes` (feature-003 parity) |
| `COPY_TO_PUBLISH` | `!isDirty(state)` | apply `payload` immediately (`mode/body/attributes`), `pendingCopy = null` |
| `COPY_TO_PUBLISH` | `isDirty(state)` | park: `pendingCopy = payload` (no overwrite yet — FR-012) |
| `CONFIRM_COPY` | `pendingCopy != null` | apply `pendingCopy` to `mode/body/attributes`, clear `pendingCopy` |
| `CANCEL_COPY` | always | `pendingCopy = null` (current draft untouched) |
| `RESET` | always | back to initial state |

**Invariant**: `COPY_TO_PUBLISH` NEVER discards a non-empty draft without an
explicit `CONFIRM_COPY` (FR-012). This is the testable heart of the safety rule.

---

## 7. CopyPayload construction (Receiver → reducer, FR-010/FR-011/FR-014)

Given a `DisplayedMessage` (feature 003 `receivedMessages.ts`):

| Source field | Rule |
|---|---|
| `dataEncoding === 'base64'` | **not copyable** — "Copy to publish" disabled (FR-014); no payload built |
| `data` (utf-8) parses as valid JSON | `mode='json'`, `body = formatJson(data).formatted` (pretty-printed, FR-011) |
| `data` (utf-8) not valid JSON | `mode='text'`, `body = data` (FR-011) |
| `attributes: Record<string,string>` | mapped to `AttributeRow[]` (`{key,value}` per entry, FR-010) |

---

## Entity relationships

```text
DisplayedMessage (feature 003, receive list)
      │  "Copy to publish" (disabled if base64)
      ▼
CopyPayload  ──COPY_TO_PUBLISH──▶  ComposeDraftState
                                        │  body ──validateJson──▶ JsonValidity ──gates──▶ Publish enabled?
                                        │  body ──formatJson──▶ FormatResult ("Format" button)
                                        │  attributes ──validateOutboundDraft──▶ publish (feature 003 path, unchanged)
                                        ▼
                                   POST /api/projects/{p}/topics/{t}/publish  { data, attributes }
```
