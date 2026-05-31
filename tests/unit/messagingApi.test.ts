import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import { apiPost, ApiError } from '../../src/client/lib/api.js';

const Schema = z.object({ messageId: z.string() });

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

describe('client/lib/api — apiPost (T007)', () => {
  it('serialises the body as JSON, sets content-type, and posts', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(
        fakeResponse({ ok: true, status: 200, body: { messageId: 'm1' }, traceId: 'trace-1' }),
      );
    const result = await apiPost('/api/publish', { data: 'hi' }, Schema, fetchImpl);
    expect(result.data).toEqual({ messageId: 'm1' });
    expect(result.traceId).toBe('trace-1');
    const [path, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(path).toBe('/api/publish');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>)['content-type']).toBe('application/json');
    expect(init.body).toBe(JSON.stringify({ data: 'hi' }));
  });

  it('throws ApiError carrying code + remediation on a non-ok response', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      fakeResponse({
        ok: false,
        status: 401,
        body: {
          code: 'PERMISSION_DENIED',
          message: 'Missing pubsub.topics.publish permission.',
          remediation: 'Grant roles/pubsub.publisher',
        },
      }),
    );
    await expect(apiPost('/api/publish', {}, Schema, fetchImpl)).rejects.toBeInstanceOf(ApiError);
    try {
      await apiPost('/api/publish', {}, Schema, fetchImpl);
    } catch (err) {
      expect((err as ApiError).code).toBe('PERMISSION_DENIED');
      expect((err as ApiError).remediation).toContain('roles/pubsub.publisher');
    }
  });

  it('defaults code to INTERNAL when the error body is empty', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(fakeResponse({ ok: false, status: 500, body: null }));
    try {
      await apiPost('/api/publish', {}, Schema, fetchImpl);
      expect.unreachable('should have thrown');
    } catch (err) {
      expect((err as ApiError).code).toBe('INTERNAL');
      expect((err as ApiError).message).toContain('/api/publish');
    }
  });

  it('throws when the ok body does not match the schema', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(fakeResponse({ ok: true, status: 200, body: { wrong: true } }));
    await expect(apiPost('/api/publish', {}, Schema, fetchImpl)).rejects.toThrow();
  });
});
