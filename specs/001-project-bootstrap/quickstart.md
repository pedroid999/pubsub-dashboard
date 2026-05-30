# Quickstart — Pub/Sub Dashboard (Bootstrap)

> This file is the **canonical quickstart** for feature 001. The published
> `README.md` "Quickstart" section MUST be derived from this file. CI will
> execute the fenced `bash quickstart` block below verbatim and fail if any
> step exits non-zero (FR-019, R12).

## Prerequisites

- **OS**: macOS or Linux. Windows is **not supported** in v1.
- **Node.js**: ≥ 20 LTS (`node --version`).
- **Google Cloud SDK** (`gcloud`) installed and on `PATH`.
- **ADC** configured: `gcloud auth application-default login` has been run successfully.
- **Active project**: `gcloud config set project <PROJECT_ID>` has been run.

## Run

```bash quickstart
# Verify prerequisites
node --version
gcloud --version
gcloud config get-value project

# Run the dashboard (warm npm cache: < 3 s to interactive)
npx pubsub-dashboard

# Verify the server is up (in another terminal)
curl -fsS http://127.0.0.1:4321/api/health
```

Expected outcome: a browser tab opens on `http://127.0.0.1:4321` showing
the dashboard, with the active GCP project ID and identity displayed in the
top bar and the Diagnostics panel ready to show the most recent backend
operation.

## Common flags

| Flag | Default | Effect |
|---|---|---|
| `--port <n>` | `4321` | Override the local port. The tool exits non-zero with a clear error if the chosen port is in use. |
| `--verbose` | off | Raise log level to `debug`. Payloads remain redacted but credentials stay redacted regardless. |
| `--help` | — | Print this flag list and exit `0`. |
| `--version` | — | Print version from `package.json` and exit `0`. |

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `ADC not found` exit | `gcloud auth application-default login` not run | Run that command and retry. |
| `gcloud not on PATH` exit | Cloud SDK not installed | Install from <https://cloud.google.com/sdk/docs/install>. |
| `No active gcloud project` exit | `gcloud config get-value project` returned empty | Run `gcloud config set project <PROJECT_ID>`. |
| `Port 4321 in use` exit | Another process is bound to `4321` | Re-run with `npx pubsub-dashboard --port 5173` (or any free port). |
| `Requires Node >= 20 LTS` exit | Node version too low | Install / switch to Node 20 LTS or newer. |
| Browser does not open, URL printed instead | No default browser registered | Open the printed URL manually. The server is still running. |

## Stop

Press **Ctrl+C** in the terminal that started the tool. The server stops
within 1 second, releases the port, and leaves no orphan processes (FR-004).

## Contributor verify (development only)

This is **not** part of the published quickstart; it lives here so the doc has
one place that covers both end-user and contributor flows.

```bash
git clone https://github.com/pedroid999/pubsub-dashboard
cd pubsub-dashboard
npm ci
npm run verify           # lint + format check + tsc --noEmit + vitest (≥90%) + playwright smoke + readme-quickstart
```

`npm run verify` is the same script CI runs on every PR.
