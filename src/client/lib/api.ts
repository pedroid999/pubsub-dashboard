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
