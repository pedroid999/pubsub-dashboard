import { describe, it, expect } from 'vitest';
import { clampIndex, move, RESET_INDEX } from '../../src/client/lib/searchListNav.js';

describe('searchListNav.clampIndex', () => {
  it('returns 0 for an empty list regardless of index', () => {
    expect(clampIndex(0, 0)).toBe(0);
    expect(clampIndex(5, 0)).toBe(0);
    expect(clampIndex(-3, 0)).toBe(0);
  });

  it('clamps negative indices to 0', () => {
    expect(clampIndex(-1, 5)).toBe(0);
    expect(clampIndex(-100, 5)).toBe(0);
  });

  it('clamps out-of-range indices to len-1', () => {
    expect(clampIndex(5, 5)).toBe(4);
    expect(clampIndex(999, 3)).toBe(2);
  });

  it('passes through in-range indices', () => {
    expect(clampIndex(0, 5)).toBe(0);
    expect(clampIndex(2, 5)).toBe(2);
    expect(clampIndex(4, 5)).toBe(4);
  });
});

describe('searchListNav.move', () => {
  it('moves by +1 / -1 deltas, clamped to bounds', () => {
    expect(move(0, { delta: 1 }, 5)).toBe(1);
    expect(move(4, { delta: 1 }, 5)).toBe(4); // clamp at end
    expect(move(2, { delta: -1 }, 5)).toBe(1);
    expect(move(0, { delta: -1 }, 5)).toBe(0); // clamp at start
  });

  it('jumps to an absolute index (Home/End), clamped', () => {
    expect(move(3, { absolute: 0 }, 5)).toBe(0); // Home
    expect(move(0, { absolute: 4 }, 5)).toBe(4); // End (len-1)
    expect(move(0, { absolute: 99 }, 5)).toBe(4); // clamp over
    expect(move(0, { absolute: -5 }, 5)).toBe(0); // clamp under
  });

  it('returns 0 for an empty list (any move)', () => {
    expect(move(0, { delta: 1 }, 0)).toBe(0);
    expect(move(3, { delta: -1 }, 0)).toBe(0);
    expect(move(0, { absolute: 2 }, 0)).toBe(0);
  });

  it('prefers absolute over delta when both are provided', () => {
    expect(move(0, { absolute: 3, delta: 1 }, 5)).toBe(3);
  });

  it('re-clamps the current index when no delta/absolute is given', () => {
    expect(move(99, {}, 5)).toBe(4);
    expect(move(-1, {}, 5)).toBe(0);
  });

  it('exposes a query-change reset index of 0', () => {
    expect(RESET_INDEX).toBe(0);
  });
});
