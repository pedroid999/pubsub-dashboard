import { describe, it, expect } from 'vitest';
import { createSessionStore } from '../../src/server/session.js';

const seed = {
  projectId: 'my-cool-project',
  identity: 'dev@example.com',
  bindAddress: '127.0.0.1' as const,
  port: 4321,
  startedAt: '2026-05-29T20:00:00.000Z',
  version: '0.1.0',
  nodeVersion: 'v20.18.0',
};

describe('createSessionStore', () => {
  it('snapshots the seed with lastTraceId null initially', () => {
    const store = createSessionStore(seed);
    expect(store.snapshot()).toEqual({ ...seed, lastTraceId: null });
  });

  it('updates lastTraceId on subsequent snapshots', () => {
    const store = createSessionStore(seed);
    store.setLastTraceId('trace-xyz');
    expect(store.snapshot().lastTraceId).toBe('trace-xyz');
  });
});
