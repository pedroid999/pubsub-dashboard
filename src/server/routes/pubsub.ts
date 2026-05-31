import type { Hono, Context } from 'hono';
import type { AppEnv } from '../app.js';
import type { Topic, Subscription, PubSubError } from '../schemas/pubsub.js';

/**
 * Raw shape of a single message returned by a synchronous pull. Mirrors the
 * `@google-cloud/pubsub` `v1.SubscriberClient.pull` result at the
 * external boundary; narrowed into `ReceivedMessage` by the messaging route.
 */
export interface RawReceivedMessage {
  ackId?: string | null;
  deliveryAttempt?: number | null;
  message?: {
    messageId?: string | null;
    data?: Uint8Array | Buffer | string | null;
    attributes?: Record<string, string> | null;
    publishTime?:
      | { seconds?: number | string | null; nanos?: number | null }
      | string
      | Date
      | null;
  } | null;
}

export interface PubSubClientLike {
  getTopics(): Promise<[Array<{ name: string }>, ...unknown[]]>;
  getSubscriptions(): Promise<
    [
      Array<{
        name: string;
        metadata?: {
          topic?: string | null;
          pushConfig?: { pushEndpoint?: string | null } | null;
        } | null;
      }>,
      ...unknown[],
    ]
  >;
  /** Publish a message to a topic (short name); resolves to the messageId. */
  publish(topicName: string, data: Buffer, attributes: Record<string, string>): Promise<string>;
  /** Synchronously pull up to `maxMessages` from a subscription (short name). */
  pull(subscriptionName: string, maxMessages: number): Promise<RawReceivedMessage[]>;
  /** Acknowledge ackIds against a subscription (short name). */
  acknowledge(subscriptionName: string, ackIds: string[]): Promise<void>;
}

export type CreatePubSubClientFn = (projectId: string) => PubSubClientLike;

export interface PubSubDeps {
  createPubSubClient: CreatePubSubClientFn;
}

function lastSegment(fullName: string): string {
  return fullName.split('/').at(-1) ?? fullName;
}

function extractQuotaName(err: unknown): string | undefined {
  const e = err as { metadata?: { get?: (k: string) => string[] } };
  if (typeof e.metadata?.get === 'function') {
    const vals = e.metadata.get('quota_metric');
    return vals[0];
  }
  return undefined;
}

export function registerPubSub(app: Hono<AppEnv>, deps: PubSubDeps): void {
  app.get('/api/projects/:projectId/topics', async (c) => {
    const traceId = c.var.traceId;
    const projectId = c.req.param('projectId').trim();

    if (!projectId) {
      const body: PubSubError = {
        code: 'INVALID_QUERY',
        message: 'projectId must not be blank.',
        traceId,
      };
      return c.json(body, 400);
    }

    const client = deps.createPubSubClient(projectId);

    try {
      const [topicsRaw] = await client.getTopics();
      const topics: Topic[] = topicsRaw.map((t) => ({
        name: t.name,
        displayName: lastSegment(t.name),
      }));
      return c.json({ topics, traceId });
    } catch (err: unknown) {
      return handlePubSubError(err, traceId, c);
    }
  });

  app.get('/api/projects/:projectId/subscriptions', async (c) => {
    const traceId = c.var.traceId;
    const projectId = c.req.param('projectId').trim();

    if (!projectId) {
      const body: PubSubError = {
        code: 'INVALID_QUERY',
        message: 'projectId must not be blank.',
        traceId,
      };
      return c.json(body, 400);
    }

    const client = deps.createPubSubClient(projectId);

    try {
      const [subsRaw] = await client.getSubscriptions();
      const subscriptions: Subscription[] = subsRaw.map((s) => {
        const topicName = s.metadata?.topic ?? '_deleted-topic_';
        const pushEndpoint = s.metadata?.pushConfig?.pushEndpoint;
        const deliveryType: 'pull' | 'push' = pushEndpoint ? 'push' : 'pull';
        return {
          name: s.name,
          displayName: lastSegment(s.name),
          topicName,
          deliveryType,
        };
      });
      return c.json({ subscriptions, traceId });
    } catch (err: unknown) {
      return handlePubSubError(err, traceId, c);
    }
  });
}

function handlePubSubError(err: unknown, traceId: string, c: Context<AppEnv>) {
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

  if (e.code === 7 || e.code === 16) {
    const body: PubSubError = {
      code: 'PERMISSION_DENIED',
      message:
        'Missing pubsub.topics.list or pubsub.subscriptions.list permission. Grant roles/pubsub.viewer.',
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
