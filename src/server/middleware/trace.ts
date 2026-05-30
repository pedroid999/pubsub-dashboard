import type { MiddlewareHandler } from 'hono';
import { pino, type Logger, type LoggerOptions, type DestinationStream } from 'pino';
import { randomUUID } from 'node:crypto';
import { redactPaths, REDACT_CENSOR } from './redact.js';

export interface CreateLoggerOptions {
  level?: LoggerOptions['level'];
  verbose?: boolean;
  destination?: DestinationStream;
}

export function createLogger(opts: CreateLoggerOptions = {}): Logger {
  const options: LoggerOptions = {
    level: opts.level ?? 'info',
    base: { app: 'pubsub-dashboard' },
    redact: {
      paths: redactPaths(opts.verbose ?? false),
      censor: REDACT_CENSOR,
      remove: false,
    },
  };
  return opts.destination ? pino(options, opts.destination) : pino(options);
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
