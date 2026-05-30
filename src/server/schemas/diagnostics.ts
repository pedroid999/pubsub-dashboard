import { z } from 'zod';

const HeaderMap = z.record(z.string(), z.string());

export const DiagnosticsRecordSchema = z.object({
  traceId: z.string().uuid(),
  at: z.string().datetime({ offset: true }),
  request: z.object({
    method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD']),
    path: z.string().startsWith('/'),
    headers: HeaderMap,
    body: z.unknown(),
  }),
  response: z.object({
    status: z.number().int().min(100).max(599),
    headers: HeaderMap,
    body: z.unknown(),
    durationMs: z.number().nonnegative(),
  }),
  error: z
    .object({
      code: z.string(),
      message: z.string(),
    })
    .nullable(),
});

export type DiagnosticsRecord = z.infer<typeof DiagnosticsRecordSchema>;

export const DiagnosticsListSchema = z.array(DiagnosticsRecordSchema).max(50);

export type DiagnosticsList = z.infer<typeof DiagnosticsListSchema>;

export const DIAGNOSTICS_CAPACITY = 50 as const;
