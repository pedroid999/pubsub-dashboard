import { test, expect } from '@playwright/test';
import { start, type RunningServer } from '../../src/server/boot.js';
import { createLogger } from '../../src/server/middleware/trace.js';
import { createInMemoryPubSubClient } from '../../src/server/cli/demoPubSub.js';
import { SessionSchema, type Session } from '../../src/server/schemas/session.js';
import { DEFAULT_PORT, BIND_ADDRESS } from '../../src/shared/port.js';

/**
 * US2 (T022): the ⌘K command palette opens, filters a topic, Enter activates it
 * (the context breadcrumb reflects the selection), and Esc closes it.
 * Uses the in-memory demo Pub/Sub seam so the active project has real topics.
 */
const session: Session = {
  projectId: 'e2e-proj',
  identity: 'dev@example.com',
  bindAddress: BIND_ADDRESS,
  port: DEFAULT_PORT,
  startedAt: '2026-06-01T00:00:00.000Z',
  lastTraceId: null,
  version: '0.6.0',
  nodeVersion: 'v20.0.0',
};

const mockAuth = {
  getAccessToken: async () => 'fake-palette-token',
  getCredentials: async () => ({ client_email: 'svc@palette.test' }),
};

let server: RunningServer;

test.beforeAll(async () => {
  server = await start({
    port: DEFAULT_PORT,
    logger: createLogger({ level: 'silent' }),
    clientDir: 'dist/client',
    getSession: async (traceId) => SessionSchema.parse({ ...session, lastTraceId: traceId }),
    auth: mockAuth,
    createPubSubClient: createInMemoryPubSubClient(),
  });
});

test.afterAll(async () => {
  await server.close();
});

test('⌘K opens the palette; Esc closes it', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Meta+k');
  await expect(page.getByTestId('command-palette')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('command-palette')).toBeHidden();
});

test('the header ⌘K affordance also opens the palette', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('command-palette-trigger').click();
  await expect(page.getByTestId('command-palette')).toBeVisible();
});

test('filtering and Enter activate a topic (navigation-only)', async ({ page }) => {
  await page.goto('/');

  // Enter a project so the palette includes its topics/subscriptions.
  await page.getByTestId('project-item-e2e-proj').click();
  await expect(page.getByTestId('topic-search')).toBeVisible();

  await page.getByTestId('command-palette-trigger').click();
  const input = page.getByTestId('command-palette-input');
  await input.fill('demo');

  // First matching row is a topic; activate it.
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('command-palette')).toBeHidden();

  // The context breadcrumb now reflects the selected topic.
  await expect(page.getByRole('status', { name: 'Active context' })).toContainText('demo');
});
