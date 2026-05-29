# Contract — HTTP API (v1 bootstrap)

**Feature**: 001-project-bootstrap
**Base URL**: `http://127.0.0.1:4321` (default; overridable via `--port`)
**Auth**: none on the wire (the server is loopback-only). All endpoints below
are only callable from `127.0.0.1`.

All JSON responses set:

- `Content-Type: application/json; charset=utf-8`
- `x-trace-id: <uuid-v4>` (matches the `traceId` recorded in `/api/diagnostics`)
- The strict CSP header from R9 on the HTML root only.

All non-2xx error bodies conform to `ErrorResponseSchema`
(see `contracts/schemas.md`).

---

## `GET /api/health`

Liveness check. Used by CI smoke test, README quickstart, and future readiness
probes.

- **Request body**: none.
- **Success response** `200`:
  ```json
  { "status": "ok", "uptimeMs": 1234 }
  ```
- **Failure response**: none in v1 (the route is unconditional once the server is up).

### Contract tests

- T-HTTP-001: returns `200` and a body matching `HealthResponseSchema`.
- T-HTTP-002: includes an `x-trace-id` header that is a valid UUIDv4.
- T-HTTP-003: refuses a request whose `Host:` header is anything other than `127.0.0.1:<port>` or `localhost:<port>` (mitigates DNS rebinding).

---

## `GET /api/session`

Returns the current `ActiveSession`.

- **Request body**: none.
- **Success response** `200`: body matches `SessionSchema` (see `data-model.md`).
- **Failure responses**:
  - `503` with body `{ code: 'ADC_MISSING', message: ..., remediation: 'gcloud auth application-default login' }` — should not normally occur because boot would have refused to start, but the route handles it defensively if credentials expire mid-session.

### Contract tests

- T-HTTP-010: returns `200` with `projectId` matching the GCP project ID regex.
- T-HTTP-011: `identity` is a non-empty string.
- T-HTTP-012: `bindAddress` is exactly `127.0.0.1`.
- T-HTTP-013: `port` matches the port the server is actually listening on.

---

## `GET /api/diagnostics`

Returns the most recent operations captured by the `capture` middleware. Used
by the in-UI Diagnostics panel (FR-009).

- **Query params**:
  - `limit` (optional, integer 1..50, default `20`) — how many records to return.
- **Success response** `200`: body matches `DiagnosticsListSchema` (newest first).
- **Failure responses**:
  - `400` if `limit` fails zod validation.

### Contract tests

- T-HTTP-020: with empty buffer, returns `200` and `[]`.
- T-HTTP-021: after N operations (N < capacity), returns the most recent `min(limit, N)` newest-first.
- T-HTTP-022: never exceeds `DIAGNOSTICS_CAPACITY = 50` entries.
- T-HTTP-023: in normal mode, request and response bodies in the records are `'[REDACTED]'` for payload fields.
- T-HTTP-024: in verbose mode (`--verbose` at boot), payload fields are present but `authorization`/credential fields are still redacted.

---

## Static asset surface

- `GET /` and `GET /index.html` → React app `index.html` from `dist/client/` with the CSP header from R9.
- `GET /assets/*` → fingerprinted Vite outputs with `Cache-Control: public, max-age=31536000, immutable`.
- `GET /*` (anything not under `/api/` or `/assets/`) → SPA fallback to `index.html` to support client-side routing later. v1 has no client routes besides `/`.

### Contract tests

- T-HTTP-030: `GET /` returns `200`, `Content-Type: text/html; charset=utf-8`, and the configured CSP header.
- T-HTTP-031: `GET /api/does-not-exist` returns `404`, not the SPA fallback (API namespace must be exact).
- T-HTTP-032: `GET /assets/<bogus>` returns `404`; the SPA fallback does NOT cover `/assets/*`.

---

## Bind / network surface contract

These are not endpoints but contractual properties of the running server,
verified by integration tests.

- T-NET-001: socket bound to `127.0.0.1` only; a connection attempt to the host's external IP is refused. (Integration test runs against the actual server.)
- T-NET-002: no outbound connection to any non-Google host during a one-minute interactive session (instrumented integration test wrapping `dns.lookup` / `net.connect`).
