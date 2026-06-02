# Interaction Contracts — Feature 006 UX Redesign

This feature is **client-side only** and adds **no HTTP/API endpoints, no Pub/Sub
operations, and no wire-schema changes** (FR-026). The existing API contracts from
features 002/003 (`/api/projects`, topic/subscription listing, publish, pull, ack)
are consumed **unchanged**.

Accordingly, the contracts here are **UI / interaction contracts**: the
observable, testable behavior of the new and restyled surfaces. Each contract is
written as Given/When/Then assertions suitable for `@testing-library/react`
component tests and Playwright E2E, and traces back to the spec's FRs.

| Contract | Surface | Key FRs |
|---|---|---|
| [`command-palette.md`](./command-palette.md) | ⌘K navigation-only palette | FR-005..FR-008 |
| [`appearance-prefs.md`](./appearance-prefs.md) | Settings surface + persistence | FR-003, FR-012..FR-015 |
| [`searchable-list.md`](./searchable-list.md) | Keyboard list nav + highlight | FR-016, FR-017 |
| [`receiver-autopoll.md`](./receiver-autopoll.md) | Auto-poll + 60-cap | FR-020, FR-021 |

**Preservation contract (FR-002)**: every existing acceptance flow from features
002/003/004/005 MUST still pass against the redesigned UI. The Playwright smoke
flow is the executable guard (see `quickstart.md`).
