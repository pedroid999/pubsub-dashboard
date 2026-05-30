import { describe, it, expect } from 'vitest';
import { Writable } from 'node:stream';
import { redactPaths } from '../../src/server/middleware/redact.js';
import { createLogger } from '../../src/server/middleware/trace.js';

function captureLogger(verbose: boolean) {
  const lines: string[] = [];
  const dest = new Writable({
    write(chunk, _enc, cb) {
      lines.push(chunk.toString());
      cb();
    },
  });
  const logger = createLogger({ level: 'info', verbose, destination: dest });
  return { logger, lines };
}

describe('redactPaths (T060, research.md R8)', () => {
  it('redacts payloads + credentials in normal mode', () => {
    const paths = redactPaths(false);
    expect(paths).toContain('*.message.data');
    expect(paths).toContain('*.authorization');
    expect(paths).toContain('*.credentials');
  });

  it('reveals payloads but still redacts credentials in verbose mode', () => {
    const paths = redactPaths(true);
    expect(paths).not.toContain('*.message.data');
    expect(paths).toContain('*.authorization');
    expect(paths).toContain('*.credentials');
  });
});

describe('createLogger redaction behaviour', () => {
  it('censors message.data and authorization in normal mode', () => {
    const { logger, lines } = captureLogger(false);
    logger.info({ msg: 'op', message: { data: 'SECRET-PAYLOAD' }, authorization: 'Bearer T' }, 'x');
    const out = lines.join('');
    expect(out).not.toContain('SECRET-PAYLOAD');
    expect(out).not.toContain('Bearer T');
    expect(out).toContain('[REDACTED]');
  });

  it('reveals message.data but keeps credentials redacted in verbose mode', () => {
    const { logger, lines } = captureLogger(true);
    logger.info({ message: { data: 'VISIBLE-PAYLOAD' }, credentials: 'sa-key' }, 'x');
    const out = lines.join('');
    expect(out).toContain('VISIBLE-PAYLOAD');
    expect(out).not.toContain('sa-key');
    expect(out).toContain('[REDACTED]');
  });
});
