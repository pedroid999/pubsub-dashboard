import { describe, it, expect } from 'vitest';
import { start } from '../../src/server/boot.js';
import { createLogger } from '../../src/server/middleware/trace.js';
import type { Session } from '../../src/server/schemas/session.js';

const logger = createLogger({ level: 'silent' });

const session: Session = {
  projectId: 'my-cool-project',
  identity: 'dev@example.com',
  bindAddress: '127.0.0.1',
  port: 0,
  startedAt: '2026-05-29T20:00:00.000Z',
  lastTraceId: null,
  version: '0.1.0',
  nodeVersion: 'v20.18.0',
};

describe('boot.start (T045)', () => {
  it('listens on 127.0.0.1, serves /api/health, then closes cleanly', async () => {
    const server = await start({
      port: 0,
      logger,
      clientDir: 'tests/fixtures/client',
      getSession: async () => session,
    });
    try {
      expect(server.url).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
      const res = await fetch(`${server.url}/api/health`);
      expect(res.status).toBe(200);
      const body = (await res.json()) as { status: string };
      expect(body.status).toBe('ok');
    } finally {
      const t0 = Date.now();
      await server.close();
      expect(Date.now() - t0).toBeLessThan(1000);
    }
  });

  it('releases the port on close (a second bind to the same port succeeds)', async () => {
    const first = await start({
      port: 0,
      logger,
      clientDir: 'tests/fixtures/client',
      getSession: async () => session,
    });
    const port = first.port;
    await first.close();

    const second = await start({
      port,
      logger,
      clientDir: 'tests/fixtures/client',
      getSession: async () => session,
    });
    expect(second.port).toBe(port);
    await second.close();
  });
});
