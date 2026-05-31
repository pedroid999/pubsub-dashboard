import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildServer } from '../../src/server/server.js';
import { createLogger } from '../../src/server/middleware/trace.js';
import type { Session } from '../../src/server/schemas/session.js';
import {
  TopicsResponseSchema,
  SubscriptionsResponseSchema,
  PubSubErrorSchema,
} from '../../src/server/schemas/pubsub.js';

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

function makeAuth() {
  return {
    getAccessToken: vi.fn().mockResolvedValue('fake-token'),
    getCredentials: vi.fn().mockResolvedValue({ client_email: 'svc@example.com' }),
  };
}

function makePubSubClient(overrides: Partial<{
  getTopics: () => Promise<unknown[]>;
  getSubscriptions: () => Promise<unknown[]>;
}> = {}) {
  return {
    getTopics: vi.fn().mockResolvedValue([
      [
        { name: 'projects/my-proj/topics/payments' },
        { name: 'projects/my-proj/topics/orders' },
        { name: 'projects/my-proj/topics/inventory' },
      ],
    ]),
    getSubscriptions: vi.fn().mockResolvedValue([
      [
        {
          name: 'projects/my-proj/subscriptions/payments-sub',
          metadata: { topic: 'projects/my-proj/topics/payments', pushConfig: {} },
        },
        {
          name: 'projects/my-proj/subscriptions/push-sub',
          metadata: {
            topic: 'projects/my-proj/topics/orders',
            pushConfig: { pushEndpoint: 'https://example.com/push' },
          },
        },
      ],
    ]),
    ...overrides,
  };
}

describe('GET /api/projects/:projectId/topics', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('returns 200 with topics matching schema (T017)', async () => {
    const client = makePubSubClient();
    const app = buildServer({
      logger,
      port: 0,
      clientDir: 'tests/fixtures/client',
      getSession: async () => session,
      auth: makeAuth(),
      createPubSubClient: () => client,
    });

    const res = await app.request('/api/projects/my-proj/topics', {
      headers: { host: '127.0.0.1' },
    });

    expect(res.status).toBe(200);
    const body: unknown = await res.json();
    const parsed = TopicsResponseSchema.safeParse(body);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.topics).toHaveLength(3);
      expect(parsed.data.topics[0]?.displayName).toBe('payments');
      expect(parsed.data.topics[0]?.name).toBe('projects/my-proj/topics/payments');
    }
  });

  it('includes traceId matching x-trace-id header (T017)', async () => {
    const client = makePubSubClient();
    const app = buildServer({
      logger,
      port: 0,
      clientDir: 'tests/fixtures/client',
      getSession: async () => session,
      auth: makeAuth(),
      createPubSubClient: () => client,
    });

    const res = await app.request('/api/projects/my-proj/topics', {
      headers: { host: '127.0.0.1' },
    });
    const headerTraceId = res.headers.get('x-trace-id');
    const body = (await res.json()) as { traceId?: string };
    expect(body.traceId).toBe(headerTraceId);
  });
});

