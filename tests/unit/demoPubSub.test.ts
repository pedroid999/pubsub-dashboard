import { describe, it, expect } from 'vitest';
import { createInMemoryPubSubClient } from '../../src/server/cli/demoPubSub.js';

describe('cli/demoPubSub — in-memory round trip (T011a)', () => {
  it('publish → pull returns the same body and attributes', async () => {
    const factory = createInMemoryPubSubClient();
    const client = factory('demo-project');

    const messageId = await client.publish(
      'demo-topic',
      Buffer.from('{"hello":"world"}', 'utf-8'),
      { eventType: 'test' },
    );
    expect(messageId).toMatch(/^\d{12}$/);

    const pulled = await client.pull('demo-sub', 10);
    expect(pulled).toHaveLength(1);
    const m = pulled[0]!;
    expect(m.ackId).toBeTruthy();
    expect(Buffer.from(m.message!.data as Uint8Array).toString('utf-8')).toBe('{"hello":"world"}');
    expect(m.message!.attributes).toEqual({ eventType: 'test' });
  });

  it('pull is non-destructive until acknowledge removes the message', async () => {
    const factory = createInMemoryPubSubClient();
    const client = factory('demo-project');
    await client.publish('demo-topic', Buffer.from('a', 'utf-8'), {});

    const first = await client.pull('demo-sub', 10);
    expect(first).toHaveLength(1);
    // Peek again: still there (non-destructive).
    const second = await client.pull('demo-sub', 10);
    expect(second).toHaveLength(1);

    await client.acknowledge('demo-sub', [first[0]!.ackId!]);
    const third = await client.pull('demo-sub', 10);
    expect(third).toHaveLength(0);
  });

  it('shares state across factory calls for the same project', async () => {
    const factory = createInMemoryPubSubClient();
    await factory('p').publish('demo-topic', Buffer.from('x', 'utf-8'), {});
    const pulled = await factory('p').pull('demo-sub', 10);
    expect(pulled).toHaveLength(1);
  });

  it('exposes a demo topic and subscription for browsing', async () => {
    const factory = createInMemoryPubSubClient();
    const client = factory('p');
    const [topics] = await client.getTopics();
    const [subs] = await client.getSubscriptions();
    expect(topics[0]?.name).toContain('topics/demo-topic');
    expect(subs[0]?.name).toContain('subscriptions/demo-sub');
  });
});
