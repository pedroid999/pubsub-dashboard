import { describe, it, expect } from 'vitest';
import { buildServer } from '../../src/server/server.js';
import { createLogger } from '../../src/server/middleware/trace.js';
import { HealthResponseSchema } from '../../src/server/schemas/health.js';
import type { Session } from '../../src/server/schemas/session.js';

const logger = createLogger({ level: 'silent' });

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

describe('GET /api/health (T-HTTP-001..003)', () => {
  it('returns 200 with a HealthResponse body', async () => {
    const res = await app().request('/api/health', { headers: { host: '127.0.0.1:4321' } });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string; uptimeMs: number };
    expect(() => HealthResponseSchema.parse(body)).not.toThrow();
    expect(body.status).toBe('ok');
    expect(body.uptimeMs).toBeGreaterThanOrEqual(0);
  });

  it('includes a UUIDv4 x-trace-id header', async () => {
    const res = await app().request('/api/health', { headers: { host: '127.0.0.1:4321' } });
    expect(res.headers.get('x-trace-id')).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it('refuses a request whose Host header is not loopback (DNS rebinding guard)', async () => {
    const res = await app().request('/api/health', { headers: { host: 'evil.example.com' } });
    expect(res.status).toBe(403);
  });
});