describe('GET /api/projects/:projectId/subscriptions', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('returns 200 with subscriptions matching schema (T018)', async () => {
    const client = makePubSubClient();
    const app = buildServer({
      logger,
      port: 0,
      clientDir: 'tests/fixtures/client',
      getSession: async () => session,
      auth: makeAuth(),
      createPubSubClient: () => client,
    });

    const res = await app.request('/api/projects/my-proj/subscriptions', {
      headers: { host: '127.0.0.1' },
    });

    expect(res.status).toBe(200);
    const body: unknown = await res.json();
    const parsed = SubscriptionsResponseSchema.safeParse(body);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.subscriptions).toHaveLength(2);
      const pull = parsed.data.subscriptions.find((s) => s.name.includes('payments-sub'));
      const push = parsed.data.subscriptions.find((s) => s.name.includes('push-sub'));
      expect(pull?.deliveryType).toBe('pull');
      expect(push?.deliveryType).toBe('push');
    }
  });

  it('passes through _deleted-topic_ as topicName (T018)', async () => {
    const client = makePubSubClient({
      getSubscriptions: vi.fn().mockResolvedValue([
        [
          {
            name: 'projects/my-proj/subscriptions/orphan-sub',
            metadata: { topic: '_deleted-topic_', pushConfig: {} },
          },
        ],
      ]),
    });
    const app = buildServer({
      logger,
      port: 0,
      clientDir: 'tests/fixtures/client',
      getSession: async () => session,
      auth: makeAuth(),
      createPubSubClient: () => client,
    });

    const res = await app.request('/api/projects/my-proj/subscriptions', {
      headers: { host: '127.0.0.1' },
    });
    const body = (await res.json()) as { subscriptions: Array<{ topicName: string }> };
    expect(body.subscriptions[0]?.topicName).toBe('_deleted-topic_');
  });

  it('traceId in response body matches x-trace-id header (T032)', async () => {
    const client = makePubSubClient();
    const app = buildServer({
      logger,
      port: 0,
      clientDir: 'tests/fixtures/client',
      getSession: async () => session,
      auth: makeAuth(),
      createPubSubClient: () => client,
    });

    const res = await app.request('/api/projects/my-proj/subscriptions', {
      headers: { host: '127.0.0.1' },
    });

    expect(res.status).toBe(200);
    const traceHeader = res.headers.get('x-trace-id');
    const body = (await res.json()) as { traceId: string };
    expect(body.traceId).toMatch(/^[0-9a-f-]{36}$/);
    expect(body.traceId).toBe(traceHeader);
  });
});

