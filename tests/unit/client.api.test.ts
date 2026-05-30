import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import { apiGet, ApiError } from '../../src/client/lib/api.js';

const Schema = z.object({ value: z.number() });

function fakeResponse(opts: {
  ok: boolean;
  status: number;
  body: unknown;
  traceId?: string;
}): Response {
  return {
    ok: opts.ok,
    status: opts.status,
    headers: {
      get: (k: string) => (k.toLowerCase() === 'x-trace-id' ? (opts.traceId ?? null) : null),
    },
    json: async () => opts.body,
  } as unknown as Response;
}

describe('client/lib/api — apiGet (T052)', () => {
  it('parses the response with the provided schema and returns the trace id', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(
        fakeResponse({ ok: true, status: 200, body: { value: 42 }, traceId: 'trace-123' }),
      );
    const result = await apiGet('/api/thing', Schema, fetchImpl);
    expect(result.data).toEqual({ value: 42 });
    expect(result.traceId).toBe('trace-123');
    expect(fetchImpl).toHaveBeenCalledWith('/api/thing', expect.any(Object));
  });

  it('throws ApiError carrying code + remediation on a non-ok response', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      fakeResponse({
        ok: false,
        status: 503,
        body: {
          code: 'ADC_MISSING',
          message: 'ADC not configured',
          remediation: 'gcloud auth application-default login',
          traceId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        },
        traceId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      }),
    );
    await expect(apiGet('/api/session', Schema, fetchImpl)).rejects.toBeInstanceOf(ApiError);
    try {
      await apiGet('/api/session', Schema, fetchImpl);
    } catch (err) {
      expect((err as ApiError).code).toBe('ADC_MISSING');
      expect((err as ApiError).remediation).toContain('gcloud auth application-default login');
    }
  });

  it('throws when the ok body does not match the schema', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(fakeResponse({ ok: true, status: 200, body: { value: 'not-a-number' } }));
    await expect(apiGet('/api/thing', Schema, fetchImpl)).rejects.toThrow();
  });
});
