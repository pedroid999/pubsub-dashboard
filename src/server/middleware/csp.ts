import type { MiddlewareHandler } from 'hono';
import type { TraceVars } from './trace.js';

/**
 * Strict Content-Security-Policy (research.md R9). `'unsafe-inline'` is allowed
 * for styles only because Tailwind's preflight inlines styles; everything else
 * is `'self'`. `connect-src 'self'` prevents the client from reaching any host
 * other than the local server, which in turn only talks to Google APIs.
 */
export const CSP_VALUE = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

/**
 * Apply the strict CSP header to HTML responses only (JSON API responses do
 * not need it and omitting it keeps the contract clean — T-HTTP-030).
 */
export function cspMiddleware(): MiddlewareHandler<{ Variables: TraceVars }> {
  return async (c, next) => {
    await next();
    const contentType = c.res.headers.get('content-type') ?? '';
    if (contentType.includes('text/html')) {
      c.res.headers.set('content-security-policy', CSP_VALUE);
    }
  };
}
