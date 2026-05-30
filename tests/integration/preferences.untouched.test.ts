import { describe, it, expect } from 'vitest';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { start } from '../../src/server/boot.js';
import { createLogger } from '../../src/server/middleware/trace.js';
import { preferencesPath } from '../../src/shared/preferences-path.js';
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

describe('preferences file is never written in v1 (T071, T-SCHEMA-062)', () => {
  it('a full boot → request → shutdown cycle does not create the preferences file', async () => {
    const xdg = mkdtempSync(join(tmpdir(), 'pubsub-xdg-'));
    const prefsPath = preferencesPath({ XDG_CONFIG_HOME: xdg } as NodeJS.ProcessEnv);
    expect(existsSync(prefsPath)).toBe(false);

    const server = await start({
      port: 0,
      logger,
      clientDir: 'tests/fixtures/client',
      getSession: async () => session,
    });
    try {
      await fetch(`${server.url}/api/health`);
      await fetch(`${server.url}/api/session`);
    } finally {
      await server.close();
    }

    expect(existsSync(prefsPath)).toBe(false);
    rmSync(xdg, { recursive: true, force: true });
  });
});
