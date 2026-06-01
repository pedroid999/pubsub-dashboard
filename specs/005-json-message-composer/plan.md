# Implementation Plan: JSON Message Composer & Republish

**Branch**: `005-json-message-composer` | **Date**: 2026-06-01 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/005-json-message-composer/spec.md`

## Summary

Upgrade the feature-003 publish composer from an opaque free-text `<textarea>` to a
**JSON-aware editor** with live well-formedness validation, an inline error
indicator/position, a "Format" (pretty-print) action, and a JSON⇄plain-text mode
toggle — and connect the receive panel back into it via **"Copy to publish"**,
which loads a received message's payload and attributes into the composer for
edit-and-republish. This closes the debugging loop: pull → inspect → copy → edit
(validated) → republish.

**Technical approach** (from research): the work is **client-side only** (FR-020).
Reuse the existing `POST …/topics/{id}/publish` path unchanged. Add (1) a pure
`jsonValidation.ts` core (validate/format any well-formed JSON value incl.
primitives), (2) a CodeMirror 6 JSON editor component (`@uiw/react-codemirror`),
and (3) a lifted `composeDraft` reducer + `ComposeDraftProvider` that owns the
publish draft and the cross-panel copy/replace-confirmation. `MessagePublisher`
becomes driven by the reducer; `MessageReceiver` gains a per-message "Copy to
publish" action (disabled for binary payloads).

## Technical Context

**Language/Version**: TypeScript 5.6+ (`strict: true`), Node.js ≥ 20 LTS — unchanged from features 001–004.

**Primary Dependencies**:
- Existing: React 18, Vite 5, Hono 4, `zod`, Tailwind, `lucide-react`, `@google-cloud/pubsub` (server, untouched here).
- **New (client runtime)**: `@uiw/react-codemirror`, `@codemirror/lang-json`, `@codemirror/lint` (+ transitive `@codemirror/state`/`view`). One editor family only — **no Monaco** (constitution: "Monaco or CodeMirror 6, one not both"). Requires PR justification (Principle V) — provided in research.md Decision 1.

**Storage**: N/A. Draft + copied messages live in client-side React state for the browser session only (consistent with feature 003). No persistence, no new config file.

**Testing**: `vitest` + `@vitest/coverage-v8` (≥90% line AND branch) for the pure cores (`jsonValidation.ts`, `composeDraft` reducer) and component tests (`@testing-library/react`); `@playwright/test` for an E2E republish round-trip extending the feature-003 smoke flow.

**Target Platform**: Local-only browser app served by the single Hono process, bound to `127.0.0.1` (unchanged).

**Project Type**: Single-process Node web app (Hono API + Vite-built React client).

**Performance Goals**: Preserve the < 3 s cold-start budget — CM6 chosen specifically to stay within the bundle-size CI gate. JSON validation runs on keystroke and MUST be imperceptible (pure `JSON.parse`, no async).

**Constraints**: No new server endpoint, no new Pub/Sub operation, no auth-path or boot-path change (FR-019/FR-020). Auth, if ever needed, consumed only via `auth/index.ts` (not applicable here — purely client work).

**Scale/Scope**: ~2 new client lib modules (`jsonValidation.ts`, `composeDraft.ts`), 1 new editor component (`JsonEditor.tsx`), edits to `MessagePublisher.tsx`, `MessageReceiver.tsx`, `App.tsx`. Single message under composition; up to 10 messages in the receive list (feature 003 bound).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|---|---|---|
| **I. Local-First & Zero-Config** | ✅ PASS | No remote backend, telemetry, or new config. All logic runs in the browser; no data leaves the machine. No new outbound calls. |
| **II. Test-First (NON-NEGOTIABLE)** | ✅ PASS (planned) | Validation and compose-draft logic isolated as **pure functions/reducers** → unit-tested first to ≥90% branch. Component tests for editor + copy flow; Playwright republish round-trip on PR. Red-Green-Refactor enforced in tasks. |
| **III. Type Safety End-to-End** | ✅ PASS | `strict: true` maintained; no new `any`. New types (`JsonValidity`, `ComposeDraftState`/actions, `CompositionMode`) are explicit. The publish wire contract is unchanged `zod` (`PublishRequestSchema`) — no new schema needed; CM6 boundary typed via wrapper. |
| **IV. Instant Developer Experience** | ✅ PASS | CM6 chosen over Monaco precisely to protect the < 3 s cold-start budget. No change to boot/quickstart. Validation errors are inline and actionable. |
| **V. Operational Excellence (Obs/Sec/Simplicity)** | ✅ PASS w/ note | **Security**: no new network surface; CSP unaffected. **Simplicity/YAGNI**: scope bounded to JSON well-formedness + pretty-print (no JSON-Schema, templating, or saved templates). **Dependency addition**: 3 new client deps (CM6 family) — justified with alternatives in research.md Decision 1, as Principle V requires. |

**Result**: PASS. No violations → **Complexity Tracking left empty**.

**Post-Phase-1 re-check**: PASS (design introduces only pure cores + one context + one editor component, all within the documented extension surface; see data-model.md and contracts/).

## Project Structure

### Documentation (this feature)

```text
specs/005-json-message-composer/
├── plan.md              # This file (/speckit-plan output)
├── research.md          # Phase 0 — editor/validation/transfer decisions
├── data-model.md        # Phase 1 — entities, reducer state/actions, validation rules
├── quickstart.md        # Phase 1 — how to exercise the feature manually
├── contracts/
│   └── client-contracts.md   # Phase 1 — client module contracts + reused (unchanged) HTTP contract
├── checklists/
│   └── requirements.md  # Spec quality checklist (from /speckit-specify)
└── tasks.md             # Phase 2 — /speckit-tasks output (NOT created here)
```

### Source Code (repository root)

```text
src/client/
├── lib/
│   ├── jsonValidation.ts       # NEW — pure validateJson() / formatJson() (FR-002..FR-005, FR-008)
│   ├── composeDraft.ts         # NEW — reducer + context + provider + hook (FR-007, FR-009..FR-016)
│   ├── jsonFormat.ts           # UNCHANGED — receive-display pretty-print (FR-027, different semantics)
│   ├── messaging.ts            # UNCHANGED — publishMessage(), validateOutboundDraft() reused
│   └── receivedMessages.ts     # UNCHANGED — receive list reducer (source of "copy" payloads)
├── components/
│   ├── JsonEditor.tsx          # NEW — CodeMirror 6 wrapper: highlight + lint gutter from validateJson
│   ├── MessagePublisher.tsx    # EDIT — driven by composeDraft; JSON/text mode toggle; Format; validity gate
│   ├── MessageReceiver.tsx     # EDIT — per-message "Copy to publish" (disabled for base64)
│   └── ResourceContextProvider.tsx  # UNCHANGED
└── App.tsx                     # EDIT — wrap publish+receive panels in <ComposeDraftProvider>

tests/
├── unit/
│   ├── jsonValidation.test.ts  # NEW — valid/invalid/primitive/empty/format cases (≥90% branch)
│   └── composeDraft.test.ts    # NEW — reducer: load, mode-select, dirty→pending, confirm/cancel, clear
├── integration/ (component)
│   ├── MessagePublisher.test.tsx  # EDIT/NEW — mode toggle, invalid blocks publish, format, copied draft
│   └── MessageReceiver.test.tsx   # EDIT/NEW — copy action present, disabled for base64, dispatches copy
└── e2e/
    └── republish.spec.ts       # NEW — pull → copy → edit field (stays valid) → republish round-trip

# Server: NO CHANGES. No new route/schema. POST …/topics/{id}/publish reused as-is (FR-020).
```

**Structure Decision**: Single-project web app layout (already in use). This feature
lands entirely under `src/client/**` plus its tests, following the documented
extension surface in `docs/extension-points.md` (extend existing UI + client lib;
do not touch `bin/`, `src/server/boot.ts`, or `src/server/auth/**`). The server is
untouched because the publish endpoint already satisfies the wire need.

## Complexity Tracking

> No constitution violations. Table intentionally empty.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| — | — | — |
