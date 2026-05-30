# Feature Specification: Project Bootstrap

**Feature Branch**: `001-project-bootstrap`

**Created**: 2026-05-29

**Status**: Clarified (ready for `/speckit.plan`)

**Input**: User description: "Bootstrap the Pub/Sub Dashboard project: a developer
can run `npx pubsub-dashboard` on a clean machine with gcloud ADC configured and
reach a working local dashboard in under 3 seconds, with the full Spec Kit
quality gates (90% coverage, lint, typecheck, E2E smoke) enforced in CI from
day one."

## Clarifications

### Session 2026-05-29

- Q: When ADC is missing or expired on first run, what should the tool do? → A: ADC-only — exit non-zero with a single, copy-pastable `gcloud auth application-default login` remediation message. No browser OAuth fallback in v1.
- Q: How is the active GCP project resolved on boot? → A: The tool MUST shell out to `gcloud config get-value project` as the *only* source of truth. The `GOOGLE_CLOUD_PROJECT` environment variable and the ADC quota project are NOT consulted in v1.
- Q: What is the default local port and the policy when it is busy? → A: Default port `4321`, overridable via `--port <n>`. If the chosen port is in use, boot MUST fail loudly with a clear error naming the port and the override flag (no auto-discovery of a free port).
- Q: What does the ≥90% line and branch coverage gate apply to? → A: All files under `src/**` (the application logic) MUST be covered ≥90% on both lines and branches. The following are explicitly excluded and listed in `vitest.config.ts`: `bin/**` (CLI wiring), `*.d.ts`, generated code, story files, and pure presentational React components without logic.
- Q: Which operating systems does CI exercise on every PR? → A: `ubuntu-latest` and `macos-latest`. Windows is **not supported** in v1; the README MUST state this explicitly.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - One-command first run (Priority: P1)

A new teammate hears about Pub/Sub Dashboard. They open a terminal on their
existing developer machine (which already has `gcloud` installed and Application
Default Credentials configured for the same Google Cloud project they normally
work with), type a single command, and within a few seconds a browser tab opens
showing the working dashboard, already authenticated against their default
Google Cloud project.

**Why this priority**: This is the entire point of the product. If the first
run is not effortless, no one on the team will adopt the tool. Every other
user story depends on the dashboard being reachable in one command.

**Independent Test**: On a freshly cloned machine that has only `node` and
`gcloud auth application-default login` already done, running the single
documented install/run command produces a browser window pointing at the
dashboard with the user's default GCP project visible in the UI. No other
configuration step is required.

**Acceptance Scenarios**:

1. **Given** a clean machine with Node.js installed and `gcloud auth application-default login` already run, **When** the developer runs the single documented command, **Then** a local dashboard opens automatically in their default browser within 3 seconds of cold start and within 1 second of warm start, and the dashboard shows the GCP project ID inferred from ADC.
2. **Given** the dashboard is running, **When** the developer presses Ctrl+C in the terminal, **Then** the local server stops cleanly within 1 second, releases its port, and leaves no orphan processes.
3. **Given** the developer has never configured `gcloud` ADC, **When** they run the single documented command, **Then** the terminal prints a single, copy-pastable `gcloud auth application-default login` remediation message and exits with a non-zero status without opening a half-broken UI. No browser-based OAuth flow is offered.

---

### User Story 2 - Reproducible quality from the first commit (Priority: P1)

A second developer joins the project, clones the repository, runs the
documented contributor command sequence, and finds that linting, type checking,
unit/integration tests with coverage reporting, and an end-to-end smoke test
all pass on their machine identically to how they pass in CI. When they open a
pull request, the same gates run automatically and block the merge if any of
them fails.

**Why this priority**: Principle II of the project constitution makes Test-First
non-negotiable. If the project lands without these gates working on day one, it
becomes prohibitively expensive to retrofit them later, and the constitution
becomes aspirational rather than enforced.

**Independent Test**: A reviewer can fork the repository, intentionally introduce
a type error, a lint violation, an untested code path that drops coverage below
the configured threshold, and a breaking change to the boot path. Each of those
mistakes, on its own, must cause the corresponding CI gate to fail and block
the PR.

**Acceptance Scenarios**:

