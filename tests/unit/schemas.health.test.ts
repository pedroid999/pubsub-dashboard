import { describe, it, expect } from 'vitest';
import { HealthResponseSchema } from '../../src/server/schemas/health.js';

describe('HealthResponseSchema (T-SCHEMA-020..021)', () => {
  it('accepts {status:"ok", uptimeMs:0}', () => {
    expect(() => HealthResponseSchema.parse({ status: 'ok', uptimeMs: 0 })).not.toThrow();
  });

  it('accepts positive uptimeMs', () => {
    expect(() => HealthResponseSchema.parse({ status: 'ok', uptimeMs: 12345 })).not.toThrow();
  });

  it('rejects non-"ok" status', () => {
    expect(() => HealthResponseSchema.parse({ status: 'degraded', uptimeMs: 0 })).toThrow();
  });

  it('rejects negative uptimeMs', () => {
    expect(() => HealthResponseSchema.parse({ status: 'ok', uptimeMs: -1 })).toThrow();
  });

  it('rejects non-integer uptimeMs', () => {
    expect(() => HealthResponseSchema.parse({ status: 'ok', uptimeMs: 1.5 })).toThrow();
  });
});
