import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { createLogger, traceMiddleware } from '../../src/server/middleware/trace.js';

describe('traceMiddleware', () => {
  it('mints a UUIDv4 trace id and attaches it as x-trace-id response header', async () => {
    const app = new Hono();
    app.use('*', traceMiddleware(createLogger({ level: 'silent' })));
    app.get('/', (c) => c.text('ok'));

    const res = await app.request('/');
    const traceId = res.headers.get('x-trace-id');
    expect(traceId).toBeTruthy();
    expect(traceId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('mints a different trace id per request', async () => {
    const app = new Hono();
    app.use('*', traceMiddleware(createLogger({ level: 'silent' })));
    app.get('/', (c) => c.text('ok'));

    const a = (await app.request('/')).headers.get('x-trace-id');
    const b = (await app.request('/')).headers.get('x-trace-id');
    expect(a).not.toBe(b);
  });

  it('exposes a typed logger on the context (c.var.logger)', async () => {
    const app = new Hono<{ Variables: { logger: ReturnType<typeof createLogger> } }>();
    app.use('*', traceMiddleware(createLogger({ level: 'silent' })));
    app.get('/', (c) => {
      expect(typeof c.var.logger.info).toBe('function');
      return c.text('ok');
    });
    await app.request('/');
  });
});

describe('createLogger', () => {
  it('returns a pino instance with the requested level', () => {
    const logger = createLogger({ level: 'debug' });
    expect(logger.level).toBe('debug');
  });
});
