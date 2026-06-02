import { test, expect } from '@playwright/test';
import { start, type RunningServer } from '../../src/server/boot.js';
import { createLogger } from '../../src/server/middleware/trace.js';
import { SessionSchema, type Session } from '../../src/server/schemas/session.js';
import { DEFAULT_PORT, BIND_ADDRESS } from '../../src/shared/port.js';

/**
 * US1 redesign smoke (T010): the "Kanagawa × Blade Runner" shell renders with
 * the dark theme by default (FR-003), the branded header is present, and the
 * theme toggle still persists a preference (feature-004 behavior preserved under
 * the new skin — FR-002). The full publish→pull→ack round-trip is covered by
 * us3-publish-subscribe.spec.ts, which keeps guarding FR-002 against the API.
 */
const session: Session = {
  projectId: 'redesign-proj',
  identity: 'dev@example.com',
  bindAddress: BIND_ADDRESS,
  port: DEFAULT_PORT,
  startedAt: '2026-06-01T00:00:00.000Z',
  lastTraceId: null,
  version: '0.6.0',
  nodeVersion: 'v20.0.0',
};

const mockAuth = {
  getAccessToken: async () => 'fake-redesign-token',
  getCredentials: async () => ({ client_email: 'svc@redesign.test' }),
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

test('defaults to the dark "Sumi Ink" theme on first load (FR-003)', async ({ page }) => {
  await page.goto('/');
  const html = page.locator('html');
  await expect(html).toHaveClass(/dark/);
  await expect(html).toHaveAttribute('data-theme', 'dark');
});

test('renders the redesigned branded header and theme toggle', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Pub/Sub Dashboard' })).toBeAttached();
  await expect(page.getByTestId('theme-toggle')).toBeVisible();
});

test('theme toggle still persists a preference under the redesign (FR-002)', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('theme-toggle').click();
  const pref = await page.evaluate(() => localStorage.getItem('pubsub-dashboard:theme'));
  expect(['dark', 'light', 'system']).toContain(pref);
});
