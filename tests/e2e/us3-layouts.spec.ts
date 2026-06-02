import { test, expect } from '@playwright/test';
import { start, type RunningServer } from '../../src/server/boot.js';
import { createLogger } from '../../src/server/middleware/trace.js';
import { createInMemoryPubSubClient } from '../../src/server/cli/demoPubSub.js';
import { SessionSchema, type Session } from '../../src/server/schemas/session.js';
import { DEFAULT_PORT, BIND_ADDRESS } from '../../src/shared/port.js';

/**
 * US3 (T028): Rail / Triptych / Console layouts are switchable from the
 * appearance settings, the active selection + compose draft survive every
 * switch (SC-003), and the chosen layout persists across a reload (SC-004).
 * Uses the in-memory demo Pub/Sub seam so the project has real topics.
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
  getAccessToken: async () => 'fake-layouts-token',
  getCredentials: async () => ({ client_email: 'svc@layouts.test' }),
};

// Feed the ProjectBrowser a project to pick (the topics/subs come from the
// in-memory Pub/Sub seam below). Without this, /api/projects hits the real
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

async function selectProjectAndTopic(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/');
  await page.getByTestId('project-item-e2e-proj').click();
  await expect(page.getByTestId('topic-search')).toBeVisible();
  // Select a topic via the palette (navigation-only) so the publisher is live.
  await page.getByTestId('command-palette-trigger').click();
  await page.getByTestId('command-palette-input').fill('demo');
  // Topics load into the palette asynchronously; wait for the topic row before
  // activating it, otherwise Enter fires against a list that only has projects.
  await expect(
    page.locator('[data-testid^="palette-entry-"][data-testid*="/topics/"]').first(),
  ).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('command-palette')).toBeHidden();
}

test('switching layouts preserves selection + draft and persists across reload', async ({
  page,
}) => {
  await selectProjectAndTopic(page);

  // Rail is the default.
  await expect(page.locator('[data-layout="rail"]')).toBeVisible();

  // Type a compose draft.
  const body = page.getByTestId('publish-body');
  await body.fill('{"layout":"survives"}');

  // Rail → Triptych.
  await page.getByTestId('settings-trigger').click();
  await page.getByTestId('layout-triptych').click();
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-layout="triptych"]')).toBeVisible();
  await expect(page.getByTestId('publish-body')).toHaveValue('{"layout":"survives"}');

  // Triptych → Console.
  await page.getByTestId('settings-trigger').click();
  await page.getByTestId('layout-console').click();
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-layout="console"]')).toBeVisible();
  await expect(page.getByTestId('publish-body')).toHaveValue('{"layout":"survives"}');

  // Reload → the active project is in-memory (not persisted, by design), so
  // re-enter it; the Console layout persisted in localStorage and applies
  // immediately (it did NOT revert to the rail default) — this is what SC-004
  // guarantees about layout persistence.
  await page.reload();
  await page.getByTestId('project-item-e2e-proj').click();
  await expect(page.locator('[data-layout="console"]')).toBeVisible();
});

test('triptych presents a tabbed resources panel (FR-011)', async ({ page }) => {
  await selectProjectAndTopic(page);
  await page.getByTestId('settings-trigger').click();
  await page.getByTestId('layout-triptych').click();
  await page.keyboard.press('Escape');

  await expect(page.getByTestId('resource-tab-topics')).toBeVisible();
  await expect(page.getByTestId('resource-tab-subscriptions')).toBeVisible();
  await page.getByTestId('resource-tab-subscriptions').click();
  await expect(page.getByTestId('sub-search')).toBeVisible();
});
