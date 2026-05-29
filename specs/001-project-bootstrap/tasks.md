---
description: "Task list for feature 001-project-bootstrap"
---

# Tasks: Project Bootstrap

**Input**: Design documents from `specs/001-project-bootstrap/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: MANDATORY per Constitution Principle II (Test-First, NON-NEGOTIABLE).
Every implementation task is preceded by its failing test(s). Vitest line and
branch coverage MUST be ≥90% on `src/**` (excludes per FR-015). Playwright E2E
smoke covers the cold-boot path. README-quickstart job exercises the published
quickstart on every PR.

**Organization**: Tasks are grouped by user story. P1 stories (US1, US2, US3) are
each independently testable; US4 depends on US1 boot existing for its quickstart
to be meaningful.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3, US4)
- File paths are absolute-from-repo-root

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project skeleton, tooling configs (rules not yet enforced — those land in US2). No story label.

- [ ] T001 Create directory structure: `bin/`, `src/server/{auth,routes,middleware,schemas}`, `src/client/{components/ui,lib}`, `src/shared/`, `src/cli/`, `tests/{unit,integration,e2e}/`, `scripts/`, `.github/workflows/`.
- [ ] T002 [P] Create `package.json` with: `"type":"module"`, `"engines":{"node":">=20.0.0"}`, `"bin":{"pubsub-dashboard":"bin/pubsub-dashboard.mjs"}`, dependency list from `plan.md` (hono, google-auth-library, pino, zod, open, react, react-dom), devDependencies (vite, @vitejs/plugin-react, vitest, @vitest/coverage-v8, @playwright/test, typescript, eslint, @typescript-eslint/*, prettier, tsx, tailwindcss, @radix-ui/* via shadcn primitives, lucide-react), scripts placeholders (`dev`, `build`, `verify`).
- [ ] T003 [P] Create `tsconfig.json` (base: `strict:true`, `noImplicitAny:true`, `strictNullChecks:true`, `noUncheckedIndexedAccess:true`, `target:ES2022`, `module:NodeNext`, `moduleResolution:NodeNext`, `paths:{"@server/*":["src/server/*"], "@shared/*":["src/shared/*"]}`).
- [ ] T004 [P] Create `tsconfig.server.json` (extends base, `lib:["ES2022"]`, `types:["node","vitest/globals"]`).
- [ ] T005 [P] Create `tsconfig.client.json` (extends base, `lib:["ES2022","DOM","DOM.Iterable"]`, `jsx:"react-jsx"`).
- [ ] T006 [P] Create `vite.config.ts` with `@vitejs/plugin-react` and `build.outDir = 'dist/client'`.
- [ ] T007 [P] Create `vitest.config.ts` (initial — coverage thresholds set to 0; final thresholds wired in T064 under US2 to keep gates pre-implementation green).
- [ ] T008 [P] Create `playwright.config.ts` configured for `APIRequestContext`-only tests (no browser launch).
- [ ] T009 [P] Create `eslint.config.js` (flat config) scaffolded but with no rules yet (final ruleset lands in T065 under US2).
- [ ] T010 [P] Create `.prettierrc` with project formatting choices.
- [ ] T011 [P] Create `tailwind.config.ts`, `postcss.config.cjs`, and `src/client/styles.css` (Tailwind directives only).
- [ ] T012 Run `npm install` to materialize the lockfile and `node_modules`.

**Checkpoint**: `tsc --noEmit` runs (on an empty src tree) without errors; `npm run build` is wired but not yet meaningful.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared schemas, constants, app factory, CLI parsing — everything every user story imports. No story label.

**⚠️ CRITICAL**: No US-phase task may start until Phase 2 is complete.

### Shared constants & guards

- [ ] T013 [P] Unit test in `tests/unit/shared.env.test.ts`: `assertSupportedNode(version)` returns ok for `v20.0.0`/`v22.x`, throws with exit-code-10 message for `v18.x`.
- [ ] T014 [P] Implement `src/shared/env.ts` exporting `MIN_NODE_MAJOR = 20` and `assertSupportedNode(version: string): void`.
- [ ] T015 [P] Unit test in `tests/unit/shared.port.test.ts`: `DEFAULT_PORT === 4321`, `BIND_ADDRESS === '127.0.0.1'`.
- [ ] T016 [P] Implement `src/shared/port.ts` exporting `DEFAULT_PORT`, `BIND_ADDRESS`.

### Zod schemas (single source of truth — contracts/schemas.md)

- [ ] T017 [P] Test `tests/unit/schemas.session.test.ts` covering T-SCHEMA-010..013.
- [ ] T018 [P] Implement `src/server/schemas/session.ts` (`SessionSchema`, `Session` type).
- [ ] T019 [P] Test `tests/unit/schemas.health.test.ts` covering T-SCHEMA-020..021.
- [ ] T020 [P] Implement `src/server/schemas/health.ts` (`HealthResponseSchema`).
- [ ] T021 [P] Test `tests/unit/schemas.diagnostics.test.ts` covering T-SCHEMA-030..033.
- [ ] T022 [P] Implement `src/server/schemas/diagnostics.ts` (`DiagnosticsRecordSchema`, `DiagnosticsListSchema`).
- [ ] T023 [P] Test `tests/unit/schemas.errors.test.ts` covering T-SCHEMA-040..042.
- [ ] T024 [P] Implement `src/server/schemas/errors.ts` (`ErrorCode`, `ErrorResponseSchema`).
- [ ] T025 [P] Test `tests/unit/schemas.preferences.test.ts` covering T-SCHEMA-060..061.
- [ ] T026 [P] Implement `src/server/schemas/preferences.ts` (`PreferencesSchema`).

### CLI argument parsing

- [ ] T027 [P] Test `tests/unit/cli.args.test.ts` covering T-SCHEMA-050..053 plus unknown-flag rejection.
- [ ] T028 [P] Implement `src/cli/args.ts` using `node:util.parseArgs` + `CliArgsSchema`.

### Logging + trace middleware

- [ ] T029 [P] Test `tests/unit/middleware.trace.test.ts`: middleware mints UUIDv4 `traceId`, attaches it via `pino.child`, sets `x-trace-id` response header.
- [ ] T030 Implement `src/server/middleware/trace.ts` (pino factory + per-request middleware). *Dependency: T029 must fail first.*

### Hono app factory

- [ ] T031 [P] Test `tests/unit/server.app.test.ts`: `createApp()` returns a Hono instance, attaches trace middleware, exposes no routes yet (404 on `/api/health`).
- [ ] T032 Implement `src/server/app.ts` exporting `createApp(deps): Hono`. *Dependency: T031.*

**Checkpoint**: All schemas parsed/validated; CLI parses argv; app factory builds an empty Hono app with trace middleware; full test suite green; coverage on `src/**` ≥ what's present.

---

## Phase 3: User Story 1 — One-command first run (Priority: P1) 🎯 MVP

**Goal**: `npx pubsub-dashboard` boots, opens browser, shows project + identity. Independent test: clean machine with ADC + active project → working dashboard in <3 s warm cache.

### Auth + project resolution

- [ ] T033 [P] [US1] Test `tests/unit/auth.adc.test.ts`: success path returns an authenticated client + identity; missing/expired ADC throws `ADCMissingError` mapped to exit code 12 with remediation `gcloud auth application-default login`.
- [ ] T034 [US1] Implement `src/server/auth/adc.ts` using `google-auth-library`. *Dependency: T033.*
- [ ] T035 [P] [US1] Test `tests/unit/auth.project.test.ts`: `getActiveProject()` shells out to `gcloud config get-value project` (mocked `execFile`), trims output, validates regex; empty result throws `NoActiveProjectError` (exit 13); `ENOENT` for gcloud → `GcloudMissingError` (exit 11). MUST NOT consult `GOOGLE_CLOUD_PROJECT` env var (test asserts env access via spy).
- [ ] T036 [US1] Implement `src/server/auth/project.ts`. *Dependency: T035.*
- [ ] T037 [P] [US1] Test `tests/unit/auth.remediation.test.ts`: each error class maps to its documented stderr line (verbatim strings from `contracts/cli.md`).
- [ ] T038 [US1] Implement `src/server/auth/remediation.ts`. *Dependency: T037.*

### Health + session endpoints

- [ ] T039 [P] [US1] Contract test `tests/integration/http.health.test.ts` covering T-HTTP-001..003 (status, schema, x-trace-id, Host header guard).
- [ ] T040 [US1] Implement `src/server/routes/health.ts` (`GET /api/health`) and register in `createApp`. *Dependency: T039.*
- [ ] T041 [P] [US1] Contract test `tests/integration/http.session.test.ts` covering T-HTTP-010..013 and the 503 `ADC_MISSING` defensive path.
- [ ] T042 [US1] Implement `src/server/routes/session.ts` (`GET /api/session`), wire `ActiveSession` construction at boot from `getActiveProject()` + ADC identity + `BIND_ADDRESS` + port. *Dependency: T041.*

### Static asset serving

- [ ] T043 [P] [US1] Test `tests/integration/http.static.test.ts`: `GET /` returns 200 `text/html`; `GET /assets/<fingerprinted>` returns 200 with `Cache-Control: immutable`; `GET /api/does-not-exist` returns 404 (T-HTTP-031); `GET /assets/<bogus>` returns 404 (T-HTTP-032).
- [ ] T044 [US1] Implement `src/server/static.ts` serving `dist/client/` with SPA fallback for non-`/api/` non-`/assets/` paths. *Dependency: T043.*

### Boot lifecycle + bin entrypoint

- [ ] T045 [P] [US1] Integration test `tests/integration/boot.lifecycle.test.ts`: `start()` listens on `127.0.0.1:<dynamic-port>`, `GET /api/health` returns 200, `SIGINT` triggers clean shutdown in <1 s, port is released (verified by re-binding).
- [ ] T046 [US1] Implement `src/server/boot.ts` exporting `start({ port, verbose })` and `stop()`. Wires `createApp` + auth + session + static + signal handlers (SIGINT/SIGTERM → graceful, second SIGINT → immediate exit). *Dependency: T045.*
- [ ] T047 [P] [US1] Integration test `tests/integration/boot.port-conflict.test.ts`: pre-bind a socket on `4321`, run `start({port:4321})`, assert exit code 14 with documented stderr line (T-CLI-009).
- [ ] T048 [US1] Implement port-conflict detection in `boot.ts` (catch `EADDRINUSE`, exit 14 with remediation). *Dependency: T047.*
- [ ] T049 [P] [US1] Integration test `tests/integration/boot.node-guard.test.ts`: spawn `bin/pubsub-dashboard.mjs` with a fake `process.version` shim, assert exit code 10 + stderr line (T-CLI-005).
- [ ] T050 [P] [US1] Integration test `tests/integration/boot.browser-open.test.ts`: mock `open` package; on successful boot, `open` is called with `http://127.0.0.1:<port>`; if `open` rejects, exit code remains 0 and the URL is printed to stdout (T-CLI-010, FR-003 edge case).
- [ ] T051 [US1] Implement `bin/pubsub-dashboard.mjs`: Node-version guard (exit 10), parse args via `src/cli/args.ts` (exit 2 on invalid), call `start(args)`, call `open(url)` after `listen` resolves; mapped exit codes 11/12/13/14 surface from `boot.ts`. *Dependency: T049, T050.*

### Minimal client UI

- [ ] T052 [P] [US1] Test `src/client/lib/api.ts` via `tests/unit/client.api.test.ts`: typed `fetch<T>(path, schema)` parses the response with the provided zod schema and surfaces `x-trace-id` header.
- [ ] T053 [US1] Implement `src/client/lib/api.ts`. *Dependency: T052.*
- [ ] T054 [P] [US1] Component test `tests/unit/client.SessionBadge.test.tsx` (React Testing Library + Vitest jsdom env): renders `projectId` and `identity` from `/api/session` (mocked), shows skeleton when loading, shows error toast on 503 with the remediation message.
- [ ] T055 [US1] Implement `src/client/components/SessionBadge.tsx`. *Dependency: T054.*
- [ ] T056 [US1] Implement `src/client/App.tsx` rendering `<SessionBadge />` + header; bootstraps via `main.tsx` + `index.html` Vite template. Tailwind classes only; no third-party CSS imports.

### End-to-end story acceptance

- [ ] T057 [US1] E2E test `tests/e2e/us1-first-run.spec.ts` (Playwright `APIRequestContext`): builds client, starts server via `start()`, hits `/api/health` and `/api/session`, asserts `bindAddress === '127.0.0.1'`, `port === DEFAULT_PORT`, response schemas valid, `x-trace-id` present on both responses.

**Checkpoint**: User Story 1 done. A developer with ADC + active project can run a locally-built bin and reach a working dashboard. *MVP can ship here.*

---

## Phase 4: User Story 3 — Trustworthy local-only operation (Priority: P1)

**Goal**: Loopback-only bind, no non-Google outbound, CSP strict, payloads + credentials redacted in normal mode, diagnostics panel exposes raw last op. Independent test: network capture + log inspection of a one-hour session reveals nothing outside spec.

### CSP middleware

- [ ] T058 [P] [US3] Test `tests/unit/middleware.csp.test.ts` (T-HTTP-030): HTML responses carry the exact CSP string from R9; JSON responses do not.
- [ ] T059 [US3] Implement `src/server/middleware/csp.ts` and wire into `createApp`. *Dependency: T058.*

### Logging redaction

- [ ] T060 [P] [US3] Test `tests/unit/middleware.redact.test.ts`: pino instance configured with the redact paths from R8; normal mode → `message.data`, `authorization`, `credentials` all `[REDACTED]`; verbose mode → `message.data` revealed, credentials still `[REDACTED]`.
- [ ] T061 [US3] Update `src/server/middleware/trace.ts` (or extract `src/server/middleware/redact.ts`) to apply the redact config from R8. *Dependency: T060.*

### Diagnostics capture + endpoint + UI

- [ ] T062 [P] [US3] Test `tests/unit/middleware.capture.test.ts`: ring buffer FIFO at `DIAGNOSTICS_CAPACITY = 50`; redaction applied **at capture time**, not read time; trace id matches request.
- [ ] T063 [US3] Implement `src/server/middleware/capture.ts` (exports `getRecentDiagnostics(limit)` + middleware). *Dependency: T062.*
- [ ] T064 [P] [US3] Contract test `tests/integration/http.diagnostics.test.ts` covering T-HTTP-020..024 plus `limit` query param validation (400 on invalid).
- [ ] T065 [US3] Implement `src/server/routes/diagnostics.ts` (`GET /api/diagnostics`) and register. *Dependency: T064.*
- [ ] T066 [P] [US3] Component test `tests/unit/client.DiagnosticsPanel.test.tsx`: renders most-recent 20 records newest-first, shows trace id, expands to show request/response JSON in a `<pre>` block.
- [ ] T067 [US3] Implement `src/client/components/DiagnosticsPanel.tsx` and render it in `App.tsx`. *Dependency: T066.*

### Network-surface guarantees

- [ ] T068 [P] [US3] Integration test `tests/integration/net.loopback.test.ts` (T-NET-001): start server on `127.0.0.1:<port>`; assert that `connect()` to the host's external IP on the same port is refused.
- [ ] T069 [P] [US3] Integration test `tests/integration/net.outbound.test.ts` (T-NET-002): instrument `dns.lookup` and `net.connect`; exercise the dashboard for ~10 s of fake interactive traffic; assert every recorded outbound connection terminates at a host matching `/\.googleapis\.com$/`.
- [ ] T070 [US3] If T068/T069 reveal a leak, fix in `src/server/boot.ts` (loopback enforcement) and/or `src/client/lib/api.ts` (no third-party fetch).

### Preferences invariant (v1 must-not-write)

- [ ] T071 [P] [US3] Integration test `tests/integration/preferences.untouched.test.ts` (T-SCHEMA-062): boot → hit `/api/health` and `/api/session` → SIGINT; assert that `~/.config/pubsub-dashboard/preferences.json` does not exist OR was not modified.

**Checkpoint**: User Story 3 done. A security review can verify by inspection that the tool is safe to paste production payloads into.

---

## Phase 5: User Story 2 — Reproducible quality from commit 1 (Priority: P1)

**Goal**: `npm run verify` runs all gates locally and in CI on `ubuntu-latest` + `macos-latest`. Any single gate violation blocks PR. Independent test: introduce one violation per gate → CI fails on exactly that gate.

### Final gate configurations

- [ ] T072 [US2] Finalize `vitest.config.ts`: `coverage.provider = 'v8'`, `coverage.thresholds = { lines: 90, branches: 90, functions: 90, statements: 90 }`, `coverage.include = ['src/**/*.{ts,tsx}']`, `coverage.exclude = ['src/**/*.d.ts', 'src/client/components/ui/**', 'src/**/*.stories.*', 'bin/**', 'dist/**']` (matches FR-015 verbatim).
- [ ] T073 [US2] Finalize `eslint.config.js`: enable `typescript-eslint` strict + stylistic, `eslint-plugin-import` order, `no-restricted-imports` to forbid any direct read of `process.env.GOOGLE_CLOUD_PROJECT` (enforces the clarification: only `gcloud config get-value project`).
- [ ] T074 [US2] Finalize `.prettierrc` and add `prettier --check .` to verify pipeline.
- [ ] T075 [US2] Wire `package.json` scripts:
  ```
  "lint": "eslint .",
  "format:check": "prettier --check .",
  "typecheck": "tsc --noEmit -p tsconfig.server.json && tsc --noEmit -p tsconfig.client.json",
  "test": "vitest run --coverage",
  "e2e": "playwright test",
  "verify": "npm run lint && npm run format:check && npm run typecheck && npm run test && npm run e2e"
  ```

### CI workflow

- [ ] T076 [US2] Create `.github/workflows/ci.yml`:
  - Triggers: `pull_request`, `push` to `main`.
  - `jobs.verify.strategy.matrix.os: [ubuntu-latest, macos-latest]`, `node-version: [20.x]`.
  - Steps: `actions/checkout@v4`, `actions/setup-node@v4` with `cache: 'npm'`, `npm ci`, `npx playwright install --with-deps chromium` (no-op for `APIRequestContext` but required by some Playwright internals), `npm run verify`.
  - Required for merge to `main` via repo branch-protection (manual GitHub setup; documented in T080).

### Gate-self-tests (meta)

- [ ] T077 [P] [US2] Test `tests/integration/verify.gate-lint.test.ts`: spawn `npm run lint` against a tempdir containing a fixture with a deliberate ESLint violation; assert non-zero exit.
- [ ] T078 [P] [US2] Test `tests/integration/verify.gate-typecheck.test.ts`: similar, with a TS error fixture.
- [ ] T079 [P] [US2] Test `tests/integration/verify.gate-coverage.test.ts`: similar, with a source file that drops coverage below 90%.
- [ ] T080 [US2] Document branch-protection setup in `docs/contributing.md` (or a new section of `README.md`): required status checks = `verify (ubuntu-latest)`, `verify (macos-latest)`, `readme-quickstart`.

**Checkpoint**: User Story 2 done. CI blocks PRs on any gate violation.

---

## Phase 6: User Story 4 — CI-validated README quickstart (Priority: P2)

**Goal**: README's Quickstart section is verbatim what CI executes; modifying the boot path or auth requirements without updating the README breaks CI.

- [ ] T081 [P] [US4] Test `tests/unit/scripts.extract-readme-quickstart.test.ts`: extract function returns the `bash quickstart` fence body; throws if the fence is missing; throws if multiple fences.
- [ ] T082 [US4] Implement `scripts/extract-readme-quickstart.mjs`: parses `README.md`, writes the fence body to a temp file, returns the path; CLI flag `--print` to stdout-dump for CI use. *Dependency: T081.*
- [ ] T083 [US4] Write `README.md` derived from `specs/001-project-bootstrap/quickstart.md`:
  - Title + tagline.
  - "Prerequisites" (Node ≥20, gcloud installed, ADC + active project).
  - Fenced ```bash quickstart``` block matching `quickstart.md` exactly.
  - Flags table (--port, --verbose, --help, --version).
  - Troubleshooting table.
  - "Supported OS: macOS and Linux only. Windows not supported in v1." statement (FR-018).
  - License + link to LICENSE.
- [ ] T084 [P] [US4] Test `tests/integration/readme-quickstart.smoke.test.ts`: invoke `scripts/extract-readme-quickstart.mjs --print`, pipe to `bash -e`, then `curl -fsS http://127.0.0.1:4321/api/health`; assert HTTP 200. Tears down the spawned server cleanly.
- [ ] T085 [US4] Add a CI job `readme-quickstart` to `.github/workflows/ci.yml` (ubuntu-latest only) that runs T084's flow against the freshly built bin. Required for merge.
- [ ] T086 [P] [US4] Test `tests/integration/readme-quickstart.mutation.test.ts`: temporarily mutate `bin/pubsub-dashboard.mjs` (e.g., add `process.exit(7)` before listen), run the README-quickstart flow, assert it fails. Validates that the gate has real teeth.

**Checkpoint**: User Story 4 done. README is the contract; CI enforces it.

---

## Phase 7: Polish & Cross-cutting Validation

**Purpose**: Verify spec-level success criteria, finalize package, prep for release. No story label.

- [ ] T087 [P] Benchmark `tests/perf/cold-boot.bench.ts`: 20 cold-boot runs from a warm npm cache, assert p95 < 3 s on Apple Silicon and on a Linux runner (manual + nightly job, not blocking the PR matrix). Validates SC-001.
- [ ] T088 [P] Benchmark first-API-call latency on the same harness, p95 < 1 s. Validates SC-002.
- [ ] T089 [P] Measure `npm run verify` total time on a clean clone, assert < 90 s total (unit+integration <60 s, e2e <30 s). Validates SC-008.
- [ ] T090 [P] Run `npm publish --dry-run` and inspect the tarball contents: `bin/`, `dist/server/`, `dist/client/`, `LICENSE`, `README.md` included; `tests/`, `specs/`, `.specify/`, `.windsurf/`, source `.ts` files excluded via `package.json#files`.
- [ ] T091 Set `package.json#version` to `0.1.0`.
- [ ] T092 Create `CHANGELOG.md` with the v0.1.0 entry referencing the four user stories.
- [ ] T093 Update `README.md` "Supported OS" note (FR-018) and "What's in scope and what's not" section (publish/subscribe/JSON compose explicitly out of v1 scope per spec, planned in feature 002+).
- [ ] T094 Final dependency audit: `npm audit --omit=dev` returns zero high/critical; every runtime dep present in the published tarball is justified in `research.md` R13.
- [ ] T095 Tag `v0.1.0`, open PR `001-project-bootstrap → main`; merge gated by `verify (ubuntu-latest)`, `verify (macos-latest)`, `readme-quickstart`.

---

## Dependencies

```text
Phase 1 (Setup)
  └─ Phase 2 (Foundational)
       ├─ Phase 3 (US1) ──────────┐
       ├─ Phase 4 (US3) ──────────┤   (US1, US2, US3 can ship in any order
       └─ Phase 5 (US2) ──────────┤    after Phase 2; each is independently
                                  │    testable per spec.)
       └─ Phase 6 (US4)  ── depends on Phase 3 (needs a working boot to validate the README against)
              └─ Phase 7 (Polish)
```

**Key cross-story dependencies**:

- US1 → US3: not a hard dep, but US3's diagnostics panel is most useful with US1's real session data. US3 *can* be developed against a stub `createApp` if you want strict parallelism.
- US2 ↔ US1/US3: US2's gate-self-tests (T077–T079) need *something* to lint/typecheck/cover; in practice US2 lands once US1 is in flight.
- US4 → US1: the README quickstart references `npx pubsub-dashboard`; cannot be validated without US1's bin existing.

## Parallel Execution Examples

**Within Phase 1 (Setup)** — every config file is independent: T002–T011 run in parallel after T001.

**Within Phase 2 (Foundational)** — every zod schema is in its own file; every test/impl pair runs in parallel:

- Parallel batch: T013/T014, T015/T016, T017/T018, T019/T020, T021/T022, T023/T024, T025/T026, T027/T028 (each batch within itself sequential test→impl; batches mutually parallel).
- Then sequentially: T029 → T030 → T031 → T032.

**Within US1 (Phase 3)**:

- Parallel batch A (auth): T033/T034, T035/T036, T037/T038.
- Parallel batch B (routes): T039/T040, T041/T042, T043/T044 — depend on app factory + schemas (Phase 2 done).
- Then: T045→T046→T047→T048→T049→T050→T051 (boot path is mostly sequential).
- Parallel batch C (client): T052/T053, T054/T055, T056 — independent of boot path.
- T057 last (E2E acceptance).

**Within US3 (Phase 4)**: T058/T059, T060/T061, T062/T063, T064/T065, T066/T067 all run in parallel; T068/T069/T070 sequential after middleware lands; T071 independent.

## Implementation Strategy

**MVP (ship this first if pressed)**: Phase 1 + Phase 2 + **Phase 3 (US1)** only. Skip CI matrix, skip diagnostics panel polish, skip README CI gate. Result: working `npx pubsub-dashboard` for the maintainer, no team-distribution story yet.

**v0.1.0 release scope**: Phases 1–7 inclusive. All four user stories satisfied; CI green on both OSes; README quickstart CI-validated.

**Recommended PR cadence**:

1. PR #1: Phases 1 + 2 (`chore: scaffolding and shared foundations`).
2. PR #2: Phase 3 / US1 (`feat(boot): one-command first run with ADC + project resolution`).
3. PR #3: Phase 4 / US3 (`feat(security): CSP, redaction, diagnostics, loopback enforcement`).
4. PR #4: Phase 5 / US2 (`ci: full quality gate matrix on ubuntu+macos`).
5. PR #5: Phase 6 / US4 (`docs(readme): CI-validated quickstart`).
6. PR #6: Phase 7 (`chore: release prep v0.1.0`).

Each PR is itself gated by the gates landed in earlier PRs; for PRs #1–#2, the gates run but with looser thresholds, ratcheted to 90% in PR #4.

## Task Count Summary

- **Setup (Phase 1)**: 12 tasks
- **Foundational (Phase 2)**: 20 tasks
- **US1 (Phase 3)**: 25 tasks
- **US3 (Phase 4)**: 14 tasks
- **US2 (Phase 5)**: 9 tasks
- **US4 (Phase 6)**: 6 tasks
- **Polish (Phase 7)**: 9 tasks
- **Total**: **95 tasks**

**Independent test criteria per story**:

- **US1**: A clean machine with ADC + active project runs the locally-built bin and reaches an interactive dashboard showing the correct project ID and identity in <3 s warm cache.
- **US2**: A fork that violates exactly one gate (lint, format, types, coverage <90%, e2e, README) fails CI on exactly that gate, with the failure pointing at the offending file or test.
- **US3**: A one-hour network capture shows zero non-Google outbound connections; log inspection shows zero raw payloads or credential material in normal mode; the dashboard refuses connections from the host's external IP.
- **US4**: A teammate who has never opened the repo follows only the README, on a clean machine with ADC + active project, and reaches a working dashboard.

## Format Validation

All 95 tasks follow the strict checklist format: `- [ ] TXXX [P?] [Story?] Description with file path`. Tasks in Phases 1, 2, 7 carry no story label by design (cross-cutting). Tasks in Phases 3–6 all carry their `[US1] / [US2] / [US3] / [US4]` label.
