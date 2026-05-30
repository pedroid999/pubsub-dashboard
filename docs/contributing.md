# Contributing

## Local verification

Run the exact same gate set CI runs on every PR:

```bash
npm ci
npm run build
npm run verify
```

`npm run verify` runs, in order: `lint` → `format:check` → `typecheck` →
`test` (Vitest with ≥90% line/branch coverage on `src/**`) → `e2e` (Playwright
API smoke). Any single failing gate fails the whole command.

## CI and branch protection

CI is defined in `.github/workflows/ci.yml` and runs on every pull request and
on pushes to `main`. The `verify` job runs on a matrix of `ubuntu-latest` and
`macos-latest` with Node 20.x. Windows is **not** supported in v1.

To enforce the quality bar, configure the following **required status checks**
on the `main` branch (GitHub → Settings → Branches → Branch protection rules):

- `verify (ubuntu-latest)`
- `verify (macos-latest)`
- `readme-quickstart`

Also enable:

- **Require a pull request before merging** (no direct pushes to `main`).
- **Require branches to be up to date before merging**.
- **Do not allow bypassing the above settings** (so the gates cannot be skipped).

## Releasing to npm

Publishing is automated via `.github/workflows/release.yml`, which runs on every
push to `main` (i.e. every merged PR). It runs lint + typecheck + tests + build,
then publishes **only if `package.json#version` is not already on npm** — npm
versions are immutable, so a merge without a version bump is a no-op.

Authentication uses **npm Trusted Publishing (OIDC)** — there is **no stored
token**. The workflow proves its identity to npm via GitHub's OIDC, and npm adds
build provenance automatically.

One-time setup (already done once the package exists):

1. npmjs.com → **Packages → pubsub-dashboard → Settings → Trusted publishing**.
2. Add a publisher: GitHub repository `pedroid999/pubsub-dashboard`, workflow
   filename `release.yml`. (Leave the environment blank unless you add one.)

> Trusted Publishing cannot do the **first** publish of a brand-new package
> (npm requires the package to exist first). `0.1.0` was published manually with
> `npm publish --auth-type=web`; every release after that is automated.

To cut a release:

1. Bump `package.json#version` (semver) and add a `CHANGELOG.md` entry in a PR.
2. Merge the PR to `main`. The workflow detects the new version and publishes it.

Merges that don't change the version simply skip the publish step.

## Quality gate invariants

- **Coverage**: ≥90% line **and** branch on `src/**`. Exclusions are limited to
  `src/client/components/ui/**`, `src/client/main.tsx`, `*.d.ts`, story files,
  and `bin/**` (see `vitest.config.ts`).
- **Project resolution**: the active GCP project comes only from
  `gcloud config get-value project`. Reading `GOOGLE_CLOUD_PROJECT` anywhere in
  `src/` is blocked by an ESLint rule.
- **Local-only**: the server binds `127.0.0.1` exclusively and makes no outbound
  calls except to Google Cloud APIs.
