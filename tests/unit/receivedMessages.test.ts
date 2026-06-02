import { describe, it, expect } from 'vitest';
import {
  receivedMessagesReducer,
  initialReceivedMessagesState,
  type ReceivedMessagesState,
} from '../../src/client/lib/receivedMessages.js';
import type { ReceivedMessage } from '../../src/server/schemas/messaging.js';

function msg(overrides: Partial<ReceivedMessage> = {}): ReceivedMessage {
  return {
    messageId: 'm1',
    ackId: 'ack-1',
    data: 'hello',
    dataEncoding: 'utf-8',
    attributes: {},
    publishTime: '2026-05-31T10:00:00.000Z',
    deliveryAttempt: 1,
    ...overrides,
  };
}

describe('client/lib/receivedMessages — reducer (T021)', () => {
  it('starts with an empty list', () => {
    expect(initialReceivedMessagesState.items).toEqual([]);
  });

  it('APPEND concatenates without dropping existing items', () => {
    const s1 = receivedMessagesReducer(initialReceivedMessagesState, {
      type: 'APPEND',
      messages: [msg({ messageId: 'a', ackId: 'ack-a' })],
    });
    const s2 = receivedMessagesReducer(s1, {
      type: 'APPEND',
      messages: [msg({ messageId: 'b', ackId: 'ack-b' })],
    });
    expect(s2.items.map((m) => m.messageId)).toEqual(['a', 'b']);
    expect(s2.items.every((m) => m.acknowledged === false)).toBe(true);
  });

  it('APPEND keeps duplicate messageIds (redelivery, no destructive de-dup)', () => {
    const s1 = receivedMessagesReducer(initialReceivedMessagesState, {
      type: 'APPEND',
      messages: [msg({ messageId: 'dup', ackId: 'ack-1' })],
    });
    const s2 = receivedMessagesReducer(s1, {
      type: 'APPEND',
      messages: [msg({ messageId: 'dup', ackId: 'ack-2' })],
    });
    expect(s2.items).toHaveLength(2);
  });

  it('CLEAR empties the list', () => {
    const s1 = receivedMessagesReducer(initialReceivedMessagesState, {
      type: 'APPEND',
      messages: [msg(), msg({ ackId: 'ack-2' })],
    });
    const s2 = receivedMessagesReducer(s1, { type: 'CLEAR' });
    expect(s2.items).toEqual([]);
  });
});

describe('client/lib/receivedMessages — MARK_ACKNOWLEDGED (T035)', () => {
  const base: ReceivedMessagesState = {
    items: [
      { ...msg({ messageId: 'a', ackId: 'ack-a' }), acknowledged: false },
      { ...msg({ messageId: 'b', ackId: 'ack-b' }), acknowledged: false },
    ],
  };

  it('flags the matching item by ackId and leaves it visible', () => {
    const next = receivedMessagesReducer(base, { type: 'MARK_ACKNOWLEDGED', ackId: 'ack-a' });
    expect(next.items).toHaveLength(2);
    expect(next.items.find((m) => m.ackId === 'ack-a')?.acknowledged).toBe(true);
    expect(next.items.find((m) => m.ackId === 'ack-b')?.acknowledged).toBe(false);
  });

  it('is a no-op for an unknown ackId', () => {
    const next = receivedMessagesReducer(base, { type: 'MARK_ACKNOWLEDGED', ackId: 'nope' });
    expect(next.items.every((m) => m.acknowledged === false)).toBe(true);
  });
});

// ---- US7 (FR-020): running-list cap at the 60 newest ------------------------

describe('receivedMessagesReducer · 60-cap (R8/R10)', () => {
  function manyMessages(n: number): ReceivedMessage[] {
    return Array.from({ length: n }, (_, i) => msg({ messageId: `m${i}`, ackId: `ack-${i}` }));
  }

  it('keeps all items when total is at or below 60', () => {
    const next = receivedMessagesReducer(initialReceivedMessagesState, {
      type: 'APPEND',
      messages: manyMessages(60),
    });
    expect(next.items).toHaveLength(60);
  });

  it('caps at 60, dropping the oldest and retaining the newest', () => {
    const next = receivedMessagesReducer(initialReceivedMessagesState, {
      type: 'APPEND',
      messages: manyMessages(75),
    });
    expect(next.items).toHaveLength(60);
    // Oldest (m0..m14) dropped; newest (m74) retained.
    expect(next.items[0]?.messageId).toBe('m15');
    expect(next.items[next.items.length - 1]?.messageId).toBe('m74');
  });

  it('caps across successive appends (M existing + N new)', () => {
    const first = receivedMessagesReducer(initialReceivedMessagesState, {
      type: 'APPEND',
      messages: manyMessages(50),
    });
    const second = receivedMessagesReducer(first, {
      type: 'APPEND',
      messages: Array.from({ length: 30 }, (_, i) =>
        msg({ messageId: `n${i}`, ackId: `nack-${i}` }),
      ),
    });
    expect(second.items).toHaveLength(60);
    expect(second.items[second.items.length - 1]?.messageId).toBe('n29');
  });

  it('CLEAR still empties a capped list', () => {
    const filled = receivedMessagesReducer(initialReceivedMessagesState, {
      type: 'APPEND',
      messages: manyMessages(75),
    });
    expect(receivedMessagesReducer(filled, { type: 'CLEAR' }).items).toHaveLength(0);
  });
});
