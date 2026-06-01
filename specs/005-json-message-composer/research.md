# Research: JSON Message Composer & Republish

**Feature**: 005-json-message-composer | **Date**: 2026-06-01

This feature is **client-side only** (spec FR-020): it adds JSON-aware composition,
validation, formatting, and "copy received message to republish" on top of the
publish path already delivered by feature 003. No new server endpoints, no new
Pub/Sub operations, no schema changes to the HTTP API. The research therefore
focuses on three decisions: the JSON editor, the validation/format core, and how
a received message is transferred into the publish composer.

---

> **⚠️ Superseded at implementation time (2026-06-01).** Decision 1 below picked
> CodeMirror 6 during planning. At implementation, three facts reversed it:
> (1) the test harness (jsdom) has no CM6 DOM-measurement polyfills; (2) the
> coverage gate is 90% on lines/branches/functions; (3) **no functional
> requirement needs syntax highlighting**. A JSON-aware `<textarea>` + the pure
> `validateJson`/`formatJson` cores satisfies FR-001..FR-008 with zero bundle
> cost and better Principle IV/V alignment. **Final decision: no editor
> dependency — JSON-aware textarea folded into `MessagePublisher`.** The
> CM6-vs-Monaco analysis below is retained for the record; the constitution line
> constrains *which* heavy editor *if one is adopted* — adopting none is allowed.

## Decision 1 — JSON editor: CodeMirror 6 (via `@uiw/react-codemirror`)  *(SUPERSEDED — see note above)*

**Decision**: Introduce **CodeMirror 6** as the JSON editor, using the React
wrapper `@uiw/react-codemirror` with `@codemirror/lang-json` (syntax highlight)
and `@codemirror/lint` (inline error gutter fed by our own validator).

**Rationale**:
- The constitution's Technology Constraints fix the JSON editor to **"Monaco or
  CodeMirror 6 (one, not both)"**. This is the first feature to introduce a JSON
  editor, so the choice is made here and binds all future features.
- **Principle IV (Instant DX, < 3 s cold start)** + the **bundle-size budget**
  CI gate are decisive. Monaco ships ~2 MB+ and requires web-worker wiring and
  Vite worker config; CodeMirror 6 is modular, tree-shakeable, a few hundred KB,
  and Vite-native with zero worker setup.
- **Principle V (Simplicity/YAGNI)**: we need well-formedness validation, error
  positioning, pretty-print, and syntax highlight — CM6 covers all four with a
  small footprint. Monaco's IntelliSense/multi-language weight is unused.
- `@uiw/react-codemirror` is a thin, well-maintained controlled-component wrapper
  that fits the existing controlled-input pattern in `MessagePublisher`.

**Alternatives considered**:
| Alternative | Rejected because |
|---|---|
| **Monaco Editor** | Bundle weight (~2 MB+) and web-worker complexity conflict with the < 3 s cold-start budget and YAGNI. Its language-server features are unused for a single-payload JSON box. |
| **Plain `<textarea>` + `JSON.parse`** (no editor dep) | Constitution mandates a real JSON editor when one is introduced. A textarea cannot show an inline error gutter or syntax highlighting; error *position* (FR-003) would be text-only. Kept as the conceptual fallback but rejected on constitution grounds. |
| **CodeMirror 6 raw packages + hand-rolled React wrapper** | More control but more boilerplate (imperative `EditorView` lifecycle in `useEffect`). The `@uiw` wrapper removes that churn at a negligible size cost. |

**New runtime dependencies (Principle V — justification required in PR)**:
`@uiw/react-codemirror`, `@codemirror/lang-json`, `@codemirror/lint`
(transitively `@codemirror/*` state/view). One editor family only — no Monaco.

---

## Decision 2 — Validation & formatting core: a new pure `jsonValidation.ts`

**Decision**: Add a new pure, dependency-free module
`src/client/lib/jsonValidation.ts` exporting:
- `validateJson(text): JsonValidity` — `{ valid: true }` or
  `{ valid: false, message, position? }`, using `JSON.parse` in try/catch and
  deriving the error position from the parser message where available.
- `formatJson(text): { ok: true; formatted } | { ok: false; message }` —
  pretty-prints **any** well-formed JSON value with 2-space indent.

The CodeMirror lint extension is fed from `validateJson` so the editor gutter and
the publish-enable gate share **one** source of truth.

