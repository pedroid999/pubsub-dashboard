import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildServer } from '../../src/server/server.js';
import { createLogger } from '../../src/server/middleware/trace.js';
import type { Session } from '../../src/server/schemas/session.js';
import type { PubSubClientLike, RawReceivedMessage } from '../../src/server/routes/pubsub.js';
import {
  PublishResponseSchema,
  PullResponseSchema,
  AckResponseSchema,
} from '../../src/server/schemas/messaging.js';

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

function makeClient(overrides: Partial<PubSubClientLike> = {}): PubSubClientLike {
  return {
    getTopics: vi.fn().mockResolvedValue([[]]),
    getSubscriptions: vi.fn().mockResolvedValue([[]]),
    publish: vi.fn().mockResolvedValue('10000000000001'),
    pull: vi.fn().mockResolvedValue([]),
    acknowledge: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  } as unknown as PubSubClientLike;
}

function appWith(client: PubSubClientLike) {
  return buildServer({
    logger,
    port: 0,
    clientDir: 'tests/fixtures/client',
    getSession: async () => session,
    auth: makeAuth(),
    createPubSubClient: () => client,
  });
}

function post(app: ReturnType<typeof buildServer>, path: string, body?: unknown) {
  return app.request(path, {
    method: 'POST',
    headers: { host: '127.0.0.1', 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

beforeEach(() => vi.restoreAllMocks());

describe('POST publish (T012)', () => {
  const PATH = '/api/projects/my-proj/topics/orders/publish';

  it('returns 200 with messageId + traceId on success', async () => {
    const client = makeClient();
    const res = await post(appWith(client), PATH, { data: '{"a":1}' });
    expect(res.status).toBe(200);
    const body: unknown = await res.json();
    const parsed = PublishResponseSchema.safeParse(body);
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.messageId).toBe('10000000000001');
    expect(client.publish).toHaveBeenCalledOnce();
  });

  it('rejects an empty body with 400 INVALID_QUERY and does not call publish', async () => {
    const client = makeClient();
    const res = await post(appWith(client), PATH, { data: '' });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe('INVALID_QUERY');
    expect(client.publish).not.toHaveBeenCalled();
  });

  it('rejects an oversized body with 400 PAYLOAD_TOO_LARGE', async () => {
    const client = makeClient();
    const big = 'a'.repeat(10 * 1024 * 1024 + 1);
    const res = await post(appWith(client), PATH, { data: big });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe('PAYLOAD_TOO_LARGE');
    expect(client.publish).not.toHaveBeenCalled();
  });

  it('maps permission errors to 401 naming pubsub.topics.publish', async () => {
    const client = makeClient({
      publish: vi.fn().mockRejectedValue(Object.assign(new Error('denied'), { code: 7 })),
    });
    const res = await post(appWith(client), PATH, { data: 'x' });
    expect(res.status).toBe(401);
    const body = (await res.json()) as { code: string; message: string };
    expect(body.code).toBe('PERMISSION_DENIED');
    expect(body.message).toContain('pubsub.topics.publish');
  });

  it('maps quota errors to 429 with quotaName', async () => {
    const grpc = Object.assign(new Error('exhausted'), {
      code: 8,
      metadata: { get: (k: string) => (k === 'quota_metric' ? ['pubsub.googleapis.com/x'] : []) },
    });
    const client = makeClient({ publish: vi.fn().mockRejectedValue(grpc) });
    const res = await post(appWith(client), PATH, { data: 'x' });
    expect(res.status).toBe(429);
    const body = (await res.json()) as { code: string; quotaName?: string };
    expect(body.code).toBe('QUOTA_EXCEEDED');
    expect(body.quotaName).toBe('pubsub.googleapis.com/x');
  });

  it('maps AbortError to 504 TIMEOUT', async () => {
    const client = makeClient({
      publish: vi.fn().mockRejectedValue(Object.assign(new Error('a'), { name: 'AbortError' })),
    });
    const res = await post(appWith(client), PATH, { data: 'x' });
    expect(res.status).toBe(504);
  });

  it('maps NOT_FOUND (gRPC code 5) to 404 (topic deleted before publish)', async () => {
    const client = makeClient({
      publish: vi.fn().mockRejectedValue(Object.assign(new Error('gone'), { code: 5 })),
    });
    const res = await post(appWith(client), PATH, { data: 'x' });
    expect(res.status).toBe(404);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe('NOT_FOUND');
  });

  it('rejects a blank topicId with 400', async () => {
    const client = makeClient();
    const res = await post(appWith(client), '/api/projects/my-proj/topics/%20/publish', {
      data: 'x',
    });
    expect(res.status).toBe(400);
    expect(client.publish).not.toHaveBeenCalled();
  });

  it('rejects a non-JSON publish body with 400', async () => {
    const client = makeClient();
    const res = await appWith(client).request('/api/projects/my-proj/topics/orders/publish', {
      method: 'POST',
      headers: { host: '127.0.0.1', 'content-type': 'application/json' },
      body: 'not json',
    });
    expect(res.status).toBe(400);
  });

  it('maps a non-Error rejection to 500 INTERNAL_ERROR', async () => {
    const client = makeClient({ publish: vi.fn().mockRejectedValue('boom') });
    const res = await post(appWith(client), PATH, { data: 'x' });
    expect(res.status).toBe(500);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe('INTERNAL_ERROR');
  });

  it('forwards attributes to publish and rejects an empty attribute value (T030)', async () => {
    const client = makeClient();
    const ok = await post(appWith(client), PATH, {
      data: 'x',
      attributes: { eventType: 'order.paid' },
    });
    expect(ok.status).toBe(200);
    expect(client.publish).toHaveBeenCalledWith('orders', expect.any(Buffer), {
      eventType: 'order.paid',
    });

    const client2 = makeClient();
    const bad = await post(appWith(client2), PATH, { data: 'x', attributes: { k: '' } });
    expect(bad.status).toBe(400);
    expect(client2.publish).not.toHaveBeenCalled();
  });
});

describe('POST pull (T019)', () => {
  const PATH = '/api/projects/my-proj/subscriptions/orders-sub/pull';

  function rawMsg(over: Partial<RawReceivedMessage['message']> = {}): RawReceivedMessage {
    return {
      ackId: 'ack-1',
      deliveryAttempt: 1,
      message: {
        messageId: 'm1',
        data: Buffer.from('{"k":1}', 'utf-8'),
        attributes: { eventType: 'x' },
        publishTime: { seconds: 1717000000, nanos: 0 },
        ...over,
      },
    };
  }

  it('returns up to 10 messages with utf-8 data', async () => {
    const client = makeClient({ pull: vi.fn().mockResolvedValue([rawMsg()]) });
    const res = await post(appWith(client), PATH, { maxMessages: 10 });
    expect(res.status).toBe(200);
    const body: unknown = await res.json();
    const parsed = PullResponseSchema.safeParse(body);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.messages[0]?.dataEncoding).toBe('utf-8');
      expect(parsed.data.messages[0]?.data).toBe('{"k":1}');
      expect(parsed.data.messages[0]?.attributes).toEqual({ eventType: 'x' });
    }
  });

  it('returns base64 dataEncoding for non-UTF-8 payloads', async () => {
    const client = makeClient({
      pull: vi.fn().mockResolvedValue([rawMsg({ data: Buffer.from([0xff, 0xfe, 0xfd]) })]),
    });
    const res = await post(appWith(client), PATH, {});
    const body = (await res.json()) as { messages: Array<{ dataEncoding: string }> };
    expect(body.messages[0]?.dataEncoding).toBe('base64');
  });

  it('returns 200 with an empty array when nothing is available', async () => {
    const client = makeClient({ pull: vi.fn().mockResolvedValue([]) });
    const res = await post(appWith(client), PATH, {});
    expect(res.status).toBe(200);
    const body = (await res.json()) as { messages: unknown[] };
    expect(body.messages).toEqual([]);
  });

  it('rejects maxMessages outside 1..10 with 400', async () => {
    const client = makeClient();
    const res = await post(appWith(client), PATH, { maxMessages: 50 });
    expect(res.status).toBe(400);
    expect(client.pull).not.toHaveBeenCalled();
  });

  it('maps permission errors to 401 naming pubsub.subscriptions.consume', async () => {
    const client = makeClient({
      pull: vi.fn().mockRejectedValue(Object.assign(new Error('denied'), { code: 7 })),
    });
    const res = await post(appWith(client), PATH, {});
    expect(res.status).toBe(401);
    const body = (await res.json()) as { message: string };
    expect(body.message).toContain('pubsub.subscriptions.consume');
  });

  it('maps quota errors to 429', async () => {
    const client = makeClient({
      pull: vi.fn().mockRejectedValue(Object.assign(new Error('x'), { code: 8 })),
    });
    const res = await post(appWith(client), PATH, {});
    expect(res.status).toBe(429);
  });

  it('rejects a blank subscriptionId with 400', async () => {
    const client = makeClient();
    const res = await post(appWith(client), '/api/projects/my-proj/subscriptions/%20/pull', {});
    expect(res.status).toBe(400);
    expect(client.pull).not.toHaveBeenCalled();
  });

  it('defaults maxMessages to 10 when the body is empty', async () => {
    const client = makeClient({ pull: vi.fn().mockResolvedValue([]) });
    const res = await appWith(client).request(PATH, {
      method: 'POST',
      headers: { host: '127.0.0.1' },
    });
    expect(res.status).toBe(200);
    expect(client.pull).toHaveBeenCalledWith('orders-sub', 10);
  });

  it('rejects a non-JSON pull body with 400', async () => {
    const client = makeClient();
    const res = await appWith(client).request(PATH, {
      method: 'POST',
      headers: { host: '127.0.0.1', 'content-type': 'application/json' },
      body: '{bad',
    });
    expect(res.status).toBe(400);
  });

  it('maps gRPC code 16 (unauthenticated) to 401', async () => {
    const client = makeClient({
      pull: vi.fn().mockRejectedValue(Object.assign(new Error('unauth'), { code: 16 })),
    });
    const res = await post(appWith(client), PATH, {});
    expect(res.status).toBe(401);
  });
});

describe('POST ack (T034)', () => {
  const PATH = '/api/projects/my-proj/subscriptions/orders-sub/ack';

  it('returns acknowledged + empty expired on success', async () => {
    const client = makeClient();
    const res = await post(appWith(client), PATH, { ackIds: ['ack-1', 'ack-2'] });
    expect(res.status).toBe(200);
    const body: unknown = await res.json();
    const parsed = AckResponseSchema.safeParse(body);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.acknowledged).toEqual(['ack-1', 'ack-2']);
      expect(parsed.data.expired).toEqual([]);
    }
    expect(client.acknowledge).toHaveBeenCalledWith('orders-sub', ['ack-1', 'ack-2']);
  });

  it('rejects an empty ackIds array with 400', async () => {
    const client = makeClient();
    const res = await post(appWith(client), PATH, { ackIds: [] });
    expect(res.status).toBe(400);
    expect(client.acknowledge).not.toHaveBeenCalled();
  });

  it('classifies an expired ack (gRPC code 3) into expired, non-fatally', async () => {
    const client = makeClient({
      acknowledge: vi.fn().mockRejectedValue(Object.assign(new Error('expired'), { code: 3 })),
    });
    const res = await post(appWith(client), PATH, { ackIds: ['ack-old'] });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { acknowledged: string[]; expired: string[] };
    expect(body.acknowledged).toEqual([]);
    expect(body.expired).toEqual(['ack-old']);
  });

  it('maps permission errors to 401', async () => {
    const client = makeClient({
      acknowledge: vi.fn().mockRejectedValue(Object.assign(new Error('denied'), { code: 7 })),
    });
    const res = await post(appWith(client), PATH, { ackIds: ['ack-1'] });
    expect(res.status).toBe(401);
  });

  it('rejects a blank subscriptionId with 400', async () => {
    const client = makeClient();
    const res = await post(appWith(client), '/api/projects/my-proj/subscriptions/%20/ack', {
      ackIds: ['a'],
    });
    expect(res.status).toBe(400);
    expect(client.acknowledge).not.toHaveBeenCalled();
  });

  it('rejects a non-JSON ack body with 400', async () => {
    const client = makeClient();
    const res = await appWith(client).request(PATH, {
      method: 'POST',
      headers: { host: '127.0.0.1', 'content-type': 'application/json' },
      body: 'oops',
    });
    expect(res.status).toBe(400);
  });
});