describe('Error paths for pubsub routes (T019)', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('returns 400 INVALID_QUERY for empty projectId on topics', async () => {
    const client = makePubSubClient();
    const app = buildServer({
      logger,
      port: 0,
      clientDir: 'tests/fixtures/client',
      getSession: async () => session,
      auth: makeAuth(),
      createPubSubClient: () => client,
    });

    const res = await app.request('/api/projects/%20/topics', {
      headers: { host: '127.0.0.1' },
    });
    expect(res.status).toBe(400);
    const body: unknown = await res.json();
    const parsed = PubSubErrorSchema.safeParse(body);
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.code).toBe('INVALID_QUERY');
  });

  it('returns 401 PERMISSION_DENIED on gRPC code 7 (T019)', async () => {
    const grpcError = Object.assign(new Error('PERMISSION_DENIED'), { code: 7 });
    const client = makePubSubClient({
      getTopics: vi.fn().mockRejectedValue(grpcError),
    });
    const app = buildServer({
      logger,
      port: 0,
      clientDir: 'tests/fixtures/client',
      getSession: async () => session,
      auth: makeAuth(),
      createPubSubClient: () => client,
    });

    const res = await app.request('/api/projects/my-proj/topics', {
      headers: { host: '127.0.0.1' },
    });
    expect(res.status).toBe(401);
    const body: unknown = await res.json();
    const parsed = PubSubErrorSchema.safeParse(body);
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.code).toBe('PERMISSION_DENIED');
  });

  it('returns 429 QUOTA_EXCEEDED on gRPC code 8 with quotaName (T019)', async () => {
    const grpcError = Object.assign(new Error('RESOURCE_EXHAUSTED'), {
      code: 8,
      metadata: { get: (k: string) => (k === 'quota_metric' ? ['pubsub.googleapis.com/quota/consumer/read'] : []) },
    });
    const client = makePubSubClient({
      getTopics: vi.fn().mockRejectedValue(grpcError),
    });
    const app = buildServer({
      logger,
      port: 0,
      clientDir: 'tests/fixtures/client',
      getSession: async () => session,
      auth: makeAuth(),
      createPubSubClient: () => client,
    });

    const res = await app.request('/api/projects/my-proj/topics', {
      headers: { host: '127.0.0.1' },
    });
    expect(res.status).toBe(429);
    const body: unknown = await res.json();
    const parsed = PubSubErrorSchema.safeParse(body);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.code).toBe('QUOTA_EXCEEDED');
      expect(parsed.data.quotaName).toBe('pubsub.googleapis.com/quota/consumer/read');
    }
  });

  it('returns 400 INVALID_QUERY for blank projectId on subscriptions (T019)', async () => {
    const client = makePubSubClient();
    const app = buildServer({
      logger,
      port: 0,
      clientDir: 'tests/fixtures/client',
      getSession: async () => session,
      auth: makeAuth(),
      createPubSubClient: () => client,
    });

    const res = await app.request('/api/projects/%20/subscriptions', {
      headers: { host: '127.0.0.1' },
    });
    expect(res.status).toBe(400);
    const body: unknown = await res.json();
    const parsed = PubSubErrorSchema.safeParse(body);
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.code).toBe('INVALID_QUERY');
  });

  it('returns 429 QUOTA_EXCEEDED without quotaName when metadata.get is absent (T019)', async () => {
    const grpcError = Object.assign(new Error('RESOURCE_EXHAUSTED'), { code: 8 });
    const client = makePubSubClient({
      getTopics: vi.fn().mockRejectedValue(grpcError),
    });
    const app = buildServer({
      logger,
      port: 0,
      clientDir: 'tests/fixtures/client',
      getSession: async () => session,
      auth: makeAuth(),
      createPubSubClient: () => client,
    });

    const res = await app.request('/api/projects/my-proj/topics', {
      headers: { host: '127.0.0.1' },
    });
    expect(res.status).toBe(429);
    const body: unknown = await res.json();
    const parsed = PubSubErrorSchema.safeParse(body);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.code).toBe('QUOTA_EXCEEDED');
      expect(parsed.data.quotaName).toBeUndefined();
    }
  });

  it('returns 401 PERMISSION_DENIED from getSubscriptions (T019)', async () => {
    const client = makePubSubClient({
      getSubscriptions: vi.fn().mockRejectedValue(Object.assign(new Error('PERMISSION_DENIED'), { code: 7 })),
    });
    const app = buildServer({
      logger,
      port: 0,
      clientDir: 'tests/fixtures/client',
      getSession: async () => session,
      auth: makeAuth(),
      createPubSubClient: () => client,
    });

    const res = await app.request('/api/projects/my-proj/subscriptions', {
      headers: { host: '127.0.0.1' },
    });
    expect(res.status).toBe(401);
    const body: unknown = await res.json();
    const parsed = PubSubErrorSchema.safeParse(body);
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.code).toBe('PERMISSION_DENIED');
  });

  it('returns 500 INTERNAL_ERROR on unexpected pubsub error (T019)', async () => {
    const client = makePubSubClient({
      getTopics: vi.fn().mockRejectedValue(new Error('Unexpected failure')),
    });
    const app = buildServer({
      logger,
      port: 0,
      clientDir: 'tests/fixtures/client',
      getSession: async () => session,
      auth: makeAuth(),
      createPubSubClient: () => client,
    });

    const res = await app.request('/api/projects/my-proj/topics', {
      headers: { host: '127.0.0.1' },
    });
    expect(res.status).toBe(500);
    const body: unknown = await res.json();
    const parsed = PubSubErrorSchema.safeParse(body);
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.code).toBe('INTERNAL_ERROR');
  });

  it('returns 504 TIMEOUT on AbortError (T019)', async () => {
    const abortErr = Object.assign(new Error('Aborted'), { name: 'AbortError' });
    const client = makePubSubClient({
      getTopics: vi.fn().mockRejectedValue(abortErr),
    });
    const app = buildServer({
      logger,
      port: 0,
      clientDir: 'tests/fixtures/client',
      getSession: async () => session,
      auth: makeAuth(),
      createPubSubClient: () => client,
    });

    const res = await app.request('/api/projects/my-proj/topics', {
      headers: { host: '127.0.0.1' },
    });
    expect(res.status).toBe(504);
    const body: unknown = await res.json();
    const parsed = PubSubErrorSchema.safeParse(body);
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.code).toBe('TIMEOUT');
  });
});
