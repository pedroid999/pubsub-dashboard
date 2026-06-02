# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-06-02

First stable release 🎉 — a complete UX redesign over the shipped messaging
surface, with every prior capability preserved.

### Added

- **Complete UX redesign — "Kanagawa × Blade Runner"** (feature 006): a deep
  "Sumi Ink" dark theme and a "Lotus washi" light theme, neon accents, refined
  typography, and a panelized layout applied across the whole app, re-skinning
  features 002–005 with **no behavioral regression**.
  - **⌘K command palette** (US2): navigation-only fuzzy search over projects,
    topics, and subscriptions, fully keyboard-operable.
  - **Workspace layouts** (US3): Rail / Triptych / Console, persisted across
    sessions; switching never loses selection or the composed draft.
  - **Appearance settings** (US4): user-configurable information density and
    accent color, persisted; neon/scanlines remain fixed tasteful defaults.
  - **Keyboard-navigable resource lists** (US5): type-to-filter with match
    highlighting and ↑/↓/Home/End/Enter/Escape, active row kept in view.
  - **Live JSON syntax highlighting** (US6): a display-only overlay over the
    composer that never alters the published bytes.
  - **Receiver auto-poll** (US7): opt-in 2.5-second polling with a visible
    active indicator and a 60-message running cap.
  - **Header, context bar, and status flashes** (US8): brand, project switcher,
    ADC status, ⌘K affordance, theme toggle, Project · Topic · Subscription
    breadcrumb, and transient non-blocking action feedback.
- **Header session badge follows the active project**: shows the gcloud default
  only at startup, then the selected project, so the badge and the project
  switcher never disagree.
- **Load a JSON body from a local file** in the publisher via the OS file
  browser (read locally with `FileReader`; the file never leaves the browser).

### Notes

- Local-first preserved: fonts/assets are self-hosted (no third-party CDN at
  runtime), no new network sinks or telemetry, and no server/auth/boot/schema
  changes — the redesign consumes the existing data and auth surfaces only.
- Accessibility baseline: keyboard reachability, visible focus, sufficient
  contrast in both themes, and honored `prefers-reduced-motion`.

## [0.5.0] - 2026-06-01

### Added

- **JSON message composer & copy-to-republish** (feature 005): structured JSON
  composition with live well-formedness validation and a Format action in the
  publisher, plus the ability to copy a received message (payload + attributes)
  straight into the composer to republish. Client-only — reuses the existing
  publish path with no new server or Pub/Sub operations.

## [0.4.0] - 2026-05-31

### Added

- **Dark / light / system theme** (feature 004): a theme selector with a
  persisted preference applied on first paint without a flash of the wrong
  theme.

## [0.3.0] - 2026-05-31

### Added

- **Publish & Subscribe — the full messaging round-trip** (feature 003). On top
  of the active topic/subscription selection from feature 002:
  - **Publish** a message body (text or JSON) plus optional key/value attributes
    to the active topic, with a returned message ID
    (`POST /api/projects/:projectId/topics/:topicId/publish`).
  - **Pull** up to 10 currently available messages on demand from the active
    subscription; successive pulls accumulate into a running list with an
    explicit Clear; JSON payloads are pretty-printed and non-UTF-8 payloads are
    shown as labelled base64
    (`POST /api/projects/:projectId/subscriptions/:subscriptionId/pull`).
  - **Acknowledge** individual messages explicitly — a plain pull never removes
    messages, so the tool is safe to point at a shared subscription
    (`POST /api/projects/:projectId/subscriptions/:subscriptionId/ack`).
- In-memory Pub/Sub demo seam so the Playwright smoke runs a real publish→pull
  round-trip in CI without GCP credentials (constitution Principle II).

### Notes

- No new runtime dependency: synchronous pull/acknowledge use the
  `v1.SubscriberClient` from the existing `@google-cloud/pubsub` package.
- First feature to perform write/state-changing operations; reads remain
  read-only and acknowledgement is always explicit and opt-in.

## [0.1.2] - 2026-05-30

### Fixed

- **`npx pubsub-dashboard` failed with `ENOENT: dist/client/index.html` when run
  from any directory other than the package root.** The default client directory
  was resolved against `process.cwd()`; it is now resolved relative to the
  module location (`import.meta.url`), so the built client is found regardless of
  the working directory.

## [0.1.1] - 2026-05-30

### Added

- Automated npm release via `.github/workflows/release.yml`: publishes on merge
  to `main` using npm Trusted Publishing (OIDC, no stored token), with build
  provenance, guarded so a merge without a version bump is a no-op.

### Changed

- Marked `bin/pubsub-dashboard.mjs` executable (`+x`).

## [0.1.0] - 2026-05-30

Initial release — project bootstrap (feature `001-project-bootstrap`).

### Added

- **US1 — One-command first run**: `npx pubsub-dashboard` resolves gcloud ADC
  and the active project (`gcloud config get-value project`), starts a
  loopback-only server, and opens the browser showing the project ID and
  identity. Friendly, actionable exit codes for missing ADC, missing gcloud,
  no active project, port-in-use, and unsupported Node.
- **US3 — Trustworthy local-only operation**: 127.0.0.1-only bind with a `Host`
  guard, strict Content-Security-Policy on HTML, log redaction (credentials
  always; payloads only in `--verbose`), and a Diagnostics panel + `/api/diagnostics`
  ring buffer of recent operations with redaction applied at capture time.
- **US2 — Reproducible quality from commit 1**: `npm run verify`
  (lint + format + typecheck + ≥90% line/branch coverage + e2e) enforced in CI
  on `ubuntu-latest` and `macos-latest`. ESLint forbids reading
  `GOOGLE_CLOUD_PROJECT`. Gate self-tests prove the gates have teeth.
- **US4 — CI-validated README quickstart**: the README's `bash quickstart`
  block is executed in CI against the local build via an offline demo seam
  (`PUBSUB_DEMO_PROJECT`), so changes to the boot/auth path that break the
  documented flow fail CI.

### Notes

- **Supported OS**: macOS and Linux. Windows is not supported in v1.
- **Out of scope for v1**: publishing, subscribing, and JSON message
  composition — planned for feature 002+.
