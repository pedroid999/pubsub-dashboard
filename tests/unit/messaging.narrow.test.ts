import { describe, it, expect } from 'vitest';
import { narrowReceivedMessage } from '../../src/server/routes/messaging.js';
import type { RawReceivedMessage } from '../../src/server/routes/pubsub.js';

describe('routes/messaging — narrowReceivedMessage', () => {
  it('decodes a UTF-8 Buffer payload as utf-8', () => {
    const out = narrowReceivedMessage({
      ackId: 'a',
      deliveryAttempt: 2,
      message: {
        messageId: 'm',
        data: Buffer.from('héllo', 'utf-8'),
        attributes: { k: 'v' },
        publishTime: { seconds: 1717000000, nanos: 500000000 },
      },
    });
    expect(out.dataEncoding).toBe('utf-8');
    expect(out.data).toBe('héllo');
    expect(out.deliveryAttempt).toBe(2);
    expect(out.publishTime).toBe(new Date(1717000000 * 1000 + 500).toISOString());
  });

  it('falls back to base64 for non-UTF-8 bytes', () => {
    const out = narrowReceivedMessage({
      ackId: 'a',
      message: { messageId: 'm', data: Buffer.from([0xff, 0xfe, 0xfd]) },
    });
    expect(out.dataEncoding).toBe('base64');
    expect(out.data).toBe(Buffer.from([0xff, 0xfe, 0xfd]).toString('base64'));
  });

  it('treats string data as utf-8', () => {
    const out = narrowReceivedMessage({ ackId: 'a', message: { messageId: 'm', data: 'plain' } });
    expect(out.dataEncoding).toBe('utf-8');
    expect(out.data).toBe('plain');
  });

  it('applies safe defaults for a fully-empty raw message', () => {
    const out = narrowReceivedMessage({} as RawReceivedMessage);
    expect(out.messageId).toBe('');
    expect(out.ackId).toBe('');
    expect(out.data).toBe('');
    expect(out.attributes).toEqual({});
    expect(out.deliveryAttempt).toBeNull();
    expect(out.publishTime).toBe(new Date(0).toISOString());
  });

  it('accepts an ISO string publishTime', () => {
    const out = narrowReceivedMessage({
      ackId: 'a',
      message: { messageId: 'm', data: 'x', publishTime: '2026-05-31T10:00:00.000Z' },
    });
    expect(out.publishTime).toBe('2026-05-31T10:00:00.000Z');
  });

  it('passes through an unparseable publishTime string as-is', () => {
    const out = narrowReceivedMessage({
      ackId: 'a',
      message: { messageId: 'm', data: 'x', publishTime: 'not-a-date' },
    });
    expect(out.publishTime).toBe('not-a-date');
  });

  it('accepts a Date publishTime', () => {
    const d = new Date('2026-01-01T00:00:00.000Z');
    const out = narrowReceivedMessage({
      ackId: 'a',
      message: { messageId: 'm', data: 'x', publishTime: d },
    });
    expect(out.publishTime).toBe(d.toISOString());
  });
});
