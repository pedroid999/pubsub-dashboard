import { z } from 'zod';

export const HealthResponseSchema = z.object({
  status: z.literal('ok'),
  uptimeMs: z.number().int().nonnegative(),
});

export type HealthResponse = z.infer<typeof HealthResponseSchema>;
