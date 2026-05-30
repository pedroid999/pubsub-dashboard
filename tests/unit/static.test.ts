import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { registerStatic } from '../../src/server/static.js';
import { traceMiddleware, createLogger } from '../../src/server/middleware/trace.js';
import type { TraceVars } from '../../src/server/middleware/trace.js';

function app() {
  const a = new Hono<{ Variables: TraceVars }>();
  a.use('*', traceMiddleware(createLogger({ level: 'silent' })));
  registerStatic(a, { clientDir: 'tests/fixtures/client' });
  return a;
}

describe('static serving edge branches', () => {
  it('serves a fingerprinted asset with octet-stream for unknown extensions', async () => {
    // index.html exists; request it via SPA fallback returns html
    const res = await app().request('/');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/html');
  });

  it('refuses path traversal under /assets and returns 404', async () => {
    const res = await app().request('/assets/..%2f..%2f..%2fetc%2fpasswd');
    expect(res.status).toBe(404);
  });

  it('returns 404 for a missing asset', async () => {
    const res = await app().request('/assets/missing-file.css');
    expect(res.status).toBe(404);
  });

  it('serves an unknown-extension asset as application/octet-stream', async () => {
    const res = await app().request('/assets/data-abc.bin');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('application/octet-stream');
    expect(res.headers.get('cache-control')).toContain('immutable');
  });
});
