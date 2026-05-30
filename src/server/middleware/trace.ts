import type { MiddlewareHandler } from 'hono';
import { pino, type Logger, type LoggerOptions } from 'pino';
import { randomUUID } from 'node:crypto';

export interface CreateLoggerOptions {
  level?: LoggerOptions['level'];
}

export function createLogger(opts: CreateLoggerOptions = {}): Logger {
  return pino({
    level: opts.level ?? 'info',
    base: { app: 'pubsub-dashboard' },
    redact: {
      paths: ['*.message.data', '*.authorization', '*.credentials', 'req.headers.authorization'],
      censor: '[REDACTED]',
      remove: false,
    },
  });
}

export type TraceVars = {
  traceId: string;
  logger: Logger;
};

/**
 * Per-request middleware: mints a UUIDv4 trace id, attaches a child logger
 * keyed by it to `c.var.logger`, and emits `x-trace-id` on the response.
 */
export function traceMiddleware(rootLogger: Logger): MiddlewareHandler<{ Variables: TraceVars }> {
  return async (c, next) => {
    const traceId = randomUUID();
    const childLogger = rootLogger.child({ traceId });
    c.set('traceId', traceId);
    c.set('logger', childLogger);
    c.header('x-trace-id', traceId);
    await next();
  };
}
