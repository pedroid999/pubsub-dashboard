import { test, expect } from '@playwright/test';
import { start, type RunningServer } from '../../src/server/boot.js';
import { createLogger } from '../../src/server/middleware/trace.js';
import { createInMemoryPubSubClient } from '../../src/server/cli/demoPubSub.js';
import { PublishResponseSchema, PullResponseSchema } from '../../src/server/schemas/messaging.js';
import type { Session } from '../../src/server/schemas/session.js';
import { DEFAULT_PORT, BIND_ADDRESS } from '../../src/shared/port.js';

const session: Session = {
  projectId: 'e2e-proj',
  identity: 'dev@example.com',
  bindAddress: BIND_ADDRESS,
  port: DEFAULT_PORT,
  startedAt: '2026-05-31T00:00:00.000Z',
  lastTraceId: null,
  version: '0.1.0',
  nodeVersion: 'v20.18.0',
};

const mockAuth = {
  getAccessToken: async () => 'fake-e2e-token',
  getCredentials: async () => ({ client_email: 'svc@e2e.test' }),
};

let server: RunningServer;

test.beforeAll(async () => {
  server = await start({
    port: 0,
    logger: createLogger({ level: 'silent' }),
    clientDir: 'tests/fixtures/client',
    getSession: async (traceId) => ({ ...session, lastTraceId: traceId }),
    auth: mockAuth,
    // In-memory demo seam: a real publish→pull round-trip without GCP creds
    // (constitution Principle II — "at least one publish/subscribe round-trip").
    createPubSubClient: createInMemoryPubSubClient(),
  });
});

test.afterAll(async () => {
  await server.close();
});

test('publish → pull round-trip preserves body and attributes (T042)', async ({ request }) => {
  const body = '{"orderId":42,"status":"paid"}';
  const attributes = { eventType: 'order.paid', source: 'checkout' };

  // Publish to the active topic.
  const publishRes = await request.post(
    `${server.url}/api/projects/e2e-proj/topics/demo-topic/publish`,
    { data: { data: body, attributes } },
  );
  expect(publishRes.status()).toBe(200);
  const publishBody = PublishResponseSchema.parse(await publishRes.json());
  expect(publishBody.messageId).toBeTruthy();

  // Pull it back from a subscription on that topic.
  const pullRes = await request.post(
    `${server.url}/api/projects/e2e-proj/subscriptions/demo-sub/pull`,
    { data: { maxMessages: 10 } },
  );
  expect(pullRes.status()).toBe(200);
  const pullBody = PullResponseSchema.parse(await pullRes.json());

  expect(pullBody.messages.length).toBeGreaterThanOrEqual(1);
  const received = pullBody.messages.find((m) => m.messageId === publishBody.messageId);
  expect(received).toBeDefined();
  expect(received?.data).toBe(body);
  expect(received?.attributes).toEqual(attributes);
  expect(received?.dataEncoding).toBe('utf-8');

  // Acknowledge removes it; a subsequent pull no longer returns it.
  const ackRes = await request.post(
    `${server.url}/api/projects/e2e-proj/subscriptions/demo-sub/ack`,
    { data: { ackIds: [received!.ackId] } },
  );
  expect(ackRes.status()).toBe(200);

  const pullAgain = await request.post(
    `${server.url}/api/projects/e2e-proj/subscriptions/demo-sub/pull`,
    { data: { maxMessages: 10 } },
  );
  const pullAgainBody = PullResponseSchema.parse(await pullAgain.json());
  expect(pullAgainBody.messages.find((m) => m.messageId === publishBody.messageId)).toBeUndefined();
});

test('empty pull returns a 200 with no messages (FR-013)', async ({ request }) => {
  const res = await request.post(
    `${server.url}/api/projects/empty-proj/subscriptions/demo-sub/pull`,
    { data: { maxMessages: 10 } },
  );
  expect(res.status()).toBe(200);
  const parsed = PullResponseSchema.parse(await res.json());
  expect(parsed.messages).toEqual([]);
});
