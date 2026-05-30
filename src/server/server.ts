import type { Hono } from 'hono';
import type { Logger } from 'pino';
import { createApp, type AppEnv } from './app.js';
import { hostGuard } from './middleware/host-guard.js';
import { registerHealth } from './routes/health.js';
import { registerSession, type GetSession } from './routes/session.js';
import { registerStatic } from './static.js';

export interface BuildServerDeps {
  logger: Logger;
  port: number;
  clientDir: string;
  getSession: GetSession;
  startedAtMs?: number;
}

/**
 * Compose the full HTTP application: trace middleware (from createApp) +
 * loopback Host guard + API routes + an explicit unknown-`/api/*` 404 +
 * the static SPA fallback. Pure (no listening); driven by `app.request()`
 * in tests and by `boot.ts` at runtime.
 */
export function buildServer(deps: BuildServerDeps): Hono<AppEnv> {
  const app = createApp({ logger: deps.logger });

  app.use('*', hostGuard());

  registerHealth(app, { startedAtMs: deps.startedAtMs ?? Date.now() });
  registerSession(app, { getSession: deps.getSession });

  // Unknown API routes must 404 as JSON, never fall through to the SPA.
  app.all('/api/*', (c) =>
    c.json(
      {
        code: 'INVALID_QUERY' as const,
        message: `Unknown API route: ${c.req.path}`,
        traceId: c.var.traceId,
      },
      404,
    ),
  );

  registerStatic(app, { clientDir: deps.clientDir });

  return app;
}
