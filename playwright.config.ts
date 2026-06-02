import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: 'list',
  // No `webServer` block: each E2E spec spawns the bin/server itself so the
  // boot lifecycle (FR-001..FR-004) is exercised end-to-end, not pre-started.
  // Specs are routed by the fixture they use, listed explicitly per file. A
  // prefix glob (us1-*/us3-*) is NOT safe here: a browser spec sharing a story
  // prefix (e.g. us1-redesign-smoke) would land in the `api` project and fail —
  // and a new spec matching no glob would be silently skipped.
  projects: [
    {
      // APIRequestContext tests (request fixture): explicitly set the Host header
      // so the loopback host-guard (T-HTTP-003) passes when each test binds its
      // own server on a random port while the baseURL uses DEFAULT_PORT.
      name: 'api',
      testMatch: ['us1-first-run.spec.ts', 'us3-publish-subscribe.spec.ts'],
      use: {
        baseURL: 'http://127.0.0.1:4321',
        extraHTTPHeaders: {
          host: '127.0.0.1:4321',
        },
      },
    },
    {
      // Browser (page fixture) tests: no Host override. Chromium treats Host as a
      // forbidden header and rejects navigation with ERR_INVALID_ARGUMENT when
      // extraHTTPHeaders tries to override it. Chromium sends the correct Host
      // automatically based on the URL.
      name: 'browser',
      testMatch: [
        'theme.spec.ts',
        'us1-redesign-smoke.spec.ts',
        'us2-command-palette.spec.ts',
        'us3-layouts.spec.ts',
        'us4-appearance.spec.ts',
        'a11y-reduced-motion.spec.ts',
        'local-first.spec.ts',
      ],
      use: {
        baseURL: 'http://127.0.0.1:4321',
      },
    },
  ],
});
