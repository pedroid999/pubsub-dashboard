import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildServer } from '../../src/server/server.js';
import { createLogger } from '../../src/server/middleware/trace.js';
import type { Session } from '../../src/server/schemas/session.js';
import { ProjectsResponseSchema, PubSubErrorSchema } from '../../src/server/schemas/pubsub.js';

const logger = createLogger({ level: 'silent' });

const session: Session = {
  projectId: 'test-project',
  identity: 'dev@example.com',
  bindAddress: '127.0.0.1',
  port: 0,
  startedAt: '2026-05-31T00:00:00.000Z',
  lastTraceId: null,
  version: '0.1.0',
  nodeVersion: 'v20.0.0',
};

function makeAuth(tokenValue = 'fake-token') {
  return {
    getAccessToken: vi.fn().mockResolvedValue(tokenValue),
    getCredentials: vi.fn().mockResolvedValue({ client_email: 'svc@example.com' }),
  };
}

const CRM_URL = 'https://cloudresourcemanager.googleapis.com/v3/projects';

describe('GET /api/projects', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns 200 with projects array matching schema (T010)', async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          projects: [
            { projectId: 'my-project-1', displayName: 'My Project 1', state: 'ACTIVE' },
            { projectId: 'my-project-2', displayName: 'My Project 2', state: 'ACTIVE' },
          ],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );

    const app = buildServer({
      logger,
      port: 0,
      clientDir: 'tests/fixtures/client',
      getSession: async () => session,
      auth: makeAuth(),
      fetchImpl: mockFetch,
    });

    const res = await app.request('/api/projects', {
      headers: { host: '127.0.0.1' },
    });

    expect(res.status).toBe(200);
    const body: unknown = await res.json();
    const parsed = ProjectsResponseSchema.safeParse(body);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.projects).toHaveLength(2);
      expect(parsed.data.projects[0]?.projectId).toBe('my-project-1');
    }
  });

  it('includes traceId in response body and x-trace-id header (T010)', async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify({ projects: [] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const app = buildServer({
      logger,
      port: 0,
      clientDir: 'tests/fixtures/client',
      getSession: async () => session,
      auth: makeAuth(),
      fetchImpl: mockFetch,
    });

    const res = await app.request('/api/projects', {
      headers: { host: '127.0.0.1' },
    });

    const headerTraceId = res.headers.get('x-trace-id');
    expect(headerTraceId).toBeTruthy();
    const body = (await res.json()) as { traceId?: string };
    expect(body.traceId).toBe(headerTraceId);
  });

  it('returns 401 PERMISSION_DENIED when CRM responds 403 (T011)', async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          error: { code: 403, message: 'The caller does not have permission' },
        }),
        { status: 403, headers: { 'content-type': 'application/json' } },
      ),
    );

    const app = buildServer({
      logger,
      port: 0,
      clientDir: 'tests/fixtures/client',
      getSession: async () => session,
      auth: makeAuth(),
      fetchImpl: mockFetch,
    });

    const res = await app.request('/api/projects', {
      headers: { host: '127.0.0.1' },
    });

    expect(res.status).toBe(401);
    const body: unknown = await res.json();
    const parsed = PubSubErrorSchema.safeParse(body);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.code).toBe('PERMISSION_DENIED');
    }
  });

  it('returns 429 QUOTA_EXCEEDED with quotaName when CRM responds 429 (T011)', async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          error: {
            code: 429,
            message: 'Quota exceeded',
            details: [
              {
                '@type': 'type.googleapis.com/google.rpc.ErrorInfo',
                reason: 'RATE_LIMIT_EXCEEDED',
                metadata: {
                  quota_metric:
                    'cloudresourcemanager.googleapis.com/read_requests_per_minute_per_project',
                },
              },
            ],
          },
        }),
        { status: 429, headers: { 'content-type': 'application/json' } },
      ),
    );

    const app = buildServer({
      logger,
      port: 0,
      clientDir: 'tests/fixtures/client',
      getSession: async () => session,
      auth: makeAuth(),
      fetchImpl: mockFetch,
    });

    const res = await app.request('/api/projects', {
      headers: { host: '127.0.0.1' },
    });

    expect(res.status).toBe(429);
    const body: unknown = await res.json();
    const parsed = PubSubErrorSchema.safeParse(body);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.code).toBe('QUOTA_EXCEEDED');
      expect(parsed.data.quotaName).toBe(
        'cloudresourcemanager.googleapis.com/read_requests_per_minute_per_project',
      );
    }
  });

  it('returns 401 PERMISSION_DENIED when ADC getAccessToken throws', async () => {
    const brokenAuth = {
      getAccessToken: vi.fn().mockRejectedValue(new Error('ADC missing')),
      getCredentials: vi.fn(),
    };
    const app = buildServer({
      logger,
      port: 0,
      clientDir: 'tests/fixtures/client',
      getSession: async () => session,
      auth: brokenAuth,
    });

    const res = await app.request('/api/projects', {
      headers: { host: '127.0.0.1' },
    });

    expect(res.status).toBe(401);
    const body: unknown = await res.json();
    const parsed = PubSubErrorSchema.safeParse(body);
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.code).toBe('PERMISSION_DENIED');
  });

  it('returns 500 INTERNAL_ERROR when CRM returns HTTP 500 (covers lines 102-103)', async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify({}), { status: 500 }),
    );
    const app = buildServer({
      logger,
      port: 0,
      clientDir: 'tests/fixtures/client',
      getSession: async () => session,
      auth: makeAuth(),
      fetchImpl: mockFetch,
    });

    const res = await app.request('/api/projects', {
      headers: { host: '127.0.0.1' },
    });

    expect(res.status).toBe(500);
    const body: unknown = await res.json();
    const parsed = PubSubErrorSchema.safeParse(body);
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.code).toBe('INTERNAL_ERROR');
  });

  it('returns 500 INTERNAL_ERROR on unexpected CRM error', async () => {
    const mockFetch = vi.fn().mockRejectedValueOnce(new Error('Network failure'));
    const app = buildServer({
      logger,
      port: 0,
      clientDir: 'tests/fixtures/client',
      getSession: async () => session,
      auth: makeAuth(),
      fetchImpl: mockFetch,
    });

    const res = await app.request('/api/projects', {
      headers: { host: '127.0.0.1' },
    });

    expect(res.status).toBe(500);
    const body: unknown = await res.json();
    const parsed = PubSubErrorSchema.safeParse(body);
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.code).toBe('INTERNAL_ERROR');
  });

  it('returns 504 TIMEOUT when fetch throws a timeout (T011)', async () => {
    const mockFetch = vi.fn().mockRejectedValueOnce(
      Object.assign(new Error('The operation was aborted'), { name: 'AbortError' }),
    );

    const app = buildServer({
      logger,
      port: 0,
      clientDir: 'tests/fixtures/client',
      getSession: async () => session,
      auth: makeAuth(),
      fetchImpl: mockFetch,
    });

    const res = await app.request('/api/projects', {
      headers: { host: '127.0.0.1' },
    });

    expect(res.status).toBe(504);
    const body: unknown = await res.json();
    const parsed = PubSubErrorSchema.safeParse(body);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.code).toBe('TIMEOUT');
    }
  });

  it('returns an independent response on a second call — endpoint is stateless (T030)', async () => {
    const projectList = [
      { projectId: 'proj-a', displayName: 'Project A', state: 'ACTIVE' },
    ];
    const makeOkResponse = () =>
      new Response(
        JSON.stringify({ projects: projectList, nextPageToken: undefined }),
        { status: 200 },
      );

    const mockFetch = vi.fn().mockResolvedValue(makeOkResponse());
    const app = buildServer({
      logger,
      port: 0,
      clientDir: 'tests/fixtures/client',
      getSession: async () => session,
      auth: makeAuth(),
      fetchImpl: mockFetch,
    });

    const res1 = await app.request('/api/projects', { headers: { host: '127.0.0.1' } });
    expect(res1.status).toBe(200);

    mockFetch.mockResolvedValue(makeOkResponse());

    const res2 = await app.request('/api/projects', { headers: { host: '127.0.0.1' } });
    expect(res2.status).toBe(200);

    const body2: unknown = await res2.json();
    const parsed = ProjectsResponseSchema.safeParse(body2);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.projects).toHaveLength(1);
      expect(parsed.data.projects[0].projectId).toBe('proj-a');
    }
  });
});
