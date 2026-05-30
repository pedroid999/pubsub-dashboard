import { describe, it, expect } from 'vitest';
import { connect } from 'node:net';
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

function tcpConnects(host: string, port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = connect({ host, port }, () => {
      socket.end();
      resolve(true);
    });
    socket.on('error', () => resolve(false));
    socket.setTimeout(1000, () => {
      socket.destroy();
      resolve(false);
    });
  });
}

describe('loopback-only bind (T068, T-NET-001)', () => {
  it('binds exclusively to 127.0.0.1', async () => {
    const server = await start({
      port: 0,
      logger,
      clientDir: 'tests/fixtures/client',
      getSession: async () => session,
    });
    try {
      expect(server.url).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
      // A loopback connection succeeds…
      expect(await tcpConnects('127.0.0.1', server.port)).toBe(true);
      // …while a non-loopback interface address is refused (server is not on 0.0.0.0).
      expect(await tcpConnects('192.0.2.1', server.port)).toBe(false);
    } finally {
      await server.close();
    }
  });
});
