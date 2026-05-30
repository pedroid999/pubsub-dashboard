import type { Hono } from 'hono';
import type { AppEnv } from '../app.js';
import type { HealthResponse } from '../schemas/health.js';

export interface HealthDeps {
  startedAtMs: number;
}

export function registerHealth(app: Hono<AppEnv>, deps: HealthDeps): void {
  app.get('/api/health', (c) => {
    const body: HealthResponse = {
      status: 'ok',
      uptimeMs: Math.max(0, Date.now() - deps.startedAtMs),
    };
    return c.json(body);
  });
}
