import { describe, it, expect } from 'vitest';
import { SessionSchema } from '../../src/server/schemas/session.js';

const valid = {
  projectId: 'my-cool-project',
  identity: 'dev@example.com',
  bindAddress: '127.0.0.1' as const,
  port: 4321,
  startedAt: '2026-05-29T20:00:00.000Z',
  lastTraceId: null,
  version: '0.1.0',
  nodeVersion: 'v20.18.0',
};

describe('SessionSchema (T-SCHEMA-010..013)', () => {
  it('round-trips a valid Session', () => {
    const parsed = SessionSchema.parse(valid);
    expect(parsed).toEqual(valid);
  });

  it('rejects projectId with uppercase letters or too-short length', () => {
    expect(() => SessionSchema.parse({ ...valid, projectId: 'BadProject' })).toThrow();
    expect(() => SessionSchema.parse({ ...valid, projectId: 'abc' })).toThrow();
  });

  it('rejects bindAddress other than 127.0.0.1', () => {
    expect(() => SessionSchema.parse({ ...valid, bindAddress: '0.0.0.0' })).toThrow();
  });

  it('rejects port out of range', () => {
    expect(() => SessionSchema.parse({ ...valid, port: 0 })).toThrow();
    expect(() => SessionSchema.parse({ ...valid, port: 70000 })).toThrow();
    expect(() => SessionSchema.parse({ ...valid, port: 4321.5 })).toThrow();
  });

  it('accepts a UUIDv4 lastTraceId', () => {
    const withTrace = { ...valid, lastTraceId: '550e8400-e29b-41d4-a716-446655440000' };
    expect(() => SessionSchema.parse(withTrace)).not.toThrow();
  });
});