1. **Given** a clean clone, **When** the contributor runs the documented "verify everything" command, **Then** lint, formatting check, type check, unit/integration tests with coverage, and an end-to-end smoke test of the one-command first run all execute and report pass/fail clearly.
2. **Given** a pull request that violates any single quality gate (lint, formatting, types, coverage threshold, smoke test), **When** CI runs on that pull request, **Then** the corresponding gate fails, the merge is blocked, and the failure message points to the offending file or test.
3. **Given** a pull request that passes every gate on the contributor's machine, **When** CI runs on the same commit, **Then** every gate also passes in CI without environment-specific tweaks.

---

### User Story 3 - Trustworthy local-only operation (Priority: P1)

A security-conscious developer inspects the running dashboard before pasting a
production payload into it. They can confirm by inspection that the server is
bound only to the loopback interface, that no outbound traffic leaves the
machine except to Google Cloud APIs, that no analytics or telemetry is sent
anywhere, and that no credentials or message payloads are written to log files
in plain text.

**Why this priority**: Pub/Sub messages routinely contain PII or production
data. If the developer cannot quickly verify the tool is safe to paste real
data into, they will not use it for the high-value use cases (debugging
production incidents), which is precisely what the tool exists for.

**Independent Test**: A reviewer can capture all outbound network traffic and
inspect log output while exercising the dashboard. The captured traffic shows
only requests to `*.googleapis.com`; the log output never contains the raw
contents of any published or received message and never contains an OAuth
token, refresh token, or service-account key.

**Acceptance Scenarios**:

1. **Given** the dashboard is running, **When** the developer attempts to reach it from another machine on the same network using the host's IP address, **Then** the connection is refused.
2. **Given** the dashboard is running in normal (non-verbose) mode and the developer publishes a message containing sensitive data, **When** they inspect the server's log output, **Then** the message body is redacted to a hash or a length indicator and the raw payload does not appear anywhere on disk.
3. **Given** the dashboard is running, **When** the developer monitors outbound network connections, **Then** every outbound connection terminates at a Google Cloud API endpoint.

---

### User Story 4 - One-page README that actually works (Priority: P2)

A developer who has never seen this project finds the repository on GitHub,
reads the README for under two minutes, follows the quickstart, and reaches a
working dashboard without consulting any other documentation, source file, or
human.

**Why this priority**: The constitution (Principle IV) requires a CI-validated
quickstart. Even a perfect technical bootstrap is worthless if the on-ramp
documentation is missing or wrong. This is P2 (not P1) only because Story 1
defines the runtime behaviour the README documents; the README itself can be
written last in the iteration but must ship in the same release.

**Independent Test**: A reviewer who has never read the rest of the code follows
only the README's quickstart section, on a clean machine, and reaches a
working dashboard. The same quickstart sequence is executed by CI on every
pull request and fails the build if any step diverges from the README.

**Acceptance Scenarios**:

1. **Given** a developer reading the README for the first time, **When** they reach the end of the "Quickstart" section, **Then** they have a working dashboard open in their browser.
2. **Given** a pull request that modifies the boot command, the install instructions, or the auth requirements, **When** CI runs, **Then** the README quickstart sequence is executed end-to-end against the changed code and the build fails if any step in the README is now incorrect.

---

### Edge Cases

- **Port already in use**: The default local port (`4321`) is occupied by another process. The tool MUST detect this before claiming success and exit non-zero with a clear error naming the conflicting port and pointing at the `--port <n>` override flag. The tool MUST NOT silently auto-pick a different port (deterministic URLs are required by the CI smoke test and the README quickstart).
- **No default browser**: The host has no default browser registered. The tool MUST print the local URL prominently in the terminal and exit successfully so the developer can open it manually; it MUST NOT fail because of this.
- **Stale or expired ADC credentials**: ADC exists but the access token is expired or revoked. The tool MUST log the GCP-returned error verbatim at `error` level via the structured logger (so the developer can inspect it with the rest of the JSON log stream) AND print a single canonical remediation line on stderr — `[pubsub-dashboard] ADC not configured. Run: gcloud auth application-default login` — before exiting with the exit-code-12 contract from `contracts/cli.md`. The canonical line keeps the remediation predictable; the verbatim GCP error is preserved in logs for diagnosis.
- **No active gcloud project**: `gcloud config get-value project` returns empty (no active project set). The tool MUST refuse to start with a remediation message pointing at `gcloud config set project <PROJECT_ID>`.
- **`gcloud` not on PATH**: The tool depends on `gcloud` to resolve the active project. If `gcloud` cannot be invoked, the tool MUST exit non-zero with a remediation message pointing at the Google Cloud SDK installation page.
- **Node version below the supported minimum** (Node < 20 LTS): The bin entrypoint MUST detect this on the first line of execution and refuse to start with a clear "requires Node ≥ 20 LTS" message instead of crashing with an obscure syntax error.
- **Slow network on first `npx` run**: First-time `npx` invocation may take longer than 3 seconds because npm is downloading the package. The 3-second budget applies to **warm cache** runs; the cold-cache case MUST still show progress so the developer knows the tool is alive.
- **CI runner without a browser**: The end-to-end smoke test running in CI MUST exercise the server boot path and HTTP responses without actually launching a browser window, using a headless-capable test runner.

