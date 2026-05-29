# Phase 1 — Data Model: Project Bootstrap

**Feature**: 001-project-bootstrap
**Date**: 2026-05-29

> Bootstrap has **no persistent application data**. The three entities below
> live in process memory (Active Session, Diagnostics Record) or are a reserved
> on-disk path that is intentionally unused in v1 (User Preferences). Each
> entity is realised as a `zod` schema under `src/server/schemas/**` so the
> client imports the inferred TypeScript types directly.

---

## Entity 1 — `ActiveSession`

Represents the developer's current process run. Created at boot, mutated only
by trace-ID updates on each backend operation, destroyed at shutdown.

### Fields

| Field | Type | Notes |
|---|---|---|
| `projectId` | `string` (non-empty) | Trimmed output of `gcloud config get-value project`. Required. |
| `identity` | `string` (non-empty) | Resolved at boot per `research.md` R2 *Identity resolution*: SA email from `getCredentials().client_email` if non-empty, else `email` from a one-time call to `https://www.googleapis.com/oauth2/v3/userinfo`, else literal fallback `"adc:user (email unresolved)"`. Cached for the session lifetime. Required (always non-empty thanks to the fallback). |
| `bindAddress` | `'127.0.0.1'` (literal) | Hard-coded by FR-002. |
| `port` | `number` (integer, 1..65535) | Default `4321`; overridable via `--port`. |
| `startedAt` | ISO-8601 timestamp string | Set once at boot. |
| `lastTraceId` | `string` (cuid2 or UUIDv4) \| `null` | Updated by `capture` middleware on every API request. Null until first request. |
| `version` | `string` (semver) | From `package.json` at build time. |
| `nodeVersion` | `string` | `process.version`. |

### Validation rules

- `projectId` MUST match `/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/` (GCP project ID format) — boot fails if `gcloud` returns a non-conformant value, mapped to the "no active gcloud project" remediation (FR-007).
- `port` MUST be an integer between 1 and 65535 inclusive; non-integer or out-of-range values fail CLI parsing in `src/cli/args.ts`.

### Lifecycle / state transitions

```text
[uninstantiated] → constructAtBoot(projectId, identity, port, version)
                 → updateTrace(traceId)           (idempotent, called per request)
                 → shutdown()                     (SIGINT/SIGTERM, releases port)
```

### Schema location

`src/server/schemas/session.ts` exports `SessionSchema` (zod) and `Session` (inferred type). Served by `GET /api/session` (see `contracts/http-api.md`).

---

## Entity 2 — `DiagnosticsRecord`

A bounded in-memory ring buffer of the most recent backend operations. Powers
the in-UI Diagnostics panel (FR-009) and the constitution's debug panel
requirement (Principle V).

### Fields per record

| Field | Type | Notes |
|---|---|---|
| `traceId` | `string` | Mints from `crypto.randomUUID()`; flows through `pino.child`. |
| `at` | ISO-8601 timestamp | Server clock at request start. |
| `request` | `{ method: string; path: string; headers: Record<string,string>; body: unknown }` | Body redacted in normal mode; full in verbose mode. |
| `response` | `{ status: number; headers: Record<string,string>; body: unknown; durationMs: number }` | Body redacted in normal mode. |
| `error` | `{ code: string; message: string } \| null` | Populated on non-2xx. |

### Buffer rules

- **Capacity**: fixed at **50 entries** (constant `DIAGNOSTICS_CAPACITY` in `src/server/middleware/capture.ts`). FIFO eviction.
- **Persistence**: in-memory only. Never written to disk. Cleared on process exit. Justification: Principle V (Simplicity); 50 entries is enough for live debugging without becoming a memory leak.
- **Redaction**: applied at *capture* time, not at read time, so verbose mode and normal mode produce different recorded payloads. This is intentional — switching modes mid-session does not retroactively reveal redacted data.

### Schema location

`src/server/schemas/diagnostics.ts` exports `DiagnosticsRecordSchema`, `DiagnosticsListSchema` (array of records, newest first), and inferred types. Served by `GET /api/diagnostics`.

---

## Entity 3 — `UserPreferences` (reserved, unused in v1)

A future on-disk preferences file. Bootstrap **reserves the path** and **MUST
NOT write to it**; it exists in the data model so feature 002+ can begin using
it without ambiguity.

### Fields (reserved)

| Field | Type | Notes |
|---|---|---|
| `preferredPort` | `number` \| `undefined` | Will be honoured by feature 002. |
| `verboseByDefault` | `boolean` \| `undefined` | Will be honoured by feature 002. |
| `recentProjects` | `string[]` \| `undefined` | Will be populated by future project-switch UI. |

### Storage rules (binding for v1 even though no write happens)

- **Path**: `$XDG_CONFIG_HOME/pubsub-dashboard/preferences.json` if `XDG_CONFIG_HOME` is set, else `$HOME/.config/pubsub-dashboard/preferences.json`. On macOS the path resolves to `~/.config/pubsub-dashboard/preferences.json` (we intentionally use the Linux convention on macOS to match developer expectations rather than `~/Library/Application Support`).
- **Permissions**: when feature 002 starts writing, file mode MUST be `0600`; directory mode `0700`.
- **Contents**: MUST NEVER contain credentials of any form (constitution Principle V).
- **v1 invariant**: bootstrap MUST NOT create the directory or the file. A unit test asserts that after a full boot + shutdown cycle, the path does not exist (or, if it pre-existed, was not modified).

### Schema location

`src/server/schemas/preferences.ts` exports `PreferencesSchema` (zod). No route serves or accepts it in v1.

---

## Cross-entity invariants

1. **No entity is ever serialised to disk in v1** except indirectly through pino's stdout. The `UserPreferences` path is reserved but untouched.
2. **All schemas are the single source of truth for both server validation and client typing**. The client imports `Session`, `DiagnosticsRecord` types from the same files the server uses for parsing.
3. **Trace IDs flow as a header** (`x-trace-id` response header) and as a field on every diagnostics record. The client surfaces them in the Diagnostics panel and in any error toast (FR-009 + Principle V).
