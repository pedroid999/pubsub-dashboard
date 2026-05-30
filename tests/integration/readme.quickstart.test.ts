import { describe, it, expect, beforeAll } from 'vitest';
import { execFile } from 'node:child_process';
import { createServer } from 'node:net';
import { existsSync, readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { extractQuickstart } from '../../scripts/extract-readme-quickstart.mjs';

const pExecFile = promisify(execFile);
const repoRoot = process.cwd();
const binPath = resolve(repoRoot, 'bin/pubsub-dashboard.mjs');

function freePort(): Promise<number> {
  return new Promise((res, rej) => {
    const srv = createServer();
    srv.once('error', rej);
    srv.listen(0, '127.0.0.1', () => {
      const addr = srv.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      srv.close(() => res(port));
    });
  });
}

interface RunResult {
  code: number;
  stdout: string;
  stderr: string;
}

async function runQuickstart(extraEnv: Record<string, string>): Promise<RunResult> {
  const script = extractQuickstart(readFileSync(resolve(repoRoot, 'README.md'), 'utf8'));
  const dir = mkdtempSync(join(tmpdir(), 'pubsub-qs-'));
  const file = join(dir, 'quickstart.sh');
  writeFileSync(file, script);
  try {
    const { stdout, stderr } = await pExecFile('bash', [file], {
      cwd: repoRoot,
      env: { ...process.env, ...extraEnv },
      timeout: 45000,
    });
    return { code: 0, stdout, stderr };
  } catch (err) {
    const e = err as { code?: number; stdout?: string; stderr?: string };
    return {
      code: typeof e.code === 'number' ? e.code : 1,
      stdout: e.stdout ?? '',
      stderr: e.stderr ?? '',
    };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe('README quickstart is executable end-to-end (T084, FR-019)', () => {
  beforeAll(async () => {
    if (!existsSync(resolve(repoRoot, 'dist/server/cli/run.js'))) {
      await pExecFile('npm', ['run', 'build'], { cwd: repoRoot, timeout: 240000 });
    }
  }, 240000);

  it('boots via the demo seam and reports a healthy server', async () => {
    const port = await freePort();
    const result = await runQuickstart({
      PUBSUB_BIN: `node ${binPath}`,
      PUBSUB_DEMO_PROJECT: 'demo-ci-project',
      PUBSUB_DEMO_IDENTITY: 'ci@demo.local',
      PORT: String(port),
    });
    expect(result.code, result.stderr).toBe(0);
    expect(result.stdout).toContain('pubsub-dashboard health: ok');
  }, 60000);

  it('FAILS when the bin is broken — proving the gate has teeth (T086)', async () => {
    const port = await freePort();
    const result = await runQuickstart({
      PUBSUB_BIN: `node ${binPath}`,
      PUBSUB_DEMO_PROJECT: 'demo-ci-project',
      PORT: String(port),
      // Force the Node-version guard to abort the bin (exit 10) → server never starts.
      PUBSUB_NODE_VERSION_OVERRIDE: '18',
    });
    expect(result.code).not.toBe(0);
    expect(result.stdout).not.toContain('pubsub-dashboard health: ok');
  }, 60000);
});
