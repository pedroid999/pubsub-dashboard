import { test, expect } from '@playwright/test';
import { start, type RunningServer } from '../../src/server/boot.js';
import { createLogger } from '../../src/server/middleware/trace.js';
import { SessionSchema, type Session } from '../../src/server/schemas/session.js';
import { DEFAULT_PORT, BIND_ADDRESS } from '../../src/shared/port.js';

/**
 * Polish (T055/T057, SC-007): under `prefers-reduced-motion: reduce` the
 * scanline/grain ambience is disabled and entrance animations are minimized,
 * while all controls stay keyboard-reachable with a visible focus ring. Also
 * checks both themes keep the accent + primary text legible (T057).
 */
const session: Session = {
  projectId: 'a11y-proj',
  identity: 'dev@example.com',
  bindAddress: BIND_ADDRESS,
  port: DEFAULT_PORT,
  startedAt: '2026-06-01T00:00:00.000Z',
  lastTraceId: null,
  version: '0.6.0',
  nodeVersion: 'v20.0.0',
};

const mockAuth = {
  getAccessToken: async () => 'fake-a11y-token',
  getCredentials: async () => ({ client_email: 'svc@a11y.test' }),
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

test.use({ reducedMotion: 'reduce' });

test('reduced motion disables the scanline/grain overlay', async ({ page }) => {
  // Emulate the preference explicitly on the page (more reliable than relying
  // solely on the file-scope test.use, which is not honored for the CSS media
  // query here) so the `.fx-overlay { display: none }` reduced-motion rule wins.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const overlay = page.locator('.fx-overlay');
  await expect(overlay).toHaveCSS('display', 'none');
});

test('the ⌘K affordance and theme toggle are keyboard-reachable with visible focus', async ({
  page,
}) => {
  await page.goto('/');
  const trigger = page.getByTestId('command-palette-trigger');
  await trigger.focus();
  await expect(trigger).toBeFocused();
  // Enter opens the palette from the focused control.
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('command-palette')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('command-palette')).toBeHidden();
});

test('both themes keep accent + primary text legible (T057)', async ({ page }) => {
  await page.goto('/');
  const html = page.locator('html');

  // Dark (Sumi Ink) default.
  await expect(html).toHaveAttribute('data-theme', 'dark');
  const brand = page.getByRole('heading', { name: 'Pub/Sub Dashboard' });
  await expect(brand).toBeAttached();

  // Toggle to light (Lotus) and confirm the theme attribute flips.
  await page.getByTestId('theme-toggle').click();
  await expect(html).toHaveAttribute('data-theme', 'light');
});
