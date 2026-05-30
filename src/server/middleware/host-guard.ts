import type { MiddlewareHandler } from 'hono';
import type { TraceVars } from './trace.js';

const LOOPBACK_HOSTNAMES = new Set(['127.0.0.1', 'localhost', '[::1]', '::1']);

/**
 * Reject requests whose Host header is not a loopback hostname. This mitigates
 * DNS-rebinding attacks against the local-only server (contracts/cli.md T-HTTP-003).
 * Only the hostname is checked — the port carries no security value and the
 * server may bind a dynamic port. Requests without a Host header (e.g. some
 * in-process test harnesses) are allowed.
 */
export function hostGuard(): MiddlewareHandler<{ Variables: TraceVars }> {
  return async (c, next) => {
    const host = c.req.header('host');
    const hostname = host?.replace(/:\d+$/, '');
    if (host !== undefined && (hostname === undefined || !LOOPBACK_HOSTNAMES.has(hostname))) {
      return c.json(
        {
          code: 'INVALID_QUERY' as const,
          message: `Refused request with non-loopback Host header: ${host}`,
          traceId: c.var.traceId,
        },
        403,
      );
    }
    await next();
    return undefined;
  };
}
