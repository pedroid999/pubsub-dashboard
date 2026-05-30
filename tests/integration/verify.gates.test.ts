import { describe, it, expect } from 'vitest';
import { ESLint } from 'eslint';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtempSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const pExecFile = promisify(execFile);

describe('quality gate: lint has teeth (T077)', () => {
  it('flags an unused variable in src/ as an error', async () => {
    const eslint = new ESLint();
    const [result] = await eslint.lintText('const unusedVar = 42;\n', {
      filePath: 'src/__gate_fixture__.ts',
    });
    expect(result!.errorCount).toBeGreaterThan(0);
  });

  it('flags any read of process.env.GOOGLE_CLOUD_PROJECT (clarification gate, T073)', async () => {
    const eslint = new ESLint();
    const [result] = await eslint.lintText('const p = process.env.GOOGLE_CLOUD_PROJECT;\n', {
      filePath: 'src/__gate_fixture__.ts',
    });
    const messages = result!.messages.map((m) => m.message).join(' ');
    expect(result!.errorCount).toBeGreaterThan(0);
    expect(messages).toContain('GOOGLE_CLOUD_PROJECT');
  });
});

describe('quality gate: typecheck has teeth (T078)', () => {
  it('fails tsc on a deliberate type error', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'pubsub-tsc-'));
    const file = join(dir, 'bad.ts');
    writeFileSync(file, 'const n: number = "not a number";\nexport {};\n');
    try {
      await pExecFile('npx', ['tsc', '--noEmit', '--strict', file]);
      expect.unreachable('tsc should have failed on the type error');
    } catch (err) {
      // execFile rejects with a non-zero exit code → the gate caught the error.
      expect((err as { code?: number }).code).toBeTypeOf('number');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 30000);
});

describe('quality gate: coverage threshold is wired at 90 (T079)', () => {
  it('vitest.config.ts pins line and branch thresholds to 90', () => {
    const config = readFileSync('vitest.config.ts', 'utf8');
    expect(config).toMatch(/lines:\s*90/);
    expect(config).toMatch(/branches:\s*90/);
  });
});
