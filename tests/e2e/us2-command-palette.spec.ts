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

// Feed the ProjectBrowser a project to pick (topics/subs come from the in-memory
// Pub/Sub seam below). Without this, /api/projects hits the real
// cloudresourcemanager and the list is empty, so project-item-e2e-proj never
// renders.
const mockFetch = async (url: string | URL | Request): Promise<Response> => {
  if (String(url).includes('cloudresourcemanager')) {
    return new Response(
      JSON.stringify({
        projects: [{ projectId: 'e2e-proj', displayName: 'E2E Project', state: 'ACTIVE' }],
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    );
  }
  return new Response('{}', { status: 404 });
};

let server: RunningServer;

test.beforeAll(async () => {
  server = await start({
    port: DEFAULT_PORT,
    logger: createLogger({ level: 'silent' }),
    clientDir: 'dist/client',
    getSession: async (traceId) => SessionSchema.parse({ ...session, lastTraceId: traceId }),
    auth: mockAuth,
    fetchImpl: mockFetch,
    createPubSubClient: createInMemoryPubSubClient(),
  });
});

test.afterAll(async () => {
  await server.close();
});

test('⌘K opens the palette; Esc closes it', async ({ page }) => {
  await page.goto('/');
  // ControlOrMeta = Meta on macOS, Control on Linux/Windows. A hardcoded Meta+k
  // is the Super key on Linux CI and never fires the handler (metaKey||ctrlKey).
  await page.keyboard.press('ControlOrMeta+k');
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

  // First matching row is a topic; wait for it to load (topics arrive async)
  // before activating with Enter.
  await expect(
    page.locator('[data-testid^="palette-entry-"][data-testid*="/topics/"]').first(),
  ).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('command-palette')).toBeHidden();

  // The context breadcrumb now reflects the selected topic.
  await expect(page.getByRole('status', { name: 'Active context' })).toContainText('demo');
});
