import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { cspMiddleware, CSP_VALUE } from '../../src/server/middleware/csp.js';

function app() {
  const a = new Hono();
  a.use('*', cspMiddleware());
  a.get('/page', (c) => c.html('<!doctype html><html></html>'));
  a.get('/api/thing', (c) => c.json({ ok: true }));
  return a;
}

describe('cspMiddleware (T058, T-HTTP-030)', () => {
  it('sets the exact CSP header on HTML responses', async () => {
    const res = await app().request('/page');
    expect(res.headers.get('content-security-policy')).toBe(CSP_VALUE);
  });

  it('does NOT set CSP on JSON responses', async () => {
    const res = await app().request('/api/thing');
    expect(res.headers.get('content-security-policy')).toBeNull();
  });

  it('CSP value locks down to self with no third-party origins', () => {
    expect(CSP_VALUE).toContain("default-src 'self'");
    expect(CSP_VALUE).toContain("frame-ancestors 'none'");
    expect(CSP_VALUE).toContain("connect-src 'self'");
    expect(CSP_VALUE).not.toMatch(/https?:\/\//);
  });
});
