import type { Hono, Context } from 'hono';
import type { AppEnv } from '../app.js';
import type { CreatePubSubClientFn, RawReceivedMessage } from './pubsub.js';
import type { PubSubError } from '../schemas/pubsub.js';
import {
  PublishRequestSchema,
  PullRequestSchema,
  AckRequestSchema,
  type ReceivedMessage,
} from '../schemas/messaging.js';

export interface MessagingDeps {
  createPubSubClient: CreatePubSubClientFn;
}

/** Pub/Sub rejects messages larger than 10 MiB. Guard before hitting the API. */
const MAX_MESSAGE_BYTES = 10 * 1024 * 1024;
const DEFAULT_MAX_MESSAGES = 10;

type Operation = 'publish' | 'consume';

type RawPublishTime = NonNullable<RawReceivedMessage['message']>['publishTime'];

function toIsoPublishTime(publishTime: RawPublishTime): string {
  if (publishTime == null) return new Date(0).toISOString();
  if (typeof publishTime === 'string') {
    const d = new Date(publishTime);
    return Number.isNaN(d.getTime()) ? publishTime : d.toISOString();
  }
  if (publishTime instanceof Date) return publishTime.toISOString();
  const seconds = Number(publishTime.seconds ?? 0);
  const nanos = Number(publishTime.nanos ?? 0);
  return new Date(seconds * 1000 + Math.floor(nanos / 1e6)).toISOString();
}

/** Narrow a raw pull message into the validated ReceivedMessage contract. */
export function narrowReceivedMessage(raw: RawReceivedMessage): ReceivedMessage {
  const message = raw.message ?? {};
  const rawData = message.data ?? '';

  let data: string;
  let dataEncoding: 'utf-8' | 'base64';
  if (typeof rawData === 'string') {
    data = rawData;
    dataEncoding = 'utf-8';
  } else {
    const bytes = Buffer.isBuffer(rawData) ? rawData : Buffer.from(rawData);
    try {
      data = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
      dataEncoding = 'utf-8';
    } catch {
      data = bytes.toString('base64');
      dataEncoding = 'base64';
    }
  }

  return {
    messageId: message.messageId ?? '',
    ackId: raw.ackId ?? '',
    data,
    dataEncoding,
    attributes: message.attributes ?? {},
    publishTime: toIsoPublishTime(message.publishTime),
    deliveryAttempt: typeof raw.deliveryAttempt === 'number' ? raw.deliveryAttempt : null,
  };
}

function permissionMessage(op: Operation): string {
  return op === 'publish'
    ? 'Missing pubsub.topics.publish permission. Grant roles/pubsub.publisher.'
    : 'Missing pubsub.subscriptions.consume permission. Grant roles/pubsub.subscriber.';
}

function extractQuotaName(err: unknown): string | undefined {
  const e = err as { metadata?: { get?: (k: string) => string[] } };
  if (typeof e.metadata?.get === 'function') {
    return e.metadata.get('quota_metric')[0];
  }
  return undefined;
}

/**
 * Map a Pub/Sub SDK error to a JSON {@link PubSubError}. Extends feature 002's
 * mapping with NOT_FOUND (gRPC 5 → 404) and operation-specific permission text.
 */
export function handleMessagingError(
  err: unknown,
  traceId: string,
  c: Context<AppEnv>,
  op: Operation,
) {
  const e = err as { code?: number | string; name?: string };

  if (e.name === 'AbortError') {
    const body: PubSubError = {
      code: 'TIMEOUT',
      message: 'Request to Pub/Sub timed out.',
      traceId,
    };
    return c.json(body, 504);
  }
  if (e.code === 8) {
    const quotaName = extractQuotaName(err);
    const body: PubSubError = {
      code: 'QUOTA_EXCEEDED',
      message: `Pub/Sub quota exceeded${quotaName ? `: ${quotaName}` : ''}.`,
      traceId,
      quotaName,
    };
    return c.json(body, 429);
  }
  if (e.code === 5) {
    const body: PubSubError = {
      code: 'NOT_FOUND',
      message: 'Target Pub/Sub resource no longer exists.',
      traceId,
    };
    return c.json(body, 404);
  }
  if (e.code === 7 || e.code === 16) {
    const body: PubSubError = {
      code: 'PERMISSION_DENIED',
      message: permissionMessage(op),
      traceId,
    };
    return c.json(body, 401);
  }
  const body: PubSubError = {
    code: 'INTERNAL_ERROR',
    message: err instanceof Error ? err.message : 'Unexpected Pub/Sub error.',
    traceId,
  };
  return c.json(body, 500);
}

function invalid(c: Context<AppEnv>, traceId: string, message: string) {
  const body: PubSubError = { code: 'INVALID_QUERY', message, traceId };
  return c.json(body, 400);
}

