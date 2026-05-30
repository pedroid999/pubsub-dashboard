import type { Hono } from 'hono';
import type { Logger } from 'pino';
import { createApp, type AppEnv } from './app.js';
import { hostGuard } from './middleware/host-guard.js';
import { cspMiddleware } from './middleware/csp.js';
import { createDiagnosticsBuffer, type DiagnosticsBuffer } from './middleware/capture.js';
import { registerHealth } from './routes/health.js';
import { registerSession, type GetSession } from './routes/session.js';
import { registerDiagnostics } from './routes/diagnostics.js';
import { registerStatic } from './static.js';

export interface BuildServerDeps {
  logger: Logger;
  port: number;
  clientDir: string;
  getSession: GetSession;
  startedAtMs?: number;
  verbose?: boolean;
  diagnostics?: DiagnosticsBuffer;
}

/**
 * Compose the full HTTP application: trace middleware (from createApp) +
 * loopback Host guard + API routes + an explicit unknown-`/api/*` 404 +
 * the static SPA fallback. Pure (no listening); driven by `app.request()`
 * in tests and by `boot.ts` at runtime.
 */
export function buildServer(deps: BuildServerDeps): Hono<AppEnv> {
  const app = createApp({ logger: deps.logger });
  const diagnostics =
    deps.diagnostics ?? createDiagnosticsBuffer({ verbose: deps.verbose ?? false });

  app.use('*', hostGuard());
  app.use('*', cspMiddleware());
  app.use('*', diagnostics.middleware());

  registerHealth(app, { startedAtMs: deps.startedAtMs ?? Date.now() });
  registerSession(app, { getSession: deps.getSession });
  registerDiagnostics(app, { buffer: diagnostics });

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
