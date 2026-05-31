import type {
  CreatePubSubClientFn,
  PubSubClientLike,
  RawReceivedMessage,
} from '../routes/pubsub.js';

interface StoredMessage {
  messageId: string;
  ackId: string;
  data: Buffer;
  attributes: Record<string, string>;
  publishTime: string;
  deliveryAttempt: number;
}

interface ProjectStore {
  queue: StoredMessage[];
  seq: number;
}

const DEMO_TOPIC = 'demo-topic';
const DEMO_SUBSCRIPTION = 'demo-sub';

/**
 * Build an in-memory `createPubSubClient` for the CI/demo seam. State is shared
 * across requests via a closure (the factory is called per request, but all
 * calls for a project see the same queue), so a publish→pull→ack round-trip
 * works offline without GCP credentials. Pull is non-destructive: messages are
 * peeked and only removed by `acknowledge` (mirrors real Pub/Sub semantics and
 * FR-016/FR-018).
 */
export function createInMemoryPubSubClient(): CreatePubSubClientFn {
  const stores = new Map<string, ProjectStore>();

  function storeFor(projectId: string): ProjectStore {
    let store = stores.get(projectId);
    if (!store) {
      store = { queue: [], seq: 0 };
      stores.set(projectId, store);
    }
    return store;
  }

  return (projectId: string): PubSubClientLike => {
    const store = storeFor(projectId);
    const prefix = `projects/${projectId}`;

    const client: PubSubClientLike = {
      getTopics: () => Promise.resolve([[{ name: `${prefix}/topics/${DEMO_TOPIC}` }]]),

      getSubscriptions: () =>
        Promise.resolve([
          [
            {
              name: `${prefix}/subscriptions/${DEMO_SUBSCRIPTION}`,
              metadata: { topic: `${prefix}/topics/${DEMO_TOPIC}`, pushConfig: {} },
            },
          ],
        ]),

      publish: (_topicName: string, data: Buffer, attributes: Record<string, string>) => {
        store.seq += 1;
        const id = String(store.seq).padStart(12, '0');
        store.queue.push({
          messageId: id,
          ackId: `ack-${id}`,
          data,
          attributes,
          publishTime: new Date().toISOString(),
          deliveryAttempt: 0,
        });
        return Promise.resolve(id);
      },

      pull: (_subscriptionName: string, maxMessages: number) => {
        const batch = store.queue.slice(0, maxMessages);
        const raw: RawReceivedMessage[] = batch.map((m) => {
          m.deliveryAttempt += 1;
          return {
            ackId: m.ackId,
            deliveryAttempt: m.deliveryAttempt,
            message: {
              messageId: m.messageId,
              data: m.data,
              attributes: m.attributes,
              publishTime: m.publishTime,
            },
          };
        });
        return Promise.resolve(raw);
      },

      acknowledge: (_subscriptionName: string, ackIds: string[]) => {
        const toDrop = new Set(ackIds);
        store.queue = store.queue.filter((m) => !toDrop.has(m.ackId));
        return Promise.resolve();
      },
    };

    return client;
  };
}
