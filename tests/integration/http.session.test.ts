import { describe, it, expect } from 'vitest';
import { buildServer } from '../../src/server/server.js';
import { createLogger } from '../../src/server/middleware/trace.js';
import { SessionSchema, type Session } from '../../src/server/schemas/session.js';
import { AdcMissingError } from '../../src/server/auth/errors.js';

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

const headers = { host: '127.0.0.1:4321' };

describe('GET /api/session (T-HTTP-010..013)', () => {
  it('returns 200 with a valid Session body', async () => {
    const app = buildServer({
      logger,
      port: 4321,
      clientDir: 'tests/fixtures/client',
      getSession: async () => session,
    });
    const res = await app.request('/api/session', { headers });
    expect(res.status).toBe(200);
    const body = await res.json();
    const parsed = SessionSchema.parse(body);
    expect(parsed.projectId).toBe('my-cool-project');
    expect(parsed.identity).toBe('dev@example.com');
    expect(parsed.bindAddress).toBe('127.0.0.1');
    expect(parsed.port).toBe(4321);
  });

  it('reflects the request trace id in lastTraceId', async () => {
    const app = buildServer({
      logger,
      port: 4321,
      clientDir: 'tests/fixtures/client',
      getSession: async (traceId) => ({ ...session, lastTraceId: traceId }),
    });
    const res = await app.request('/api/session', { headers });
    const body = (await res.json()) as { lastTraceId: string | null };
    expect(body.lastTraceId).toBe(res.headers.get('x-trace-id'));
  });

  it('returns 503 ADC_MISSING when credentials expire mid-session', async () => {
    const app = buildServer({
      logger,
      port: 4321,
      clientDir: 'tests/fixtures/client',
      getSession: async () => {
        throw new AdcMissingError();
      },
    });
    const res = await app.request('/api/session', { headers });
    expect(res.status).toBe(503);
    const body = (await res.json()) as { code: string; remediation: string };
    expect(body.code).toBe('ADC_MISSING');
    expect(body.remediation).toContain('gcloud auth application-default login');
  });
});
