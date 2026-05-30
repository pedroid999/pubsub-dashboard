import { z } from 'zod';

export const SessionSchema = z.object({
  projectId: z.string().regex(/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/, 'must match GCP project ID format'),
  identity: z.string().min(1),
  bindAddress: z.literal('127.0.0.1'),
  port: z.number().int().min(1).max(65535),
  startedAt: z.string().datetime({ offset: true }),
  lastTraceId: z.string().uuid().nullable(),
  version: z.string().regex(/^\d+\.\d+\.\d+(?:-[\w.+-]+)?$/),
  nodeVersion: z.string().regex(/^v\d+\.\d+\.\d+/),
});

export type Session = z.infer<typeof SessionSchema>;
