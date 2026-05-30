import { describe, it, expect } from 'vitest';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BIN = resolve(__dirname, '../../bin/pubsub-dashboard.mjs');

function run(env: NodeJS.ProcessEnv): Promise<{ code: number | null; stderr: string }> {
  return new Promise((res) => {
    const child = execFile(
      'node',
      [BIN],
      { env: { ...process.env, ...env } },
      (err, _stdout, stderr) => {
        const code =
          err && typeof (err as { code?: unknown }).code === 'number'
            ? (err as { code: number }).code
            : err
              ? 1
              : 0;
        res({ code, stderr });
      },
    );
    // Safety: if it somehow starts a server, kill it quickly.
    setTimeout(() => child.kill(), 4000);
  });
}

describe('bin Node-version guard (T049, T-CLI-005)', () => {
  it('exits 10 with the documented stderr line when Node < 20 (via override)', async () => {
    const { code, stderr } = await run({ PUBSUB_NODE_VERSION_OVERRIDE: 'v18.19.0' });
    expect(code).toBe(10);
    expect(stderr).toContain('Requires Node >= 20 LTS');
    expect(stderr).toContain('nvm install 20');
  });
});
