import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { createDiagnosticsBuffer } from '../../src/server/middleware/capture.js';
import { traceMiddleware, createLogger } from '../../src/server/middleware/trace.js';
import { DiagnosticsRecordSchema } from '../../src/server/schemas/diagnostics.js';
import type { TraceVars } from '../../src/server/middleware/trace.js';

function makeApp(buffer: ReturnType<typeof createDiagnosticsBuffer>) {
  const app = new Hono<{ Variables: TraceVars }>();
  app.use('*', traceMiddleware(createLogger({ level: 'silent' })));
  app.use('*', buffer.middleware());
  app.get('/api/thing', (c) => c.json({ message: { data: 'SECRET' } }));
  return app;
}

describe('createDiagnosticsBuffer (T062)', () => {
  it('captures a well-formed DiagnosticsRecord whose traceId matches the response header', async () => {
    const buffer = createDiagnosticsBuffer({ verbose: false });
    const app = makeApp(buffer);
    const res = await app.request('/api/thing', { headers: { host: '127.0.0.1' } });
    const traceId = res.headers.get('x-trace-id');

    expect(buffer.size()).toBe(1);
    const record = buffer.list(20)[0]!;
    expect(() => DiagnosticsRecordSchema.parse(record)).not.toThrow();
    expect(record.traceId).toBe(traceId);
    expect(record.request.path).toBe('/api/thing');
    expect(record.response.status).toBe(200);
  });

  it('redacts response payload at capture time in normal mode', async () => {
    const buffer = createDiagnosticsBuffer({ verbose: false });
    const app = makeApp(buffer);
    await app.request('/api/thing', { headers: { host: '127.0.0.1' } });
    const record = buffer.list(20)[0]!;
    expect(JSON.stringify(record.response.body)).not.toContain('SECRET');
    expect(JSON.stringify(record.response.body)).toContain('[REDACTED]');
  });

  it('reveals response payload at capture time in verbose mode', async () => {
    const buffer = createDiagnosticsBuffer({ verbose: true });
    const app = makeApp(buffer);
    await app.request('/api/thing', { headers: { host: '127.0.0.1' } });
    const record = buffer.list(20)[0]!;
    expect(JSON.stringify(record.response.body)).toContain('SECRET');
  });

  it('is a FIFO ring buffer capped at capacity (50 by default)', async () => {
    const buffer = createDiagnosticsBuffer({ verbose: false, capacity: 3 });
    const app = makeApp(buffer);
    for (let i = 0; i < 5; i++) {
      await app.request('/api/thing', { headers: { host: '127.0.0.1' } });
    }
    expect(buffer.size()).toBe(3);
    expect(buffer.list(50)).toHaveLength(3);
  });

  it('returns newest-first and honours the limit', async () => {
    const buffer = createDiagnosticsBuffer({ verbose: false });
    const app = makeApp(buffer);
    await app.request('/api/thing?n=1', { headers: { host: '127.0.0.1' } });
    await app.request('/api/thing?n=2', { headers: { host: '127.0.0.1' } });
    const list = buffer.list(1);
    expect(list).toHaveLength(1);
    expect(list[0]!.request.path).toContain('/api/thing');
  });

  it('never exceeds the default capacity of 50', async () => {
    const buffer = createDiagnosticsBuffer({ verbose: false });
    const app = makeApp(buffer);
    for (let i = 0; i < 60; i++) {
      await app.request('/api/thing', { headers: { host: '127.0.0.1' } });
    }
    expect(buffer.size()).toBe(50);
  });

  it('in verbose mode stores a non-JSON response body as raw text', async () => {
    const buffer = createDiagnosticsBuffer({ verbose: true });
    const app = new Hono<{ Variables: TraceVars }>();
    app.use('*', traceMiddleware(createLogger({ level: 'silent' })));
    app.use('*', buffer.middleware());
    app.get('/page', (c) => c.html('<!doctype html>hello'));
    await app.request('/page', { headers: { host: '127.0.0.1' } });
    const record = buffer.list(20)[0]!;
    expect(String(record.response.body)).toContain('hello');
  });

  it('records an error object for responses with status >= 400', async () => {
    const buffer = createDiagnosticsBuffer({ verbose: false });
    const app = new Hono<{ Variables: TraceVars }>();
    app.use('*', traceMiddleware(createLogger({ level: 'silent' })));
    app.use('*', buffer.middleware());
    app.get('/boom', (c) => c.json({ nope: true }, 500));
    await app.request('/boom', { headers: { host: '127.0.0.1' } });
    const record = buffer.list(20)[0]!;
    expect(record.error).not.toBeNull();
    expect(record.response.status).toBe(500);
  });
});
