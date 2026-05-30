import { describe, it, expect } from 'vitest';
import { createServer, type Server } from 'node:net';
import { start } from '../../src/server/boot.js';
import { createLogger } from '../../src/server/middleware/trace.js';
import { PortInUseError } from '../../src/server/auth/errors.js';
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

function occupyPort(): Promise<{ port: number; release: () => Promise<void> }> {
  return new Promise((resolve) => {
    const blocker: Server = createServer();
    blocker.listen(0, '127.0.0.1', () => {
      const addr = blocker.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      resolve({
        port,
        release: () => new Promise<void>((r) => blocker.close(() => r())),
      });
    });
  });
}

describe('boot.start port conflict (T047, T-CLI-009)', () => {
  it('rejects with PortInUseError (exit 14) when the port is occupied', async () => {
    const { port, release } = await occupyPort();
    try {
      await expect(
        start({
          port,
          logger,
          clientDir: 'tests/fixtures/client',
          getSession: async () => session,
        }),
      ).rejects.toMatchObject({ exitCode: 14 });
      await expect(
        start({
          port,
          logger,
          clientDir: 'tests/fixtures/client',
          getSession: async () => session,
        }),
      ).rejects.toBeInstanceOf(PortInUseError);
    } finally {
      await release();
    }
  });
});
