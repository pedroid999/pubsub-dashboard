# Phase 0 — Research: Project Bootstrap

**Feature**: 001-project-bootstrap
**Date**: 2026-05-29
**Status**: Complete (zero unresolved NEEDS CLARIFICATION items)

> The five clarification questions from `/speckit.clarify` are already resolved
> in `spec.md` (auth, project resolution, port, coverage scope, CI matrix).
> Phase 0 therefore only consolidates *technology* decisions and *best-practice*
> notes that the spec deliberately delegated to planning. Every entry below
> follows the Decision / Rationale / Alternatives format.

---

## R1 — HTTP framework

- **Decision**: `hono`
- **Rationale**: ~14 KB, zero-dependency, native Node `Request`/`Response` adapter, first-class TypeScript types, middleware composes cleanly. Boots in < 30 ms on Node 20, which is what makes the < 3 s p95 cold-boot budget (SC-001) reachable.
- **Alternatives considered**:
  - **Express** — boots fast but typing story is poor; would force a separate `zod` validation layer the client cannot import cleanly.
  - **Fastify** — excellent runtime perf, but pulls in Avro/Pino-pretty and adds ~80 KB of deps; overkill for a loopback dev tool.
  - **Next.js / Remix** — eliminated by the constitution's single-process / no-SSR-needed constraint.

## R2 — ADC, project, and identity resolution

- **Decision**: Use `google-auth-library` for ADC token resolution (`new GoogleAuth().getClient()` + `getAccessToken()`), and a direct `child_process.execFile('gcloud', ['config', 'get-value', 'project'])` shell-out for the active project.
- **Rationale**: `google-auth-library` is the lowest-level officially supported package for ADC; using it directly avoids pulling the full Pub/Sub SDK at boot. The clarification answer locks project resolution to `gcloud config get-value project` only, which has no library equivalent (the SDK reads `GOOGLE_CLOUD_PROJECT` and ADC quota project, which we are explicitly forbidden from using).
- **Alternatives considered**:
  - **`@google-cloud/pubsub` Auth helpers** — they exist but pull the whole Pub/Sub client (~3 MB of deps) before any Pub/Sub feature exists; deferred to feature 002.
  - **`gcloud auth application-default print-access-token`** — works but spawns a process on every API call; we cache via `google-auth-library` instead.

### Identity resolution (FR-008)

The dashboard MUST display the identity behind the active credentials. The two
ADC flavours behave differently:

- **Service-account ADC** → `getCredentials().client_email` returns the SA email directly.
- **User ADC** → `client_email` is empty; the actual user email is only obtainable via Google's userinfo endpoint.

- **Decision**: At boot, resolve identity in this order:
  1. If `getCredentials().client_email` is non-empty, use it (service account case).
  2. Otherwise, GET `https://www.googleapis.com/oauth2/v3/userinfo` once with the access token, parse `email`, cache for the lifetime of the session.
  3. If the userinfo call fails for any reason, fall back to the literal string `"adc:user (email unresolved)"` and log the error at `warn` level. Boot does **not** fail.
- **Rationale**: The userinfo endpoint is `*.googleapis.com` — fully constitutional under Principle I (no non-Google outbound). One call at boot, cached, costs ~50 ms and gives the user the email they expect to see. Falling back instead of failing keeps boot resilient: a transient userinfo failure should not block a developer from using the dashboard.
- **Alternatives considered**:
  - **Always show literal `"adc:user"`** — cheaper but worse UX; the developer cannot tell which Google account is currently active, which defeats half of FR-008.
  - **Use the ID token claim** — only available if the ADC flow already minted an ID token, which is not guaranteed for `application-default login`.

## R3 — React + Vite served by Hono

- **Decision**: Vite builds the client into `dist/client/` during `npm run build`; at runtime Hono serves that directory with `serveStatic` and a strict CSP middleware. No dev server is shipped to end users; `vite dev` is contributor-only.
- **Rationale**: Single process in production (constitution Technology Constraint). Vite gives sub-second HMR for contributors and tree-shaken bundles for end users. `serveStatic` with explicit MIME map keeps the CSP whitelist minimal.
- **Alternatives considered**:
  - **Embed assets via `import.meta.glob` into the Hono binary** — possible but breaks browser DevTools sourcemaps.
  - **Ship vite preview as the prod server** — adds Vite to the runtime deps and contradicts Principle V (Simplicity).

## R4 — UI primitives

- **Decision**: Tailwind CSS + `shadcn/ui` (copy-paste primitives) + `lucide-react` icons. No CSS-in-JS runtime.
- **Rationale**: shadcn primitives are vendored into `src/client/components/ui/**`, so they can be excluded from coverage (FR-015 clarification) without losing accountability — they remain readable in-repo. Tailwind keeps the production CSS bundle under ~15 KB after purge.
- **Alternatives considered**:
  - **MUI / Chakra** — heavy runtime, larger bundle, hurts SC-001.
  - **Headless UI alone** — fewer pre-built compositions; would slow v1.

## R5 — JSON editor

- **Decision**: Deferred to feature 002 (publish flow). v1 has no JSON-editing surface yet — only the read-only Diagnostics panel which renders pre-formatted JSON via a plain `<pre>` block.
- **Rationale**: The constitution lists CodeMirror or Monaco as the editor choice ("one, not both"); making that pick in bootstrap risks bringing in ~500 KB of editor we will not use in v1 and counts against SC-001.
- **Alternatives considered**: choosing now and lazy-loading on demand — possible, but lazy-load infra is itself complexity we do not need until feature 002 ships.

## R6 — CLI argument parsing