**Rationale**:
- **Principle II (Test-First, ≥90% branch coverage)**: a pure function is trivially
  unit-tested across valid objects/arrays/primitives, empty input, and malformed
  input. Keeping the rule out of the React component is what makes the 90% gate
  cheap.
- **Distinct from the existing `jsonFormat.tryPrettyPrintJson`**: that helper is
  for the *receive display* (FR-027) where primitives are intentionally shown
  *as-is* and only objects/arrays count as "JSON". The composer has different
  semantics — **any** well-formed JSON value is valid (spec **FR-008**), incl.
  `"hello"`, `42`, `true`, `null`. Two different rules → two different modules;
  do **not** overload `jsonFormat.ts`.

**Alternatives considered**:
- Reuse `tryPrettyPrintJson` for the composer — rejected: it reports primitives
  as `isJson: false`, which would wrongly block publishing a valid bare JSON value
  (violates FR-008).
- A schema/AST JSON library (e.g. `jsonc-parser`) for richer error positions —
  rejected (YAGNI): native `JSON.parse` + CM6's `@codemirror/lang-json` linting
  already give adequate position info without another dependency.

---

## Decision 3 — Transferring a received message into the composer: a lifted `composeDraft` reducer + context

**Decision**: Introduce `src/client/lib/composeDraft.ts` — a reducer + React
context (`ComposeDraftProvider`, `useComposeDraft`) modeled on the existing
`resourceContext.ts` — that **owns the publish draft** (body, attribute rows,
composition mode) and the pending-copy confirmation. `App.tsx` wraps the
publish+receive panels in `ComposeDraftProvider` (the two are already siblings
under `ResourceContextProvider`). `MessageReceiver` dispatches a copy;
`MessagePublisher` becomes driven by the draft state.

**Rationale**:
- `MessagePublisher` and `MessageReceiver` are sibling components that share no
  state today. "Copy to publish" must move data **from** the receiver **into** the
  publisher's composer — that requires shared state above both.
- Lifting the draft (currently `useState` inside `MessagePublisher`) into a
  reducer makes the copy/replace-confirmation/mode-selection logic a **pure,
  fully unit-testable reducer** (Principle II), mirroring how `resourceContext`
  and `receivedMessages` already work in this codebase. This is consistent with
  the established pattern, not a new paradigm.
- Replace-confirmation (**FR-012**) is computed inside the reducer from its own
  `isDirty` view of the draft: a `COPY_TO_PUBLISH` action applies immediately when
  the draft is empty, or parks a `pendingCopy` when dirty; the publisher renders a
  confirm banner that dispatches `CONFIRM_COPY` / `CANCEL_COPY`. No component owns
  the dirtiness check — the reducer does.

**Mode auto-selection on copy (FR-011)**: the reducer runs `validateJson` on the
received payload — valid JSON ⇒ load in `json` mode pretty-printed; otherwise load
in `text` mode. Binary/base64 payloads (`dataEncoding === 'base64'`) are **not
copyable**: the receiver disables "Copy to publish" for them (**FR-014**), so no
unusable bytes ever enter the editor.

**Alternatives considered**:
- Keep `body`/`attributes` as `MessagePublisher` local `useState` and push copies
  via a callback prop threaded through `App` — rejected: spreads the copy/confirm
  logic across components and props, hard to unit-test, drifts from the existing
  context+reducer convention.
- A global store (Zustand/Redux) — rejected (YAGNI + Principle V): the codebase
  uses `useReducer` + context; a new state library is an unjustified dependency.

---

## Resolved unknowns

| Question | Resolution |
|---|---|
| Which JSON editor? | CodeMirror 6 (`@uiw/react-codemirror` + `@codemirror/lang-json` + `@codemirror/lint`). Not Monaco. |
| New server work? | None. Publish path (`POST …/topics/{id}/publish`, `data: string`) is reused unchanged (FR-020). |
| Validation semantics? | Any well-formed JSON value is valid incl. primitives (FR-008) — new `jsonValidation.ts`, NOT `jsonFormat.ts`. |
| Cross-panel copy? | Lifted `composeDraft` reducer + `ComposeDraftProvider` wrapping both panels. |
| Replace-confirmation? | Reducer parks `pendingCopy` when draft is dirty; publisher confirms/cancels (FR-012). |
| Binary payloads? | "Copy to publish" disabled for base64 messages (FR-014). |

**No `NEEDS CLARIFICATION` items remain.**
