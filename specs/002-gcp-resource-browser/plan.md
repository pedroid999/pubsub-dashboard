# Implementation Plan: GCP Resource Browser

**Branch**: `002-gcp-resource-browser` | **Date**: 2026-05-31 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/002-gcp-resource-browser/spec.md`

## Summary

Add a GCP Resource Browser to the Pub/Sub Dashboard: the user can list all GCP
projects accessible via their ADC credentials, navigate into any project to see
its Pub/Sub topics and subscriptions side by side, filter all three lists in
real time via client-side search inputs (partial, case-insensitive, with match
highlighting), and select a topic or subscription as the active context for
future publish/subscribe operations.

The server exposes three new Hono endpoints (`/api/projects`,
`/api/projects/:projectId/topics`, `/api/projects/:projectId/subscriptions`),
backed by the Cloud Resource Manager v3 REST API (via `google-auth-library`) for
project listing and by the `@google-cloud/pubsub` Admin API for topic and
subscription listing. The React client gains a `ResourceContextProvider` (React
Context + `useReducer`, per-project hashmap), a `ProjectBrowser`, a
`ResourceBrowser`, and a `ResourceList` component. All filtering is performed
entirely client-side over already-fetched data.

## Technical Context

**Language/Version**: TypeScript 5.6+, Node.js ≥ 20 LTS (unchanged from feature 001)

**Primary Dependencies**:

- **New runtime**: `@google-cloud/pubsub` — listing topics and subscriptions.
  The constitution explicitly mandates this SDK as the only supported Pub/Sub
  client. Justified in `research.md` R1.
- **Existing runtime** (no new packages beyond the above): `hono`,
  `google-auth-library` (project listing via CRM v3 REST), `zod`, `pino`,
  `react`, `react-dom`, `tailwindcss`, `lucide-react`.
- **Existing devDependencies** (unchanged): all tooling from feature 001.

**Storage**: N/A — no new persistent state. The per-project resource context is
held in React client-side memory for the browser session only.

**Testing**:

- Unit + integration: `vitest` with `@vitest/coverage-v8`, threshold ≥90% line
  and branch on `src/**` (same exclusions as feature 001).
- New integration tests: `routes.projects.test.ts`, `routes.pubsub.test.ts` —
  exercise the three new endpoints via `app.request()` (no I/O; Google SDK calls
  mocked with `vi.mock`).
- New unit tests: `resourceContext.test.ts` (per-project hashmap reducer),
  `resourceFilter.test.ts` (case-insensitive partial match, highlight logic).
- E2E: existing Playwright smoke extended to verify the `/api/projects` endpoint
  returns a valid response shape.

**Target Platform**: macOS + Linux (same as feature 001). No change to the
deployment model.

**Project Type**: Single-process Node web app (Hono + Vite-built React, same
single-process model as feature 001).

**Performance Goals**:

- `GET /api/projects` response time: < 3 s p95 (SC-001 — matches project list
  display target).
- `GET /api/projects/:id/topics` and `/subscriptions`: < 5 s p95 (SC-002).
- Client-side filter keystroke → list update: < 16 ms (imperceptible; no
  debounce needed for in-memory operations on <500 items).
- Cold-start budget (< 3 s) is unaffected: the new endpoints are not called
  during boot.

**Constraints**:

- All GCP API calls are outbound only to `*.googleapis.com` (Principle I).
- No credentials or topic/message content in logs unless `--verbose` (Principle V).
- `@google-cloud/pubsub` client is instantiated per request (stateless);
  no persistent connection state that could survive process restart is held by
  the application beyond what the SDK manages internally.
- No new client-side dependencies beyond what is already in `package.json`.
  Filtering uses native JS string operations; no `fuse.js` or similar library.

**Scale/Scope**: Single authenticated GCP identity, potentially dozens of
projects, up to ~500 topics/subscriptions per project rendered without
virtualization.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Local-First & Zero-Config** — ✅ The three new endpoints call
  `googleapis.com` only (`cloudresourcemanager.googleapis.com` and
  `pubsub.googleapis.com`). No remote backend, no telemetry, no `0.0.0.0`
  bind. Auth continues through `google-auth-library` ADC; no new credential
  handling introduced.
- **II. Test-First (NON-NEGOTIABLE)** — ✅ Plan schedules contract/integration
  tests for all three new endpoints before implementation. Unit tests for the
  reducer and filter logic precede component implementation. ≥90% line+branch
  coverage maintained. Playwright smoke extended to cover the new
  `/api/projects` endpoint.
- **III. Type Safety End-to-End** — ✅ All new request/response shapes defined
  as `zod` schemas in `src/server/schemas/pubsub.ts`, shared with the React
  client. No new `any`. `tsc --noEmit` remains clean; `AppEnv` type extended
  only if new Hono variables are required.
- **IV. Instant DX (One-Command UX)** — ✅ Boot path is unchanged; the new
  endpoints are not invoked during cold start. Quota-exceeded (429) and
  permission (403) errors produce specific, actionable messages per FR-025 and
  FR-010. README quickstart is unaffected.
- **V. Operational Excellence** — ✅
  - `@google-cloud/pubsub` justified: constitution mandates it as the only
    supported Pub/Sub client; direct REST is a valid alternative but would
    require re-implementing pagination, retry, and proto unmarshalling.
  - `pino` trace IDs propagated to all three new endpoints via existing
    `traceMiddleware`.
  - No topic names, project IDs, or subscription names written to logs at
    `info` level; `debug`/`trace` only (guarded by `--verbose`).
  - No new persistent state; per-project context is client-side session memory.

**Verdict**: No violations. `@google-cloud/pubsub` addition is justified and
alternatives-considered documented in `research.md`.

## Project Structure

### Documentation (this feature)

```text
specs/002-gcp-resource-browser/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── contracts/
│   └── http-api.md      # Phase 1 output (3 new endpoints)
├── checklists/
│   └── requirements.md  # Already created by /speckit.specify
└── tasks.md             # Phase 2 output (NOT created by /speckit.plan)
```

### Source Code (additions to repository root)

The feature follows the extension contract in `docs/extension-points.md` exactly:
one route file, one schema file, one registration call in `buildServer`, and
React components in `src/client/components/`.

```text
src/
├── server/
│   ├── routes/
│   │   ├── projects.ts          # GET /api/projects
│   │   └── pubsub.ts            # GET /api/projects/:projectId/topics
│   │                            # GET /api/projects/:projectId/subscriptions
│   └── schemas/
│       └── pubsub.ts            # zod: GcpProject, Topic, Subscription, PubSubError
├── client/
│   ├── components/
│   │   ├── ProjectBrowser.tsx   # project list + search input + project selection
│   │   ├── ResourceBrowser.tsx  # two-panel: topics + subscriptions with filters
│   │   ├── ResourceList.tsx     # generic filterable list (shared by both panels)
│   │   └── ContextIndicator.tsx # active context badge (project / topic / sub)
│   └── lib/
│       └── resourceContext.ts   # React Context + useReducer (per-project hashmap)

tests/
├── integration/
│   ├── routes.projects.test.ts  # GET /api/projects — mocked CRM v3
│   └── routes.pubsub.test.ts    # GET topics + subs — mocked @google-cloud/pubsub
└── unit/
    ├── resourceContext.test.ts  # reducer: select, clear, per-project isolation
    └── resourceFilter.test.ts  # filter: partial match, case-insensitivity, highlight
```

`src/server/server.ts` `buildServer` is updated with two new `register*` calls
(between the existing API routes and the `app.all('/api/*')` catch-all), following
the existing pattern for `registerHealth`, `registerSession`, `registerDiagnostics`.

**Structure Decision**: Single-project layout unchanged. New files slot directly
into the established `routes/` + `schemas/` + `components/` pattern from
`docs/extension-points.md` without touching `boot.ts`, `auth/**`, or `bin/`.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No violations recorded. Table intentionally empty.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|--------------------------------------|
| _(none)_  | _(n/a)_    | _(n/a)_                              |
