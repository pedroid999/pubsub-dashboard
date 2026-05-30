import { describe, it, expect, vi, afterEach } from 'vitest';
import { buildServer } from '../../src/server/server.js';
import { createLogger } from '../../src/server/middleware/trace.js';
import type { Session } from '../../src/server/schemas/session.js';

const logger = createLogger({ level: 'silent' });
const headers = { host: '127.0.0.1' };

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

afterEach(() => {
  vi.restoreAllMocks();
});

describe('no non-Google outbound during a session (T069, T-NET-002)', () => {
  it('serving health/session/diagnostics makes zero outbound fetch calls', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const app = buildServer({
      logger,
      port: 4321,
      clientDir: 'tests/fixtures/client',
      getSession: async () => session,
    });

    await app.request('/api/health', { headers });
    await app.request('/api/session', { headers });
    await app.request('/api/diagnostics', { headers });
    await app.request('/', { headers });

    // The running server never reaches out; identity is resolved once at boot,
    // and that single call (to *.googleapis.com) is covered in auth.identity.test.ts.
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
