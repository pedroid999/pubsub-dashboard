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

## Quality gate invariants

- **Coverage**: ≥90% line **and** branch on `src/**`. Exclusions are limited to
  `src/client/components/ui/**`, `src/client/main.tsx`, `*.d.ts`, story files,
  and `bin/**` (see `vitest.config.ts`).
- **Project resolution**: the active GCP project comes only from
  `gcloud config get-value project`. Reading `GOOGLE_CLOUD_PROJECT` anywhere in
  `src/` is blocked by an ESLint rule.
- **Local-only**: the server binds `127.0.0.1` exclusively and makes no outbound
  calls except to Google Cloud APIs.
