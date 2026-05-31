import { test, expect } from '@playwright/test';
import { start, type RunningServer } from '../../src/server/boot.js';
import { createLogger } from '../../src/server/middleware/trace.js';
import { SessionSchema, type Session } from '../../src/server/schemas/session.js';
import { HealthResponseSchema } from '../../src/server/schemas/health.js';
import { ProjectsResponseSchema } from '../../src/server/schemas/pubsub.js';
import { DEFAULT_PORT, BIND_ADDRESS } from '../../src/shared/port.js';

const session: Session = {
  projectId: 'my-cool-project',
  identity: 'dev@example.com',
  bindAddress: BIND_ADDRESS,
  port: DEFAULT_PORT,
  startedAt: '2026-05-29T20:00:00.000Z',
  lastTraceId: null,
  version: '0.1.0',
  nodeVersion: 'v20.18.0',
};

let server: RunningServer;

const mockAuth = {
  getAccessToken: async () => 'fake-e2e-token',
  getCredentials: async () => ({ client_email: 'svc@e2e.test' }),
};

const mockFetch = async (url: string | URL | Request): Promise<Response> => {
  const urlStr = String(url);
  if (urlStr.includes('cloudresourcemanager')) {
    return new Response(
      JSON.stringify({
        projects: [{ projectId: 'e2e-proj', displayName: 'E2E Project', state: 'ACTIVE' }],
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    );
  }
  return new Response('{}', { status: 404 });
};

test.beforeAll(async () => {
  server = await start({
    port: 0,
    logger: createLogger({ level: 'silent' }),
    clientDir: 'tests/fixtures/client',
    getSession: async (traceId) => ({ ...session, lastTraceId: traceId }),
    auth: mockAuth,
    fetchImpl: mockFetch,
  });
});

test.afterAll(async () => {
  await server.close();
});

test('US1 cold-boot exposes a healthy, loopback-bound, authenticated session', async ({
  request,
}) => {
  expect(server.url).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);

  const health = await request.get(`${server.url}/api/health`);
  expect(health.status()).toBe(200);
  expect(health.headers()['x-trace-id']).toMatch(/^[0-9a-f-]{36}$/);
  const healthBody = await health.json();
  expect(() => HealthResponseSchema.parse(healthBody)).not.toThrow();

  const sessionRes = await request.get(`${server.url}/api/session`);
  expect(sessionRes.status()).toBe(200);
  expect(sessionRes.headers()['x-trace-id']).toMatch(/^[0-9a-f-]{36}$/);
  const body = SessionSchema.parse(await sessionRes.json());
  expect(body.bindAddress).toBe('127.0.0.1');
  expect(body.projectId).toBe('my-cool-project');
  expect(body.identity).toBe('dev@example.com');
  expect(body.lastTraceId).toBe(sessionRes.headers()['x-trace-id']);

  // SPA shell is served at the root.
  const root = await request.get(`${server.url}/`);
  expect(root.status()).toBe(200);
  expect(root.headers()['content-type']).toContain('text/html');
});

test('GET /api/projects returns 200 with a schema-valid projects list (T031)', async ({
  request,
}) => {
  const res = await request.get(`${server.url}/api/projects`);

  expect(res.status()).toBe(200);
  expect(res.headers()['x-trace-id']).toMatch(/^[0-9a-f-]{36}$/);

  const body: unknown = await res.json();
  const parsed = ProjectsResponseSchema.safeParse(body);
  expect(parsed.success).toBe(true);
  if (parsed.success) {
    expect(parsed.data.projects.length).toBeGreaterThanOrEqual(1);
    expect(parsed.data.projects[0].projectId).toBe('e2e-proj');
    expect(parsed.data.traceId).toBe(res.headers()['x-trace-id']);
  }
});
