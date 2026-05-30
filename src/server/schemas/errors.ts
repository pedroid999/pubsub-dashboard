import { z } from 'zod';

export const ErrorCode = z.enum([
  'ADC_MISSING',
  'GCLOUD_MISSING',
  'NO_ACTIVE_PROJECT',
  'INVALID_QUERY',
  'INTERNAL',
]);
export type ErrorCodeT = z.infer<typeof ErrorCode>;

export const ErrorResponseSchema = z.object({
  code: ErrorCode,
  message: z.string().min(1),
  remediation: z.string().min(1).optional(),
  traceId: z.string().uuid(),
});

export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;
