import { describe, it, expect } from 'vitest';
import { buildServer } from '../../src/server/server.js';
import { createLogger } from '../../src/server/middleware/trace.js';
import { DiagnosticsListSchema } from '../../src/server/schemas/diagnostics.js';
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

function app(verbose = false) {
  return buildServer({
    logger,
    port: 4321,
    clientDir: 'tests/fixtures/client',
    getSession: async () => session,
    verbose,
  });
}

describe('GET /api/diagnostics (T-HTTP-020..024)', () => {
  it('returns [] when no prior operations (T-HTTP-020)', async () => {
    const res = await app().request('/api/diagnostics', { headers });
    expect(res.status).toBe(200);
    const body = DiagnosticsListSchema.parse(await res.json());
    expect(body).toEqual([]);
  });

  it('returns recent operations newest-first, honouring limit (T-HTTP-021)', async () => {
    const a = app();
    await a.request('/api/health', { headers });
    await a.request('/api/session', { headers });
    const res = await a.request('/api/diagnostics?limit=1', { headers });
    const body = DiagnosticsListSchema.parse(await res.json());
    expect(body).toHaveLength(1);
    // newest-first → the most recent prior op was /api/session
    expect(body[0]!.request.path).toBe('/api/session');
  });

  it('redacts response bodies in normal mode (T-HTTP-023)', async () => {
    const a = app(false);
    await a.request('/api/session', { headers });
    const res = await a.request('/api/diagnostics', { headers });
    const body = DiagnosticsListSchema.parse(await res.json());
    const sessionRecord = body.find((r) => r.request.path === '/api/session');
    expect(JSON.stringify(sessionRecord?.response.body)).toContain('[REDACTED]');
  });

  it('reveals response bodies in verbose mode (T-HTTP-024)', async () => {
    const a = app(true);
    await a.request('/api/session', { headers });
    const res = await a.request('/api/diagnostics', { headers });
    const body = DiagnosticsListSchema.parse(await res.json());
    const sessionRecord = body.find((r) => r.request.path === '/api/session');
    expect(JSON.stringify(sessionRecord?.response.body)).toContain('my-cool-project');
  });

  it('rejects an invalid limit with 400 (T-HTTP-022 boundary)', async () => {
    const res = await app().request('/api/diagnostics?limit=999', { headers });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe('INVALID_QUERY');
  });
});
