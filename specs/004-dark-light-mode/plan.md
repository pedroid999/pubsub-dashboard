# Implementation Plan: Dark/Light Mode Selector

**Branch**: `004-dark-light-mode` | **Date**: 2026-05-31 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/004-dark-light-mode/spec.md`

## Summary

Implement a three-state (dark/light/system) theme toggle in the application header. The active color scheme is driven by Tailwind's `class` dark mode strategy — a `dark` class on `<html>`. Theme preference is persisted in `localStorage` for instant synchronous reads. An inline anti-FOUC script in `src/client/index.html` applies the stored preference before React hydrates, eliminating any flash of incorrect theme. All changes are purely client-side; no new server routes, API endpoints, or runtime dependencies are required.

## Technical Context

**Language/Version**: TypeScript 5.6, strict mode, `noImplicitAny` + `strictNullChecks` + `noUncheckedIndexedAccess`

**Primary Dependencies**: React 18, Tailwind CSS 3, Lucide React (already installed — Moon/Sun/Monitor icons), Zod (schema for preference value)

**Storage**: `localStorage` (browser) under key `pubsub-dashboard:theme` — client-only; not `~/.config/pubsub-dashboard/` (see Constitution Check)

**Testing**: Vitest + `@testing-library/react` (unit/component), Playwright (E2E smoke)

**Target Platform**: Browser (modern, evergreen) — same as rest of client

**Project Type**: Single-process web application (Hono serves static React client)

**Performance Goals**: Theme switch ≤ 100ms (SC-001); zero FOUC on load (SC-002); no impact on 3s cold start budget (SC-006)

**Constraints**: No new runtime dependencies (Principle V); TypeScript strict throughout (Principle III); ≥90% line+branch coverage on new code (Principle II)

**Scale/Scope**: Single-user local tool — complexity budget is low

## Constitution Check

*Re-evaluated after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Local-First & Zero-Config | ✅ Pass | Theme stored in `localStorage`; no external calls, no new server side-effects |
| II. Test-First (NON-NEGOTIABLE) | ✅ Pass | TDD required. Tests written before implementation. Unit + component + E2E all required. See research.md for test plan. |
| III. Type Safety End-to-End | ✅ Pass | `ThemePreference` defined as Zod schema; inferred TS type is source of truth across all modules |
| IV. Instant Developer Experience | ✅ Pass | No impact on `npx` startup; anti-FOUC script is ≤200 bytes inline |
| V. Operational Excellence (Simplicity) | ⚠️ Justified Deviation | Theme stored in `localStorage`, not `~/.config/pubsub-dashboard/`. See Complexity Tracking. |

## Project Structure

### Documentation (this feature)

```text
specs/004-dark-light-mode/
├── plan.md              ← This file
├── research.md          ← Phase 0 output
├── data-model.md        ← Phase 1 output
├── contracts/
│   └── README.md        ← No new API contracts (client-only feature)
└── tasks.md             ← Phase 2 output (/speckit-tasks)
```

### Source Code Changes

```text
src/client/
├── index.html                        MODIFIED — add anti-FOUC inline script
├── styles.css                        MODIFIED — add dark: CSS variable overrides
├── App.tsx                           MODIFIED — add ThemeProvider wrapper + ThemeToggle in header
├── lib/
│   └── theme.ts                      NEW — Zod schema, types, constants, context, useTheme hook
└── components/
    └── ThemeToggle.tsx               NEW — toggle button (cycles dark → light → system)

tailwind.config.ts                    MODIFIED — add darkMode: 'class'

tests/
├── unit/
│   ├── theme.test.ts                 NEW — unit tests: schema, resolution, localStorage logic
│   └── ThemeToggle.test.tsx          NEW — component tests: render, cycling, a11y
└── e2e/
    └── theme.spec.ts                 NEW — E2E: toggle in header, persistence, system detection
```

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|--------------------------------------|
| Theme preference stored in `localStorage` instead of `~/.config/pubsub-dashboard/` | SC-002 (zero FOUC) requires reading the preference synchronously during HTML parsing, before any React code or network request runs. The anti-FOUC inline script cannot make async calls. | Server-side storage via `~/.config/pubsub-dashboard/` would require an HTTP round-trip or SSR injection, neither of which is available in this architecture. The constitution's "single JSON file" provision targets CLI/server preferences (port, verbosity, recent projects) — all settings that have no FOUC constraint. Theme is a browser rendering preference orthogonal to CLI configuration. |
