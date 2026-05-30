import { Hono } from 'hono';
import type { Logger } from 'pino';
import { traceMiddleware, type TraceVars } from './middleware/trace.js';

export interface CreateAppDeps {
  logger: Logger;
}

export type AppEnv = { Variables: TraceVars };

/**
 * Pure factory: no I/O, no signal handlers, no port binding. The returned
 * Hono instance can be exercised in tests via `app.request(path, init)`.
 *
 * Routes are intentionally NOT registered here in PR #1 — US1 (Phase 3)
 * adds /api/health, /api/session and /api/diagnostics on top of this factory.
 */
export function createApp(deps: CreateAppDeps): Hono<AppEnv> {
  const app = new Hono<AppEnv>();
  app.use('*', traceMiddleware(deps.logger));
  return app;
}
