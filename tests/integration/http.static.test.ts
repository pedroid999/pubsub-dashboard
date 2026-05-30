import { describe, it, expect } from 'vitest';
import { buildServer } from '../../src/server/server.js';
import { createLogger } from '../../src/server/middleware/trace.js';
import type { Session } from '../../src/server/schemas/session.js';

const logger = createLogger({ level: 'silent' });
const headers = { host: '127.0.0.1:4321' };

const session: Session = {
  projectId: 'my-cool-project',
  identity: 'dev@example.com',
  bindAddress: '127.0.0.1',
  port: 4321,
  startedAt: '2026-05-29T20:00:00.000Z',
  lastTraceId: null,
  version: '0.1.0',
  nodeVersion: 'v20.18.0',
};

function app() {
  return buildServer({
    logger,
    port: 4321,
    clientDir: 'tests/fixtures/client',
    getSession: async () => session,
  });
}

describe('static asset surface (T-HTTP-030..032)', () => {
  it('GET / returns 200 text/html', async () => {
    const res = await app().request('/', { headers });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/html');
    expect(await res.text()).toContain('<div id="root">');
  });

  it('GET /assets/<fingerprinted> returns 200 with immutable Cache-Control', async () => {
    const res = await app().request('/assets/app-abc123.js', { headers });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/javascript');
    expect(res.headers.get('cache-control')).toContain('immutable');
  });

  it('GET /api/does-not-exist returns 404 (API namespace is exact, not SPA fallback)', async () => {
    const res = await app().request('/api/does-not-exist', { headers });
    expect(res.status).toBe(404);
    const body = (await res.json()) as { code?: string };
    expect(body.code).toBeDefined();
  });

  it('GET /assets/<bogus> returns 404 (assets are not SPA-fallback covered)', async () => {
    const res = await app().request('/assets/nope-does-not-exist.js', { headers });
    expect(res.status).toBe(404);
  });

  it('GET /some/client/route falls back to index.html (SPA)', async () => {
    const res = await app().request('/some/client/route', { headers });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/html');
  });
});
