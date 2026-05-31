import { describe, it, expect } from 'vitest';
import { validateOutboundDraft } from '../../src/client/lib/messaging.js';

describe('client/lib/messaging — validateOutboundDraft body (T013)', () => {
  it('fails on an empty body', () => {
    const res = validateOutboundDraft({ body: '', attributes: [] });
    expect(res.ok).toBe(false);
  });

  it('passes a non-empty body with no attributes', () => {
    const res = validateOutboundDraft({ body: 'hello', attributes: [] });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.attributes).toEqual({});
  });
});

describe('client/lib/messaging — validateOutboundDraft attributes (T029)', () => {
  it('fails a row with a key but no value', () => {
    const res = validateOutboundDraft({ body: 'x', attributes: [{ key: 'k', value: '' }] });
    expect(res.ok).toBe(false);
  });

  it('fails a row with a value but no key', () => {
    const res = validateOutboundDraft({ body: 'x', attributes: [{ key: '', value: 'v' }] });
    expect(res.ok).toBe(false);
  });

  it('fails on duplicate keys', () => {
    const res = validateOutboundDraft({
      body: 'x',
      attributes: [
        { key: 'k', value: 'a' },
        { key: 'k', value: 'b' },
      ],
    });
    expect(res.ok).toBe(false);
  });

  it('passes complete unique pairs and assembles the record', () => {
    const res = validateOutboundDraft({
      body: 'x',
      attributes: [
        { key: 'eventType', value: 'order.paid' },
        { key: 'source', value: 'checkout' },
      ],
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.attributes).toEqual({ eventType: 'order.paid', source: 'checkout' });
    }
  });

  it('ignores a fully-empty row (treated as no attribute)', () => {
    const res = validateOutboundDraft({
      body: 'x',
      attributes: [
        { key: '', value: '' },
        { key: 'k', value: 'v' },
      ],
    });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.attributes).toEqual({ k: 'v' });
  });
});
