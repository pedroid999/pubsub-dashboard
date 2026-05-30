import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:4321',
    extraHTTPHeaders: {
      // Loopback-only server; Host header guard is part of T-HTTP-003.
      host: '127.0.0.1:4321',
    },
  },
  // No `webServer` block: each E2E spec spawns the bin/server itself so the
  // boot lifecycle (FR-001..FR-004) is exercised end-to-end, not pre-started.
});
