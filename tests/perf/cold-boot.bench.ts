/**
 * Cold-boot + first-API-call performance harness (SC-001, SC-002).
 *
 * NOT part of `npm run verify` (environment-dependent). Run manually or in a
 * nightly job: `npm run bench`. Spawns the built bin via the demo seam (no
 * gcloud needed), measures time from spawn to a healthy `/api/health`, and
 * asserts p95 budgets. Exits non-zero if a budget is exceeded.
 */
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';

const RUNS = Number(process.env.BENCH_RUNS ?? 20);
const BOOT_P95_BUDGET_MS = 3000; // SC-001
const FIRST_CALL_P95_BUDGET_MS = 1000; // SC-002
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

interface Sample {
  bootMs: number;
  firstCallMs: number;
}

async function oneRun(port: number): Promise<Sample> {
  const start = performance.now();
  const child = spawn('node', [binPath, '--port', String(port)], {
    cwd: repoRoot,
    env: {
      ...process.env,
      PUBSUB_DEMO_PROJECT: 'bench-project',
      PUBSUB_DEMO_IDENTITY: 'bench@demo.local',
    },
    stdio: 'ignore',
  });

  try {
    // Time to first successful health response = cold boot.
    let bootMs = 0;
    for (;;) {
      try {
        const res = await fetch(`http://127.0.0.1:${port}/api/health`);
        if (res.ok) {
          bootMs = performance.now() - start;
          break;
        }
      } catch {
        /* server not ready yet */
      }
      if (performance.now() - start > 15000) {
        throw new Error('boot timed out (>15s)');
      }
      await new Promise((r) => setTimeout(r, 20));
    }

    // First "real" API call latency (session endpoint).
    const callStart = performance.now();
    const sessionRes = await fetch(`http://127.0.0.1:${port}/api/session`);
    if (!sessionRes.ok) {
      throw new Error(`/api/session returned ${sessionRes.status}`);
    }
    const firstCallMs = performance.now() - callStart;

    return { bootMs, firstCallMs };
  } finally {
    child.kill('SIGINT');
  }
}

function p95(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.ceil(0.95 * sorted.length) - 1);
  return sorted[idx]!;
}

async function main(): Promise<void> {
  if (!existsSync(resolve(repoRoot, 'dist/server/cli/run.js'))) {
    throw new Error('dist not found — run `npm run build` before benchmarking.');
  }

  const samples: Sample[] = [];
  for (let i = 0; i < RUNS; i++) {
    const port = await freePort();
    samples.push(await oneRun(port));
  }

  const bootP95 = p95(samples.map((s) => s.bootMs));
  const callP95 = p95(samples.map((s) => s.firstCallMs));

  process.stdout.write(
    `cold-boot p95: ${bootP95.toFixed(0)} ms (budget ${BOOT_P95_BUDGET_MS} ms)\n` +
      `first-call p95: ${callP95.toFixed(0)} ms (budget ${FIRST_CALL_P95_BUDGET_MS} ms)\n`,
  );

  const failures: string[] = [];
  if (bootP95 > BOOT_P95_BUDGET_MS) failures.push(`cold-boot p95 ${bootP95.toFixed(0)}ms > budget`);
  if (callP95 > FIRST_CALL_P95_BUDGET_MS)
    failures.push(`first-call p95 ${callP95.toFixed(0)}ms > budget`);

  if (failures.length > 0) {
    process.stderr.write(`PERF BUDGET EXCEEDED:\n- ${failures.join('\n- ')}\n`);
    process.exit(1);
  }
  process.stdout.write('perf budgets OK\n');
}

void main();
