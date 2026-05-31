import { test, expect } from '@playwright/test';
import { start, type RunningServer } from '../../src/server/boot.js';
import { createLogger } from '../../src/server/middleware/trace.js';
import { SessionSchema, type Session } from '../../src/server/schemas/session.js';
import { DEFAULT_PORT, BIND_ADDRESS } from '../../src/shared/port.js';

const session: Session = {
  projectId: 'theme-test-project',
  identity: 'dev@example.com',
  bindAddress: BIND_ADDRESS,
  port: DEFAULT_PORT,
  startedAt: '2026-05-31T00:00:00.000Z',
  lastTraceId: null,
  version: '0.4.0',
  nodeVersion: 'v20.0.0',
};

const mockAuth = {
  getAccessToken: async () => 'fake-theme-token',
  getCredentials: async () => ({ client_email: 'svc@theme.test' }),
};

let server: RunningServer;

test.beforeAll(async () => {
  // Use DEFAULT_PORT so the URL matches the baseURL + Host header in playwright.config.ts.
  // extraHTTPHeaders sends Host: 127.0.0.1:4321 to all requests including page.goto;
  // Chromium rejects navigation when the Host header port differs from the URL port.
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

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('theme toggle is present in the header', async ({ page }) => {
  await expect(page.getByTestId('theme-toggle')).toBeVisible();
});

test('clicking the toggle writes a preference to localStorage', async ({ page }) => {
  await page.getByTestId('theme-toggle').click();
  const pref = await page.evaluate(() => localStorage.getItem('pubsub-dashboard:theme'));
  expect(['dark', 'light', 'system']).toContain(pref);
});

test('dark preference is applied on reload (no FOUC)', async ({ page }) => {
  await page.evaluate(() => localStorage.setItem('pubsub-dashboard:theme', 'dark'));
  await page.reload();
  const hasDark = await page.locator('html').evaluate((el) => el.classList.contains('dark'));
  expect(hasDark).toBe(true);
});

test('light preference is applied on reload', async ({ page }) => {
  await page.evaluate(() => {
    document.documentElement.classList.add('dark');
    localStorage.setItem('pubsub-dashboard:theme', 'light');
  });
  await page.reload();
  const hasDark = await page.locator('html').evaluate((el) => el.classList.contains('dark'));
  expect(hasDark).toBe(false);
});

test('toggle aria-label describes the next action when dark', async ({ page }) => {
  await page.evaluate(() => localStorage.setItem('pubsub-dashboard:theme', 'dark'));
  await page.reload();
  const label = await page.getByTestId('theme-toggle').getAttribute('aria-label');
  expect(label?.toLowerCase()).toContain('light');
});