## Requirements *(mandatory)*

### Functional Requirements

**Installation and boot**

- **FR-001**: The tool MUST be installable and runnable via a single `npx` command without a separate "install" step.
- **FR-002**: Running the tool MUST start a local HTTP server bound exclusively to the loopback interface (`127.0.0.1`) on default port `4321` (overridable via `--port <n>`) and MUST NOT bind to `0.0.0.0` or any external interface. If the chosen port is in use, the tool MUST exit non-zero with an error message naming the port and the `--port` override flag, and MUST NOT silently fall back to another port.
- **FR-003**: On successful boot, the tool MUST automatically open the dashboard in the user's default browser; if no default browser is available, the tool MUST print the URL and continue.
- **FR-004**: The tool MUST stop cleanly on `SIGINT` (Ctrl+C) and `SIGTERM`, releasing its port within 1 second.

**Authentication**

- **FR-005**: The tool MUST authenticate against Google Cloud using Application Default Credentials produced by `gcloud auth application-default login`. No other credential mechanism (browser OAuth, service-account key file, env-var token) is supported in v1.
- **FR-006**: The tool MUST resolve the active GCP project on startup by invoking `gcloud config get-value project` and using its trimmed output as the single source of truth for the active project. The `GOOGLE_CLOUD_PROJECT` environment variable and the ADC quota project MUST NOT be consulted. The resolved project ID MUST be displayed prominently in the UI.
- **FR-007**: When ADC is missing or expired, when `gcloud` is not on `PATH`, or when `gcloud config get-value project` returns empty, the tool MUST exit with a non-zero status and print a single, copy-pastable remediation command tailored to the specific failure (`gcloud auth application-default login`, install Google Cloud SDK, or `gcloud config set project <PROJECT_ID>` respectively).

**Dashboard surface (minimal viable for bootstrap)**

- **FR-008**: The dashboard MUST display the currently authenticated GCP project ID and the user (or service account) identity associated with the active credentials.
- **FR-009**: The dashboard MUST expose a visible "diagnostics" affordance that lets the developer see the raw request and response of the most recent backend operation, satisfying the in-UI debug panel required by the constitution.

> The full publish, subscribe, and JSON-compose user journeys are explicitly out
> of scope for this bootstrap feature and will land in subsequent features. The
> bootstrap MUST leave clean extension points for them (see FR-018).

**Security and privacy**

- **FR-010**: The tool MUST NOT send any outbound network traffic to any host other than Google Cloud API endpoints; no analytics, telemetry, error reporting, or update check is permitted.
- **FR-011**: In normal (non-verbose) logging, the tool MUST NOT log raw message payloads or credential material. A verbose mode MAY log additional detail but MUST still redact credentials.
- **FR-012**: The tool MUST serve a strict Content-Security-Policy on every HTML response and MUST NOT include any third-party script, font, or stylesheet from a public CDN; all UI assets MUST be served from the local process.

**Quality gates (constitution Principle II)**

- **FR-013**: The project MUST ship with a single "verify" command that runs, in order: linter, formatter check, type checker, unit and integration tests with coverage reporting, and an end-to-end smoke test of the boot path.
- **FR-014**: Continuous integration MUST run the same "verify" command on every pull request and on every push to the default branch, on a matrix of `ubuntu-latest` and `macos-latest` runners, and MUST block merges when any gate fails on any runner. Windows is explicitly not supported in v1 and is not part of the CI matrix.
- **FR-015**: The test suite MUST measure and enforce a minimum coverage threshold of 90% on both lines and branches across all files under `src/**`. The following paths MUST be the *only* exclusions, declared explicitly in `vitest.config.ts`: `bin/**` (CLI wiring), `*.d.ts`, generated code, story files, and pure presentational React components without logic. CI MUST fail below the 90% threshold on either lines or branches.
- **FR-016**: The end-to-end smoke test MUST exercise the cold-boot path of the documented one-command first run and verify that the dashboard responds successfully, without launching a real browser window in CI.

