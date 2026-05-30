import type { Hono } from 'hono';
import type { AppEnv } from '../app.js';
import type { Session } from '../schemas/session.js';
import type { ErrorResponse } from '../schemas/errors.js';
import { AdcMissingError } from '../auth/errors.js';

export type GetSession = (traceId: string) => Promise<Session>;

export interface SessionDeps {
  getSession: GetSession;
}

export function registerSession(app: Hono<AppEnv>, deps: SessionDeps): void {
  app.get('/api/session', async (c) => {
    const traceId = c.var.traceId;
    try {
      const session = await deps.getSession(traceId);
      return c.json(session);
    } catch (err) {
      if (err instanceof AdcMissingError) {
        const body: ErrorResponse = {
          code: 'ADC_MISSING',
          message: err.message,
          remediation: 'gcloud auth application-default login',
          traceId,
        };
        return c.json(body, 503);
      }
      throw err;
    }
  });
}
