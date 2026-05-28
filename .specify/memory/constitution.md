<!--
SYNC IMPACT REPORT
==================
Version change: (uninitialized template) → 1.0.0
Bump rationale: MAJOR — initial ratification of the project constitution.

Modified principles: N/A (first ratification; all five principles newly defined).

Added sections:
- Core Principles (5)
  - I. Local-First & Zero-Config
  - II. Test-First (NON-NEGOTIABLE)
  - III. Type Safety End-to-End
  - IV. Instant Developer Experience (One-Command UX)
  - V. Operational Excellence (Observability, Security, Simplicity)
- Technology Constraints
- Development Workflow & Quality Gates
- Governance

Removed sections: None.

Templates requiring updates:
- ✅ .specify/templates/plan-template.md — Constitution Check section to reference
  the five principles by name (gate description updated).
- ✅ .specify/templates/tasks-template.md — Test tasks flipped from OPTIONAL to
  MANDATORY to align with Principle II (Test-First).
- ✅ .specify/templates/spec-template.md — No change required (principle-agnostic).
- ✅ .windsurf/workflows/speckit.*.md — Read-only scan; no stale references found.

Follow-up TODOs:
- TODO(README.md): Principle IV requires a quickstart README exercised by CI.
  Defer to the bootstrap feature handled by /speckit.specify + /speckit.plan.
- TODO(CONTRIBUTING.md): Optional, not blocking ratification.
-->

# Pub/Sub Dashboard Constitution

## Core Principles

### I. Local-First & Zero-Config

The application MUST run entirely on the developer's machine. No proprietary
remote backend, telemetry endpoint, or third-party data sink is permitted.
`npx pubsub-dashboard` MUST work end-to-end with only Google Cloud Application
Default Credentials (`gcloud auth application-default login`) configured; no
manual configuration files, environment variables, or build steps may be
required for first run. The HTTP server MUST bind exclusively to `127.0.0.1`
and MUST refuse external interfaces. Credentials, message payloads, and
project metadata MUST never leave the developer's machine.

**Rationale**: This is a local developer tool for inspecting and operating
production Pub/Sub topics. Any non-local data flow is both a security risk
(payloads may contain PII) and a friction point that breaks the "instant
team adoption" goal.

### II. Test-First (NON-NEGOTIABLE)

Test-Driven Development is mandatory. The Red-Green-Refactor cycle MUST be
followed: failing tests are written and reviewed before implementation
begins. Every Hono endpoint MUST have a contract test. Every business rule
MUST have a unit test. Vitest line coverage AND branch coverage MUST be
≥90%; CI MUST fail below that threshold. A Playwright end-to-end smoke test
MUST exercise `npx pubsub-dashboard` boot, browser open, authentication
flow, and at least one publish/subscribe round-trip on every PR.

**Rationale**: Pub/Sub bugs in production tooling cause data loss or duplicate
delivery. Coverage and contract tests are the only mechanism that scales as
the team grows. The 90% gate is set deliberately above the "comfortable"
80% to force discipline from day one.

### III. Type Safety End-to-End

TypeScript `strict: true` is mandatory across server and client.
`noImplicitAny`, `strictNullChecks`, and `noUncheckedIndexedAccess` MUST be
enabled. Explicit `any` is forbidden except at clearly documented external
boundaries (e.g., raw Pub/Sub message attributes), where it MUST be
narrowed via a `zod` schema before crossing into application code. Request
and response shapes MUST be defined as `zod` schemas shared between client
and server; the inferred TypeScript types are the single source of truth.
`tsc --noEmit` MUST be a blocking gate in CI.

**Rationale**: A dashboard that lies about message shapes is worse than no
dashboard. Shared `zod` schemas eliminate an entire class of contract
drift between Hono handlers and the React client.

### IV. Instant Developer Experience (One-Command UX)

`npx pubsub-dashboard` MUST open the browser to the working dashboard in
under 3 seconds on a warm npm cache. Authentication, network, and quota
errors MUST surface as actionable, copy-pastable remediation messages
(e.g., "Run `gcloud auth application-default login` and retry"). The
`README.md` MUST contain a quickstart that takes a new team member from a
clean machine to a running dashboard, and that quickstart MUST be
exercised by an automated CI job on every PR.

**Rationale**: This tool succeeds or fails on adoption velocity. If a
teammate cannot use it within minutes of hearing about it, it will not be
used. CI-validated quickstart prevents documentation rot.

### V. Operational Excellence (Observability, Security, Simplicity)

Three sub-disciplines, all non-negotiable:

