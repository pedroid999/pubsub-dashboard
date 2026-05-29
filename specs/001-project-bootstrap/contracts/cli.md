# Contract — CLI (v1 bootstrap)

**Feature**: 001-project-bootstrap
**Entrypoint**: `pubsub-dashboard` (resolved by `npx pubsub-dashboard` to `bin/pubsub-dashboard.mjs`)

The CLI is intentionally tiny in v1. It boots the server and opens the browser.
Every other interaction happens in the dashboard.

## Synopsis

```text
pubsub-dashboard [--port <n>] [--verbose] [--help] [--version]
```

## Flags

| Flag | Type | Default | Zod constraint | Effect |
|---|---|---|---|---|
| `--port` | integer | `4321` | `z.coerce.number().int().min(1).max(65535)` | TCP port to bind on `127.0.0.1`. |
| `--verbose` | boolean | `false` | `z.boolean()` | Raise log level to `debug`; surface raw payloads in diagnostics records. Credentials remain redacted. |
| `--help` | boolean | — | — | Print synopsis + flag table, exit `0`. |
| `--version` | boolean | — | — | Print `package.json#version`, exit `0`. |

Unknown flags MUST cause a non-zero exit with a message naming the offending
flag and pointing at `--help`.

## Exit codes

| Code | Meaning |
|---|---|
| `0` | Normal shutdown (SIGINT/SIGTERM after a running session), or `--help` / `--version`. |
| `1` | Generic uncaught error. |
| `2` | CLI argument validation failure (unknown flag, invalid `--port`). |
| `10` | Node version < 20 LTS (detected by `bin/pubsub-dashboard.mjs` *before* requiring any source). |
| `11` | `gcloud` not on `PATH`. |
| `12` | ADC missing or expired. |
| `13` | `gcloud config get-value project` returned empty. |
| `14` | Configured port already in use. |

Each non-zero exit MUST be accompanied by a single, copy-pastable remediation
line printed to **stderr** as the last line of output. Examples (exact text is
enforced by contract tests):

```text
[pubsub-dashboard] Requires Node >= 20 LTS. Install or switch with: nvm install 20 && nvm use 20
[pubsub-dashboard] gcloud not found on PATH. Install: https://cloud.google.com/sdk/docs/install
[pubsub-dashboard] ADC not configured. Run: gcloud auth application-default login
[pubsub-dashboard] No active gcloud project. Run: gcloud config set project <PROJECT_ID>
[pubsub-dashboard] Port 4321 already in use. Re-run with: pubsub-dashboard --port 5173
```

## Stdout vs stderr

- **stdout**: structured pino JSON log lines for the running server (one JSON object per line).
- **stderr**: pre-boot diagnostic messages (Node-version guard, gcloud probe), and the single-line remediation messages on non-zero exits.

This split lets users redirect logs with `> log.json` without losing remediation messages.

## Signal handling

- `SIGINT` (Ctrl+C) and `SIGTERM` MUST trigger a graceful shutdown: close the HTTP server, run `await server.close()`, flush pino, exit `0`. Total elapsed time MUST be < 1 s (FR-004).
- A second `SIGINT` during graceful shutdown forces an immediate `process.exit(0)`.
- `SIGKILL` is, by definition, not catchable; documented for completeness.

## Browser launch

After successful boot, the CLI calls `open('http://127.0.0.1:<port>')`. If
`open` rejects (no default browser registered), the CLI:

1. Logs the URL prominently to **stdout** with `Open this URL manually: <url>`.
2. Continues running normally (does **not** exit non-zero — FR-003 + Edge Cases).

## Contract tests

- T-CLI-001: `--help` exits `0`, prints synopsis, does not start the server.
- T-CLI-002: `--version` exits `0`, prints `package.json#version`, does not start the server.
- T-CLI-003: Unknown flag (`--xyz`) exits `2` with the documented remediation pointing at `--help`.
- T-CLI-004: `--port 999999` exits `2` (zod validation).
- T-CLI-005: Node version < 20 → exit `10` with the documented stderr line. Implemented by spawning a child with `NODE_OPTIONS=--max-old-space-size=...` and a stubbed `process.version` is impractical, so this test injects via a fake bin shim that re-`require`s the guard with a mocked `process.version`.
- T-CLI-006: `gcloud` shim returning `command not found` → exit `11`.
- T-CLI-007: `gcloud auth application-default print-access-token` failing → exit `12`.
- T-CLI-008: `gcloud config get-value project` returning empty → exit `13`.
- T-CLI-009: Port already bound (test pre-binds a socket) → exit `14`.
- T-CLI-010: Successful boot calls `open()` with the correct URL; if `open` rejects, exit code remains `0` and the URL is printed on stdout.
- T-CLI-011: `SIGINT` during running session causes exit `0` within 1 s; port is released.
