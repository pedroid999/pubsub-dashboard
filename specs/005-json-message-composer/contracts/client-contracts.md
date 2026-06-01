# Contracts: JSON Message Composer & Republish

**Feature**: 005-json-message-composer | **Date**: 2026-06-01

This feature exposes **no new HTTP API**. Its contracts are (A) the **reused,
unchanged** publish HTTP contract from feature 003, and (B) **client module
contracts** (pure cores + the compose-draft context) that the UI is built against
and that the unit tests pin.

---

## A. HTTP API — REUSED, UNCHANGED (FR-020)

`POST /api/projects/{projectId}/topics/{topicId}/publish` — feature 003.

Request (`PublishRequestSchema`, `src/server/schemas/messaging.ts`):
```json
{ "data": "<string payload>", "attributes": { "k": "v" } }
```
Response (`PublishResponseSchema`):
```json
{ "messageId": "<id>", "traceId": "<uuid>" }
```

**Contract guarantee for this feature (FR-006)**: when publishing from JSON mode,
the client sends `data` = the exact JSON text the editor shows (validated/
formatted by the user); the server still treats `data` as an opaque string. No
field is added, removed, or reinterpreted. Pull and ack contracts are untouched.

---

## B. Client module contracts

### B.1 `src/client/lib/jsonValidation.ts` (NEW — pure)

```ts
export type JsonValidity =
  | { valid: true }
  | { valid: false; message: string; position?: number };

export type FormatResult =
  | { ok: true; formatted: string }
  | { ok: false; message: string };

/** Well-formedness check. ANY valid JSON value is valid, incl. primitives (FR-008). */
export function validateJson(text: string): JsonValidity;

/** Pretty-print any valid JSON (2-space). Invalid → { ok:false } (FR-005). */
export function formatJson(text: string): FormatResult;
```

**Contract**:
- `validateJson('')` → `{ valid:false, message:'Body is empty — enter valid JSON.' }`.
- `validateJson('{"a":1}')`, `validateJson('42')`, `validateJson('"x"')`,
  `validateJson('true')`, `validateJson('null')` → `{ valid:true }`.
- `validateJson('{a:1}')` → `{ valid:false, message, position? }`.
- `formatJson('{"a":1}')` → `{ ok:true, formatted:'{\n  "a": 1\n}' }`.
- `formatJson('nope')` → `{ ok:false, message }`.
- **Pure**: no I/O, no globals, deterministic. Must reach ≥90% branch coverage.

### B.2 `src/client/lib/composeDraft.ts` (NEW — reducer + context)

```ts
export type CompositionMode = 'json' | 'text';
export interface CopyPayload { body: string; attributes: AttributeRow[]; mode: CompositionMode }
export interface ComposeDraftState {
  mode: CompositionMode; body: string; attributes: AttributeRow[]; pendingCopy: CopyPayload | null;
}
export type ComposeDraftAction = /* see data-model.md §6 */;

export const initialComposeDraftState: ComposeDraftState;
export function composeDraftReducer(s: ComposeDraftState, a: ComposeDraftAction): ComposeDraftState;
export const ComposeDraftProvider: React.FC<{ children: React.ReactNode }>;
export function useComposeDraft(): { state: ComposeDraftState; dispatch: React.Dispatch<ComposeDraftAction> };

/** Build a CopyPayload from a received message; null if not copyable (base64, FR-014). */
export function copyPayloadFromMessage(m: DisplayedMessage): CopyPayload | null;
```

**Reducer contract** (the safety-critical invariants — pinned by unit tests):
- `COPY_TO_PUBLISH` on an **empty** draft applies immediately.
- `COPY_TO_PUBLISH` on a **dirty** draft parks `pendingCopy` and leaves
  `body/attributes/mode` untouched (FR-012) — **no silent overwrite**.
- `CONFIRM_COPY` applies `pendingCopy` then clears it; `CANCEL_COPY` clears it
  without touching the draft.
- `SET_MODE` preserves `body` and `attributes` (FR-007).
- `copyPayloadFromMessage`: base64 → `null`; valid-JSON utf-8 → `mode:'json'`,
  pretty-printed body; other utf-8 → `mode:'text'`, raw body; attributes mapped
  to rows.

### B.3 `src/client/components/JsonEditor.tsx` (NEW)

```ts
export interface JsonEditorProps {
  value: string;
  onChange: (next: string) => void;
  validity: JsonValidity;          // drives lint gutter + aria
  'data-testid'?: string;
}
export function JsonEditor(props: JsonEditorProps): JSX.Element;
```

**Contract**: controlled component (value/onChange) wrapping `@uiw/react-codemirror`
with `@codemirror/lang-json` highlight and a `@codemirror/lint` linter fed from
`validity`. Renders a visible valid/invalid indicator. No network, no Pub/Sub.

### B.4 Component wiring (edits)

- `MessagePublisher`: consumes `useComposeDraft()`; renders mode toggle, `JsonEditor`
  (json mode) or `<textarea>` (text mode), a **Format** button (calls `formatJson`),
  the validity indicator, and a **replace-confirm banner** when `pendingCopy != null`.
  Publish is disabled in json mode while `validateJson(body).valid === false` (FR-003/FR-004).
  Existing feature-003 guards remain: no-topic guidance, preserve-on-success/failure,
  message-ID confirmation, attribute validation.
- `MessageReceiver`: per-message **"Copy to publish"** button; disabled when
  `dataEncoding === 'base64'` (FR-014). On click: `dispatch({ type:'COPY_TO_PUBLISH',
  payload: copyPayloadFromMessage(m)! })`.
- `App`: wraps the publish+receive panels in `<ComposeDraftProvider>`.

---

## Test contract (Principle II)

| Target | Test file | Kind | Gate |
|---|---|---|---|
| `jsonValidation` | `tests/unit/jsonValidation.test.ts` | unit (pure) | ≥90% branch |
| `composeDraftReducer` + `copyPayloadFromMessage` | `tests/unit/composeDraft.test.ts` | unit (pure) | ≥90% branch |
| `MessagePublisher` | `tests/integration/MessagePublisher.test.tsx` | component | mode toggle, invalid-blocks-publish, format, copied-draft render, replace-confirm |
| `MessageReceiver` | `tests/integration/MessageReceiver.test.tsx` | component | copy present, disabled for base64, dispatches copy |
| republish loop | `tests/e2e/republish.spec.ts` | Playwright | pull → copy → edit → republish round-trip |
