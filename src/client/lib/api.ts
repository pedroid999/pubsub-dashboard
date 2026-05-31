import type { z } from 'zod';

export class ApiError extends Error {
  readonly code: string;
  readonly remediation?: string;

  constructor(code: string, message: string, remediation?: string) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.remediation = remediation;
  }
}

export interface ApiResult<T> {
  data: T;
  traceId: string | null;
}

/**
 * Typed GET: fetches `path`, validates the success body against `schema`, and
 * surfaces the `x-trace-id` header. Non-2xx responses are turned into
 * {@link ApiError} carrying the server's `code`/`remediation`.
 */
export async function apiGet<T>(
  path: string,
  schema: z.ZodType<T>,
  fetchImpl: typeof fetch = fetch,
): Promise<ApiResult<T>> {
  const res = await fetchImpl(path, { headers: { accept: 'application/json' } });
  const traceId = res.headers.get('x-trace-id');
  const json: unknown = await res.json();

  if (!res.ok) {
    const body = (json ?? {}) as { code?: string; message?: string; remediation?: string };
    throw new ApiError(
      body.code ?? 'INTERNAL',
      body.message ?? `Request to ${path} failed with ${res.status}`,
      body.remediation,
    );
  }

  return { data: schema.parse(json), traceId };
}

/**
 * Typed POST: JSON-serialises `body`, validates the success response against
 * `schema`, and surfaces the `x-trace-id` header. Non-2xx responses become an
 * {@link ApiError} carrying the server's `code`/`message`/`remediation`.
 * Symmetric with {@link apiGet}.
 */
export async function apiPost<T>(
  path: string,
  body: unknown,
  schema: z.ZodType<T>,
  fetchImpl: typeof fetch = fetch,
): Promise<ApiResult<T>> {
  const res = await fetchImpl(path, {
    method: 'POST',
    headers: { accept: 'application/json', 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const traceId = res.headers.get('x-trace-id');
  const json: unknown = await res.json();

  if (!res.ok) {
    const errBody = (json ?? {}) as { code?: string; message?: string; remediation?: string };
    throw new ApiError(
      errBody.code ?? 'INTERNAL',
      errBody.message ?? `Request to ${path} failed with ${res.status}`,
      errBody.remediation,
    );
  }

  return { data: schema.parse(json), traceId };
}