- **Decision**: Hand-rolled `node:util.parseArgs` wrapper validated by a `zod` schema in `src/cli/args.ts`. Flags: `--port <n>`, `--verbose`, `--help`, `--version`.
- **Rationale**: `node:util.parseArgs` is built in (no dep added), is enough for 4 flags, and lets us run the parsed result through `zod` to get the same typed surface the rest of the codebase uses. Adding `commander` or `yargs` would pull in 50+ transitive deps for very little gain.
- **Alternatives considered**:
  - **`commander`** — friendlier help output but adds a dep.
  - **`yargs`** — overkill.

## R7 — Logging

- **Decision**: `pino` configured with `pino.destination({ sync: false })`, base context = `{ pid, app: 'pubsub-dashboard', version }`. Per-request middleware mints a `traceId` (cuid2 or `crypto.randomUUID()`) and attaches it via `pino.child`. Verbose mode raises level to `debug`; default is `info`.
- **Rationale**: pino is the fastest mainstream Node logger and emits JSON natively. Trace IDs satisfy constitution Principle V (Observability).
- **Alternatives considered**:
  - **`winston`** — slower, less ergonomic JSON.
  - **Console-only logging** — fails Principle V's "structured logging" requirement.

## R8 — Payload and credential redaction

- **Decision**: Wrap pino with a `redact: { paths: ['*.message.data', '*.authorization', '*.credentials', 'req.headers.authorization'], remove: false, censor: '[REDACTED]' }` config. In normal mode, message data bodies become `[REDACTED]`; in `--verbose` mode the redact path for `*.message.data` is removed but `*.authorization` and credential paths remain redacted.
- **Rationale**: SC-007 requires zero raw payloads or credentials in normal-mode logs; pino's `redact` is the right tool and is bench-grade fast.
- **Alternatives considered**: writing a custom serializer — more code, more risk of leaking on edge fields.

## R9 — Content-Security-Policy

- **Decision**: Middleware emits `Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'` on every HTML response.
- **Rationale**: `'unsafe-inline'` for styles is required because Tailwind's preflight inlines styles; we cannot eliminate it without adding nonce plumbing. All scripts come from `'self'` (Vite output is bundled, no inline scripts). `connect-src 'self'` prevents the client from talking to anywhere other than the local server, which in turn talks only to Google APIs from the backend (SC-006).
- **Alternatives considered**:
  - **Nonce-based CSP** — possible but requires HTML rewriting middleware; deferred.

## R10 — Test runners

- **Decision**: Vitest for unit + integration, Playwright `APIRequestContext` for E2E smoke (no browser window in CI). Coverage via `@vitest/coverage-v8`.
- **Rationale**: vitest shares the Vite config and is the natural fit for a Vite-based client. `APIRequestContext` exercises the same HTTP surface the user's browser would hit while avoiding the cost and flakiness of launching Chromium in CI for an MVP that has no interactive UI flows to test yet (Story 1's "browser opens" is verified by mocking `open` in an integration test).
- **Alternatives considered**:
  - **Jest** — slower; mismatched with Vite.
  - **Playwright with full browser in CI** — adds ~3 min to every job and ~600 MB of cache; saved for feature 002+ when there are interactive flows worth a real browser.

## R11 — CI on GitHub Actions

- **Decision**: One workflow `.github/workflows/ci.yml` with `strategy.matrix.os: [ubuntu-latest, macos-latest]` and `node-version: [20.x]`. Single job per OS that runs `npm ci → npm run verify`. The README-quickstart job runs only on `ubuntu-latest` (the quickstart text is OS-agnostic; running it twice is wasteful).
- **Rationale**: Matches the clarified CI matrix (FR-014). Single matrix keeps maintenance trivial.
- **Alternatives considered**:
  - **Splitting lint/typecheck/test into separate jobs** — slightly faster on cache hits but multiplies the runner count and the moving parts to debug. Single-job is cheaper and simpler for v1.

## R12 — README quickstart validation

- **Decision**: `scripts/extract-readme-quickstart.mjs` parses `README.md` for a fenced block tagged `bash quickstart`, writes it to a temp file, runs it with `bash -e`, and asserts a final `curl -fsS http://127.0.0.1:4321/api/health` succeeds. CI invokes this script.
- **Rationale**: Keeps the README the single source of truth for the quickstart text (FR-019). A tagged fence makes the extractor unambiguous and lets reviewers see exactly what CI executes.
- **Alternatives considered**:
  - **`mdsh` / `byexample`** — third-party deps for a 30-line shell script.

## R13 — Dependency budget for v1

The constitution requires written justification for each runtime dependency. v1 runtime dependencies (those that ship inside the published npm package):

| Package | Why needed | Alternative rejected |
|---|---|---|
| `hono` | HTTP routing + middleware (R1) | Express (typings), Fastify (size) |
| `google-auth-library` | ADC resolution (R2) | `@google-cloud/pubsub` (oversized for bootstrap) |
| `pino` | Structured JSON logging (R7) | `winston` (slower, less ergonomic) |
| `zod` | Shared schemas client↔server (Principle III) | `valibot` (less ecosystem), hand-rolled (no type inference) |
| `open` | Cross-platform browser launch (FR-003) | hand-rolled per-OS `child_process` (Windows-style edge cases we explicitly avoid by dropping Windows; still simpler to use the lib for macOS+Linux) |
| `react`, `react-dom` | UI runtime (Principle V) | Preact (smaller, but shadcn primitives target React) |

Devtime-only deps (excluded from the published package) are listed in `package.json`'s `devDependencies` and do not require constitutional justification beyond their CI role.

## Resolved NEEDS CLARIFICATION

None remaining. The Technical Context in `plan.md` contains no `NEEDS CLARIFICATION` markers.
