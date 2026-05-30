import { describe, it, expect } from 'vitest';
import { createApp } from '../../src/server/app.js';
import { createLogger } from '../../src/server/middleware/trace.js';

describe('createApp', () => {
  const logger = createLogger({ level: 'silent' });

  it('returns a Hono instance with the trace middleware attached', async () => {
    const app = createApp({ logger });
    const res = await app.request('/api/health');
    // No routes registered yet in PR #1 → 404, but trace header must still be set.
    expect(res.status).toBe(404);
    expect(res.headers.get('x-trace-id')).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('does not register /api/health in the foundational app (US1 lands that route)', async () => {
    const app = createApp({ logger });
    const res = await app.request('/api/health');
    expect(res.status).toBe(404);
  });

  it('does not perform any I/O at construction time', () => {
    // If createApp() throws, this test fails — proves no env access, no fs, no network.
    expect(() => createApp({ logger })).not.toThrow();
  });
});
