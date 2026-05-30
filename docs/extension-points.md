# Extension points (feature 002+)

This bootstrap (feature `001`) is deliberately shaped so future dashboard
sections — publish, subscribe, JSON message composition, topic/subscription
browsing — can be added **without touching the boot path or the auth
resolution path** (FR-020). This document is the contract for how to extend it.

## The documented surface

To add a new dashboard feature, you add files in four places:

1. **Route** — `src/server/routes/<feature>.ts`
   Export a `register<Feature>(app, deps)` function that wires the endpoints.
2. **Schemas** — `src/server/schemas/<feature>.ts`
   Define zod schemas for the request/response shapes. The schema is the single
   source of truth for both server validation and client types.
3. **Registration** — register the route in the app composition (`buildServer`
   in `src/server/server.ts`, which builds on `createApp()`), following the
   existing `registerHealth` / `registerSession` / `registerDiagnostics` calls.
4. **UI** — `src/client/components/<Feature>.tsx`
   A React component that calls the new endpoint via `apiGet` /
   `src/client/lib/api.ts` and renders the result.

Auth, when needed, is consumed **only** through the barrel:

```ts
import { resolveAdc, getActiveProject, resolveIdentity } from '../auth/index.js';
```

## What you must NOT modify or import

The following are frozen infrastructure. Changing them is a boot/auth-path
change, not a feature addition:

- `bin/` — the CLI entry and Node-version guard.
- `src/server/boot.ts` — the listen/shutdown lifecycle.
- `src/server/auth/**` internals — specifically `auth/adc.ts` and
  `auth/project.ts`. Import the public surface from `src/server/auth/index.ts`
  instead.

## How the boundary is enforced

An ESLint `no-restricted-imports` rule (`eslint.config.js`) forbids any file
**outside** `src/server/auth/**` from importing `auth/adc.ts` or
`auth/project.ts` directly. Only the `src/server/auth/index.ts` re-exports are
consumable. The rule is covered by `tests/unit/lint.extension-rule.test.ts`,
which asserts the rule fires on a fixture violation and stays silent for the
allowed barrel import.

This keeps the gcloud/ADC resolution logic behind one seam: feature 002+ can
rely on `resolveAdc()` / `getActiveProject()` without ever depending on _how_
they talk to gcloud, so that implementation can change freely.