**Documentation**

- **FR-017**: The repository MUST contain a top-level README whose "Quickstart" section, executed verbatim on a clean machine with `gcloud` ADC configured, is sufficient to reach a working dashboard.
- **FR-018**: The README MUST document the supported Node.js version, the supported operating systems (macOS and Linux only; Windows explicitly not supported in v1), the required `gcloud` setup including `gcloud auth application-default login` and `gcloud config set project <PROJECT_ID>`, the one-command first run, the default port `4321` and the `--port` override, the contributor "verify" command, the project license, and a brief "what is in scope and what is not" statement.
- **FR-019**: The CI pipeline MUST execute the README's Quickstart sequence end-to-end against the current commit and MUST fail the build if any step in the README is no longer accurate.

**Project layout (extension points)**

- **FR-020**: The codebase MUST be organised so that future features (publish flow, subscribe flow, JSON compose/inspect) can be added without modifying the boot path or the auth resolution path; the bootstrap MUST leave a single, documented extension surface for adding new dashboard sections.

### Key Entities *(include if feature involves data)*

- **Active Session**: Represents the developer's current run of the tool. Attributes: resolved GCP project ID, identity (user email or service-account email) reported by ADC, server bind address and port, start timestamp, and the trace ID of the most recent backend operation. Lives only in memory; never persisted.
- **User Preferences**: Persistent, optional, single-developer settings (for example: preferred port, verbose mode, last-used project shortcuts). Stored as a single JSON file under the user's home configuration directory. Never contains credentials. Out of scope for this feature beyond reserving the file path and ensuring nothing else is persisted.
- **Diagnostics Record**: An in-memory record of the most recent backend operation (request, response, timing, trace ID) made available to the in-UI debug panel. Bounded size; never written to disk.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: On a developer machine with a warm npm cache and `gcloud` ADC already configured, the time from pressing Enter on the documented one-command first run to the dashboard being interactive in the browser is under 3 seconds at the 95th percentile across a representative sample of runs.
- **SC-002**: On the same machine, the dashboard responds to its first authenticated API call within 1 second of being interactive.
- **SC-003**: A developer who has never seen the project can reach a working dashboard, following only the README, in under 5 minutes from the moment they open the repository, assuming `gcloud` ADC is already configured.
- **SC-004**: 100% of pull requests that violate any quality gate (lint, formatting, types, coverage threshold, smoke test, README quickstart) are blocked from merging by CI, with no manual override path documented.
- **SC-005**: Line coverage and branch coverage are both at or above 90% across `src/**` (with the exclusions listed in FR-015) on the default branch at all times; any drop below that threshold on either metric breaks the build.
- **SC-006**: Network capture of a one-hour interactive session reveals zero outbound connections to any host outside Google Cloud API endpoints.
- **SC-007**: Inspection of all log output produced during a one-hour interactive session reveals zero occurrences of raw message payloads or credential material in non-verbose mode.
- **SC-008**: The "verify" command runs to completion on the project maintainer's machine in under 60 seconds for the unit and integration portion and under 30 additional seconds for the end-to-end smoke test, so contributors actually run it locally before pushing.

## Assumptions

- Target users are professional developers on **macOS or Linux** who already have Node.js (≥ 20 LTS) installed, who have run `gcloud auth application-default login` against the Google Cloud project they want to inspect, and who have set an active project via `gcloud config set project <PROJECT_ID>`. **Windows is explicitly not supported in v1**; it is out of the CI matrix and out of scope of the README quickstart. Windows support may be revisited in a later feature.
- The constitution's locked technology stack (single Node process, Hono server, React+Vite client, `@google-cloud/pubsub`, `zod`, `pino`, `vitest`, Playwright) is the implementation substrate for this feature; the spec does not re-derive that choice but assumes it.
- A single default local port is sufficient for v1; explicit multi-instance support (running two dashboards side by side against two projects) is out of scope and will be revisited only if real demand appears.
- The first publish/subscribe/inspect features will be specified in separate `/speckit.specify` cycles immediately after this bootstrap ships, so the bootstrap deliberately leaves a clean extension point rather than pre-building those flows.
- The project will be released under the Apache-2.0 license already committed in the repository.
