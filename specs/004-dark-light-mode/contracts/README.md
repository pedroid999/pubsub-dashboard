# Contracts: Dark/Light Mode Selector

**Feature**: 004-dark-light-mode

## No new server contracts

This feature is entirely client-side. It introduces:
- No new Hono routes
- No new API endpoints
- No changes to existing request/response schemas

The only contract surface is the `localStorage` schema documented in `data-model.md` (Entity 1 — ThemePreference). That schema is owned by the client and has no server counterpart.

Existing contracts are unaffected.
