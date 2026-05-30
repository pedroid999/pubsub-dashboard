# pubsub-dashboard

A local-first dashboard for Google Cloud Pub/Sub. It runs entirely on
`127.0.0.1`, authenticates with your existing **gcloud Application Default
Credentials**, and never talks to anything except Google Cloud APIs.

- **Loopback only** — binds `127.0.0.1`, refuses non-local `Host` headers.
- **No credentials of its own** — reuses `gcloud auth application-default login`.
- **No project inference** — the active project comes only from
  `gcloud config get-value project` (never `GOOGLE_CLOUD_PROJECT`).
- **One command** — `npx pubsub-dashboard` boots and opens your browser.

## Prerequisites

- **OS**: macOS or Linux. Windows is **not supported** in v1.
- **Node.js**: ≥ 20 LTS — check with `node --version`.
- **Google Cloud SDK** (`gcloud`) installed and on `PATH`.
- **ADC** configured: run `gcloud auth application-default login` once.
- **Active project**: run `gcloud config set project <PROJECT_ID>` once.

## Quickstart

```bash
gcloud auth application-default login   # once
gcloud config set project <PROJECT_ID>  # once
npx pubsub-dashboard                     # boots + opens http://127.0.0.1:4321
```

The block below is the **verifiable** quickstart — CI runs it on every PR
(FR-019). It launches the server, waits for `/api/health` to report `ok`, then
shuts it down. Set `PUBSUB_BIN` to point at a local build; it defaults to the
published CLI. In CI, `PUBSUB_DEMO_PROJECT` lets the server boot without gcloud.

```bash quickstart
set -euo pipefail
PUBSUB_BIN="${PUBSUB_BIN:-npx pubsub-dashboard}"
PORT="${PORT:-4321}"

# Launch the loopback-only dashboard in the background.
$PUBSUB_BIN --port "$PORT" &
SERVER_PID=$!
trap 'kill "$SERVER_PID" 2>/dev/null || true' EXIT

# Poll the health endpoint until the server is ready.
ready=""
for _ in $(seq 1 40); do
  if curl -fsS "http://127.0.0.1:${PORT}/api/health" >/tmp/pubsub-health.json 2>/dev/null; then
    ready="yes"
    break
  fi
  sleep 0.25
done

test -n "$ready"
grep -q '"status":"ok"' /tmp/pubsub-health.json
echo "pubsub-dashboard health: ok"
```

A browser tab opens on `http://127.0.0.1:4321` showing the active project ID,
your identity, and a Diagnostics panel with the most recent backend operation.

## Supported OS

macOS and Linux only. **Windows is not supported** in v1.

## What's in scope (and what's not)

**In scope for v1 (this release):** one-command boot, gcloud ADC auth, active
project + identity display, loopback-only operation with strict CSP and log
redaction, and an in-app Diagnostics panel.

**Out of scope for v1 (planned for feature 002+):** publishing messages,
subscribing/pulling messages, and JSON message composition. See
[docs/extension-points.md](docs/extension-points.md) for how those features
plug in without changing the boot or auth paths.

## Flags

| Flag         | Default | Effect                                                                                |
| ------------ | ------- | ------------------------------------------------------------------------------------- |
| `--port <n>` | `4321`  | Override the local port. Exits non-zero with a clear error if the port is in use.     |
| `--verbose`  | off     | Raise log level to `debug`. Payloads are revealed in logs; credentials stay redacted. |
| `--help`     | —       | Print the flag list and exit `0`.                                                     |
| `--version`  | —       | Print the version and exit `0`.                                                       |

## Troubleshooting

| Symptom                         | Cause                   | Fix                                                      |
| ------------------------------- | ----------------------- | -------------------------------------------------------- |
| `ADC not found` exit            | ADC login not run       | `gcloud auth application-default login`                  |
| `gcloud not on PATH` exit       | Cloud SDK not installed | Install from <https://cloud.google.com/sdk/docs/install> |
| `No active gcloud project` exit | No active project       | `gcloud config set project <PROJECT_ID>`                 |
| `Port 4321 in use` exit         | Port busy               | `npx pubsub-dashboard --port 5173`                       |
| `Requires Node >= 20 LTS` exit  | Node too old            | Install / switch to Node 20 LTS+                         |
| Browser does not open           | No default browser      | Open the printed URL manually                            |

## Stop

Press **Ctrl+C**. The server stops within 1 second, releases the port, and
leaves no orphan processes.

## Contributing

See [docs/contributing.md](docs/contributing.md) for the local verification
workflow and CI / branch-protection setup.