export function registerMessaging(app: Hono<AppEnv>, deps: MessagingDeps): void {
  // Publish ---------------------------------------------------------------
  app.post('/api/projects/:projectId/topics/:topicId/publish', async (c) => {
    const traceId = c.var.traceId;
    const projectId = c.req.param('projectId').trim();
    const topicId = c.req.param('topicId').trim();
    if (!projectId || !topicId) {
      return invalid(c, traceId, 'projectId and topicId must not be blank.');
    }

    let raw: unknown;
    try {
      raw = await c.req.json();
    } catch {
      return invalid(c, traceId, 'Request body must be valid JSON.');
    }
    const parsed = PublishRequestSchema.safeParse(raw);
    if (!parsed.success) {
      return invalid(c, traceId, parsed.error.issues[0]?.message ?? 'Invalid publish request.');
    }

    const { data, attributes } = parsed.data;
    if (Buffer.byteLength(data, 'utf-8') > MAX_MESSAGE_BYTES) {
      const body: PubSubError = {
        code: 'PAYLOAD_TOO_LARGE',
        message: 'Message body exceeds the 10 MiB Pub/Sub per-message limit.',
        traceId,
      };
      return c.json(body, 400);
    }

    const client = deps.createPubSubClient(projectId);
    try {
      const messageId = await client.publish(topicId, Buffer.from(data, 'utf-8'), attributes ?? {});
      c.var.logger.info({ op: 'publish', topic: topicId, traceId }, 'published message to topic');
      return c.json({ messageId, traceId });
    } catch (err) {
      return handleMessagingError(err, traceId, c, 'publish');
    }
  });

  // Pull ------------------------------------------------------------------
  app.post('/api/projects/:projectId/subscriptions/:subscriptionId/pull', async (c) => {
    const traceId = c.var.traceId;
    const projectId = c.req.param('projectId').trim();
    const subscriptionId = c.req.param('subscriptionId').trim();
    if (!projectId || !subscriptionId) {
      return invalid(c, traceId, 'projectId and subscriptionId must not be blank.');
    }

    let raw: unknown = {};
    try {
      const text = await c.req.text();
      raw = text ? JSON.parse(text) : {};
    } catch {
      return invalid(c, traceId, 'Request body must be valid JSON.');
    }
    const parsed = PullRequestSchema.safeParse(raw);
    if (!parsed.success) {
      return invalid(c, traceId, 'maxMessages must be an integer between 1 and 10.');
    }
    const maxMessages = parsed.data.maxMessages ?? DEFAULT_MAX_MESSAGES;

    const client = deps.createPubSubClient(projectId);
    try {
      const rawMessages = await client.pull(subscriptionId, maxMessages);
      const messages = rawMessages.map(narrowReceivedMessage);
      c.var.logger.info(
        { op: 'pull', subscription: subscriptionId, count: messages.length, traceId },
        'pulled messages from subscription',
      );
      return c.json({ messages, traceId });
    } catch (err) {
      return handleMessagingError(err, traceId, c, 'consume');
    }
  });

  // Acknowledge -----------------------------------------------------------
  app.post('/api/projects/:projectId/subscriptions/:subscriptionId/ack', async (c) => {
    const traceId = c.var.traceId;
    const projectId = c.req.param('projectId').trim();
    const subscriptionId = c.req.param('subscriptionId').trim();
    if (!projectId || !subscriptionId) {
      return invalid(c, traceId, 'projectId and subscriptionId must not be blank.');
    }

    let raw: unknown;
    try {
      raw = await c.req.json();
    } catch {
      return invalid(c, traceId, 'Request body must be valid JSON.');
    }
    const parsed = AckRequestSchema.safeParse(raw);
    if (!parsed.success) {
      return invalid(c, traceId, parsed.error.issues[0]?.message ?? 'Invalid ack request.');
    }

    const client = deps.createPubSubClient(projectId);
    try {
      await client.acknowledge(subscriptionId, parsed.data.ackIds);
      c.var.logger.info(
        { op: 'ack', subscription: subscriptionId, count: parsed.data.ackIds.length, traceId },
        'acknowledged messages',
      );
      return c.json({ acknowledged: parsed.data.ackIds, expired: [], traceId });
    } catch (err) {
      const e = err as { code?: number | string };
      // gRPC INVALID_ARGUMENT (3) on ack typically means the ackId deadline has
      // expired — non-fatal: tell the client to pull again (FR-020).
      if (e.code === 3) {
        return c.json({ acknowledged: [], expired: parsed.data.ackIds, traceId });
      }
      return handleMessagingError(err, traceId, c, 'consume');
    }
  });
}
