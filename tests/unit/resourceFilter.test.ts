import { describe, it, expect } from 'vitest';
import { filterByQuery, highlightMatch } from '../../src/client/lib/resourceFilter.js';

const items = [
  { name: 'projects/p/topics/payments-topic', displayName: 'payments-topic' },
  { name: 'projects/p/topics/orders-topic', displayName: 'orders-topic' },
  { name: 'projects/p/topics/PAYMENTS-UPPER', displayName: 'PAYMENTS-UPPER' },
];

describe('filterByQuery', () => {
  it('returns all items when query is empty', () => {
    expect(filterByQuery(items, '')).toHaveLength(3);
  });

  it('returns all items when query is only whitespace', () => {
    expect(filterByQuery(items, '   ')).toHaveLength(3);
  });

  it('filters by partial match (case-insensitive)', () => {
    const result = filterByQuery(items, 'payments');
    expect(result).toHaveLength(2);
    expect(result.map((i) => i.displayName)).toEqual(['payments-topic', 'PAYMENTS-UPPER']);
  });

  it('is case-insensitive (uppercase query vs lowercase name)', () => {
    const result = filterByQuery(items, 'ORDERS');
    expect(result).toHaveLength(1);
    expect(result[0]?.displayName).toBe('orders-topic');
  });

  it('returns empty array when no items match', () => {
    expect(filterByQuery(items, 'nonexistent')).toHaveLength(0);
  });

  it('matches items with exact displayName', () => {
    const result = filterByQuery(items, 'orders-topic');
    expect(result).toHaveLength(1);
  });

  it('does not mutate the original array', () => {
    const original = [...items];
    filterByQuery(items, 'pay');
    expect(items).toEqual(original);
  });

  it('matches items by subLabel when displayName does not match (FR-017)', () => {
    const subs = [
      { name: 'sub-1', displayName: 'payments-sub [pull]', subLabel: 'projects/p/topics/payments' },
      { name: 'sub-2', displayName: 'orders-sub [push]', subLabel: 'projects/p/topics/orders' },
    ];
    const result = filterByQuery(subs, 'orders');
    expect(result).toHaveLength(1);
    expect(result[0]?.name).toBe('sub-2');
  });

  it('matches items by subLabel case-insensitively (FR-017)', () => {
    const subs = [
      { name: 'sub-1', displayName: 'alpha-sub [pull]', subLabel: 'projects/p/topics/PAYMENTS-TOPIC' },
    ];
    expect(filterByQuery(subs, 'payments-topic')).toHaveLength(1);
  });

  it('returns item when both displayName and subLabel match (no duplicates)', () => {
    const subs = [
      { name: 'sub-1', displayName: 'payments-sub [pull]', subLabel: 'projects/p/topics/payments-topic' },
    ];
    expect(filterByQuery(subs, 'payments')).toHaveLength(1);
  });

  it('items without subLabel are unaffected (backward compat)', () => {
    expect(filterByQuery(items, 'payments')).toHaveLength(2);
  });
});

describe('highlightMatch', () => {
  it('returns a single non-highlighted segment when query is empty', () => {
    const segments = highlightMatch('payments-topic', '');
    expect(segments).toEqual([{ text: 'payments-topic', highlight: false }]);
  });

  it('returns a single non-highlighted segment when query is only whitespace', () => {
    const segments = highlightMatch('payments-topic', '  ');
    expect(segments).toEqual([{ text: 'payments-topic', highlight: false }]);
  });

  it('returns a single non-highlighted segment when no match', () => {
    const segments = highlightMatch('orders-topic', 'xyz');
    expect(segments).toEqual([{ text: 'orders-topic', highlight: false }]);
  });

  it('wraps the matched segment correctly (match at start)', () => {
    const segments = highlightMatch('payments-topic', 'pay');
    expect(segments).toEqual([
      { text: 'pay', highlight: true },
      { text: 'ments-topic', highlight: false },
    ]);
  });

  it('wraps the matched segment correctly (match in middle)', () => {
    const segments = highlightMatch('payments-topic', 'ments');
    expect(segments).toEqual([
      { text: 'pay', highlight: false },
      { text: 'ments', highlight: true },
      { text: '-topic', highlight: false },
    ]);
  });

  it('wraps the matched segment correctly (match at end)', () => {
    const segments = highlightMatch('payments-topic', 'topic');
    expect(segments).toEqual([
      { text: 'payments-', highlight: false },
      { text: 'topic', highlight: true },
    ]);
  });

  it('is case-insensitive and preserves original casing in output', () => {
    const segments = highlightMatch('PAYMENTS-UPPER', 'payments');
    expect(segments[0]).toEqual({ text: 'PAYMENTS', highlight: true });
    expect(segments[1]).toEqual({ text: '-UPPER', highlight: false });
  });

  it('handles full text match', () => {
    const segments = highlightMatch('pay', 'pay');
    expect(segments).toEqual([{ text: 'pay', highlight: true }]);
  });
});
