import { test, expect } from '@playwright/test';
import { start, type RunningServer } from '../../src/server/boot.js';
import { createLogger } from '../../src/server/middleware/trace.js';
import { SessionSchema, type Session } from '../../src/server/schemas/session.js';
import { DEFAULT_PORT, BIND_ADDRESS } from '../../src/shared/port.js';

/**
 * Polish (T056 / SC-008 / FR-025): the redesign is local-first — loading the app
 * makes NO third-party network request (fonts are self-hosted, no CDN). Every
 * request the page issues must target the local origin.
 */
const session: Session = {
  projectId: 'local-proj',
  identity: 'dev@example.com',
  bindAddress: BIND_ADDRESS,
  port: DEFAULT_PORT,
  startedAt: '2026-06-01T00:00:00.000Z',
  lastTraceId: null,
  version: '0.6.0',
  nodeVersion: 'v20.0.0',
};

const mockAuth = {
  getAccessToken: async () => 'fake-local-token',
  getCredentials: async () => ({ client_email: 'svc@local.test' }),
};

let server: RunningServer;

test.beforeAll(async () => {
  server = await start({
    port: DEFAULT_PORT,
    logger: createLogger({ level: 'silent' }),
    clientDir: 'dist/client',
    getSession: async (traceId) => SessionSchema.parse({ ...session, lastTraceId: traceId }),
    auth: mockAuth,
  });
});

test.afterAll(async () => {
  await server.close();
});

test('loading the app issues no third-party (non-local) network request', async ({ page }) => {
  const offOrigin: string[] = [];
  page.on('request', (req) => {
    const url = new URL(req.url());
    const isLocal =
      url.hostname === '127.0.0.1' || url.hostname === 'localhost' || url.protocol === 'data:';
    if (!isLocal) offOrigin.push(req.url());
  });

  await page.goto('/');
  // Give late assets (fonts, etc.) a chance to fire.
  await page.waitForLoadState('networkidle');

  expect(offOrigin, `unexpected off-origin requests:\n${offOrigin.join('\n')}`).toEqual([]);
});
