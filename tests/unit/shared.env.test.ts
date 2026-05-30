import { describe, it, expect } from 'vitest';
import { MIN_NODE_MAJOR, assertSupportedNode } from '../../src/shared/env.js';

describe('shared/env', () => {
  it('exposes MIN_NODE_MAJOR = 20', () => {
    expect(MIN_NODE_MAJOR).toBe(20);
  });

  it('accepts Node v20+', () => {
    expect(() => assertSupportedNode('v20.0.0')).not.toThrow();
    expect(() => assertSupportedNode('v20.18.0')).not.toThrow();
    expect(() => assertSupportedNode('v22.5.1')).not.toThrow();
  });

  it('rejects Node <20 with the documented stderr line', () => {
    let captured = '';
    try {
      assertSupportedNode('v18.19.0');
    } catch (err) {
      captured = (err as Error).message;
    }
    expect(captured).toContain('Requires Node >= 20 LTS');
    expect(captured).toContain('nvm install 20');
  });

  it('rejects malformed version strings', () => {
    expect(() => assertSupportedNode('not-a-version')).toThrow();
    expect(() => assertSupportedNode('')).toThrow();
  });
});