- **Observability**: All server-side logging MUST go through `pino` with
  structured JSON output. Every inbound HTTP request MUST carry a
  generated trace ID propagated to outbound `@google-cloud/pubsub` calls
  and surfaced in error responses. The UI MUST expose a debug panel
  showing the raw request/response of the last operation. A `--verbose`
  CLI flag MUST raise log level to `debug`.

- **Security & Credential Hygiene**: No credentials MAY be persisted by
  the application beyond what ADC already manages. Message payloads MUST
  be redacted in logs unless `--verbose` is set. A strict
  Content-Security-Policy MUST be served. Outbound requests are limited
  to Google Cloud APIs. No analytics or telemetry of any kind.

- **Simplicity & YAGNI**: No database. No remote state. User preferences
  MUST be stored in a single JSON file under `~/.config/pubsub-dashboard/`.
  Adding a new runtime dependency requires a written justification in the
  PR description, including an evaluation of at least one alternative.

**Rationale**: A local dev tool earns trust by being boring, transparent,
and inspectable. Each sub-discipline guards a different failure mode:
observability for "what just happened?", security for "is it safe to
paste a production payload?", simplicity for "will this still work in a
year?".

## Technology Constraints

The following stack is part of the constitution and MAY only be changed via
a constitutional amendment (see Governance):

- **Runtime**: Node.js ≥ 20 LTS, single process.
- **Server**: Hono. Serves both the JSON API and the static client bundle.
- **Client**: React 18+, built with Vite, served as static assets by Hono.
- **UI primitives**: Tailwind CSS, shadcn/ui, Lucide icons.
- **JSON editor**: Monaco or CodeMirror 6 (one, not both).
- **Pub/Sub client**: `@google-cloud/pubsub` (the official Google SDK) is
  the ONLY supported Pub/Sub client.
- **Validation**: `zod` for all API and config schemas.
- **Logging**: `pino`.
- **Tests**: `vitest` for unit and integration; `@playwright/test` for E2E.
- **Distribution**: Published to npm with a `bin` entry that boots the
  Hono server, opens the browser via the `open` package, and exits cleanly
  on `SIGINT`.

Two-process architectures (separate frontend and backend dev servers) are
forbidden in production distribution. A two-process layout MAY exist in
local development (`vite dev` + `hono` watcher) provided the production
build remains a single process.

## Development Workflow & Quality Gates

- **Branching**: Trunk-based. Feature branches off `main`, merged via PR.
  Direct pushes to `main` are forbidden.
- **Commits**: Conventional Commits are mandatory. Co-authorship trailers
  for AI assistants are forbidden.
- **Reviews**: Every PR requires at least one human approval.
- **CI gates (all blocking)**:
  1. `eslint` — zero errors, zero warnings.
  2. `prettier --check` — clean.
  3. `tsc --noEmit` — clean (Principle III).
  4. `vitest run --coverage` — ≥90% line and branch (Principle II).
  5. `playwright test` — including the `npx` quickstart smoke test
     (Principle IV).
  6. Bundle size budget — server cold start < 3 s on a warm cache.
- **Releases**: Semantic Versioning. CHANGELOG generated from Conventional
  Commits. Each release MUST be reproducible from the tagged commit with
  `npm ci && npm run build`.
- **Dependency additions**: Each new runtime dependency MUST be justified
  in the PR description with an alternatives-considered section
  (Principle V).

## Governance

This constitution supersedes all other practices and informal conventions.
It is the source of truth for what "done" means in this project.

**Amendment procedure**:

1. Open a PR modifying `.specify/memory/constitution.md`.
2. Include a Sync Impact Report (HTML comment at the top of this file)
   describing the version bump, modified/added/removed principles, and
   any dependent template updates.
3. Update the version line at the bottom of this file according to the
   versioning policy below.
4. Propagate changes to `.specify/templates/plan-template.md`,
   `.specify/templates/spec-template.md`, and
   `.specify/templates/tasks-template.md` in the same PR.
5. Require at least one human review.

**Versioning policy**:

- **MAJOR**: A principle is removed, redefined in a backward-incompatible
  way, or governance rules change in a way that invalidates prior PRs.
- **MINOR**: A new principle or section is added, or an existing one is
  materially expanded.
- **PATCH**: Wording, typos, clarifications, or non-semantic refinements.

**Compliance review**:

- The Constitution Check gate in `.specify/templates/plan-template.md`
  MUST pass before any feature exits Phase 0.
- Any deviation MUST be documented under "Complexity Tracking" in the
  feature plan with a justification and the simpler alternative that was
  rejected.
- Reviewers MUST verify that PRs do not introduce constitution violations
  silently.

**Version**: 1.0.0 | **Ratified**: 2026-05-28 | **Last Amended**: 2026-05-28
