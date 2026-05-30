import { performance } from 'node:perf_hooks';
import type { MiddlewareHandler } from 'hono';
import type { TraceVars } from './trace.js';
import { REDACT_CENSOR } from './redact.js';
import {
  DIAGNOSTICS_CAPACITY,
  type DiagnosticsRecord,
  type DiagnosticsList,
} from '../schemas/diagnostics.js';

const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'] as const;
type HttpMethod = (typeof HTTP_METHODS)[number];

function asMethod(method: string): HttpMethod {
  return (HTTP_METHODS as readonly string[]).includes(method) ? (method as HttpMethod) : 'GET';
}

function headersToObject(headers: Headers): Record<string, string> {
  const out: Record<string, string> = {};
  headers.forEach((value, key) => {
    out[key] = value;
  });
  return out;
}

function tryParseJson(text: string): unknown {
  if (text === '') return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

export interface DiagnosticsBufferOptions {
  verbose: boolean;
  capacity?: number;
}

export interface DiagnosticsBuffer {
  middleware(): MiddlewareHandler<{ Variables: TraceVars }>;
  /** Newest-first, capped at `limit`. */
  list(limit: number): DiagnosticsList;
  size(): number;
}

/**
 * In-memory FIFO ring buffer of recent operations powering `/api/diagnostics`
 * and the in-UI Diagnostics panel (FR-009). Redaction is applied AT CAPTURE
 * TIME (not read time): records captured in normal mode never reveal payloads
 * later, even if the process is somehow switched to verbose.
 */
export function createDiagnosticsBuffer(opts: DiagnosticsBufferOptions): DiagnosticsBuffer {
  const capacity = opts.capacity ?? DIAGNOSTICS_CAPACITY;
  const records: DiagnosticsRecord[] = [];

  function push(record: DiagnosticsRecord): void {
    records.push(record);
    if (records.length > capacity) {
      records.splice(0, records.length - capacity);
    }
  }

  const middleware: MiddlewareHandler<{ Variables: TraceVars }> = async (c, next) => {
    const start = performance.now();
    await next();
    const durationMs = performance.now() - start;

    let responseBody: unknown = REDACT_CENSOR;
    if (opts.verbose) {
      try {
        responseBody = tryParseJson(await c.res.clone().text());
      } catch {
        responseBody = '[unreadable]';
      }
    }

    push({
      traceId: c.var.traceId,
      at: new Date().toISOString(),
      request: {
        method: asMethod(c.req.method),
        path: c.req.path,
        headers: headersToObject(c.req.raw.headers),
        body: opts.verbose ? null : REDACT_CENSOR,
      },
      response: {
        status: c.res.status,
        headers: headersToObject(c.res.headers),
        body: responseBody,
        durationMs,
      },
      error: c.res.status >= 400 ? { code: String(c.res.status), message: 'request failed' } : null,
    });
  };

  return {
    middleware: () => middleware,
    list: (limit: number): DiagnosticsList => records.slice(-limit).reverse(),
    size: () => records.length,
  };
}
