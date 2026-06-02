import { test, expect } from '@playwright/test';
import { start, type RunningServer } from '../../src/server/boot.js';
import { createLogger } from '../../src/server/middleware/trace.js';
import { SessionSchema, type Session } from '../../src/server/schemas/session.js';
import { DEFAULT_PORT, BIND_ADDRESS } from '../../src/shared/port.js';

/**
 * US4 (T034): density + accent chosen in the appearance settings persist across
 * a reload with no flash of the wrong appearance — the pre-hydration inline
 * script applies data-density/-accent before React mounts (SC-004 / A9).
 */
const session: Session = {
  projectId: 'appearance-proj',
  identity: 'dev@example.com',
  bindAddress: BIND_ADDRESS,
  port: DEFAULT_PORT,
  startedAt: '2026-06-01T00:00:00.000Z',
  lastTraceId: null,
  version: '0.6.0',
  nodeVersion: 'v20.0.0',
};

const mockAuth = {
  getAccessToken: async () => 'fake-appearance-token',
  getCredentials: async () => ({ client_email: 'svc@appearance.test' }),
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

test('density + accent persist across reload (SC-004)', async ({ page }) => {
  await page.goto('/');
  const html = page.locator('html');

  // Defaults from the bootstrap.
  await expect(html).toHaveAttribute('data-density', 'compact');
  await expect(html).toHaveAttribute('data-accent', 'cyan');

  await page.getByTestId('settings-trigger').click();
  await page.getByTestId('density-cozy').click();
  await page.getByTestId('accent-violet').click();
  await page.keyboard.press('Escape');

  await expect(html).toHaveAttribute('data-density', 'cozy');
  await expect(html).toHaveAttribute('data-accent', 'violet');

  // Reload: the pre-hydration script must restore them before first paint.
  await page.reload();
  await expect(html).toHaveAttribute('data-density', 'cozy');
  await expect(html).toHaveAttribute('data-accent', 'violet');
});

test('theme toggle in settings persists Sumi-Ink ⇄ Lotus (A3)', async ({ page }) => {
  await page.goto('/');
  const html = page.locator('html');
  await expect(html).toHaveAttribute('data-theme', 'dark');

  await page.getByTestId('settings-trigger').click();
  await page.getByTestId('theme-light').click();
  await page.keyboard.press('Escape');
  await expect(html).toHaveAttribute('data-theme', 'light');

  await page.reload();
  await expect(html).toHaveAttribute('data-theme', 'light');
});
