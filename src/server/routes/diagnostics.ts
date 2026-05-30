import { z } from 'zod';
import type { Hono } from 'hono';
import type { AppEnv } from '../app.js';
import type { DiagnosticsBuffer } from '../middleware/capture.js';
import type { ErrorResponse } from '../schemas/errors.js';

const LimitSchema = z.coerce.number().int().min(1).max(50);

export interface DiagnosticsDeps {
  buffer: DiagnosticsBuffer;
}

export function registerDiagnostics(app: Hono<AppEnv>, deps: DiagnosticsDeps): void {
  app.get('/api/diagnostics', (c) => {
    const raw = c.req.query('limit');
    if (raw === undefined) {
      return c.json(deps.buffer.list(20));
    }
    const parsed = LimitSchema.safeParse(raw);
    if (!parsed.success) {
      const body: ErrorResponse = {
        code: 'INVALID_QUERY',
        message: 'limit must be an integer between 1 and 50',
        traceId: c.var.traceId,
      };
      return c.json(body, 400);
    }
    return c.json(deps.buffer.list(parsed.data));
  });
}
