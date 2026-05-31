import { z } from 'zod';

/** Publish ------------------------------------------------------------------ */

export const PublishRequestSchema = z.object({
  data: z.string().min(1, 'Message body must not be empty.'),
  attributes: z.record(z.string().min(1)).optional(),
});
export type PublishRequest = z.infer<typeof PublishRequestSchema>;

export const PublishResponseSchema = z.object({
  messageId: z.string(),
  traceId: z.string().uuid(),
});
export type PublishResponse = z.infer<typeof PublishResponseSchema>;

/** Pull --------------------------------------------------------------------- */

export const PullRequestSchema = z.object({
  maxMessages: z.number().int().min(1).max(10).optional(),
});
export type PullRequest = z.infer<typeof PullRequestSchema>;

export const ReceivedMessageSchema = z.object({
  messageId: z.string(),
  ackId: z.string(),
  data: z.string(),
  dataEncoding: z.enum(['utf-8', 'base64']),
  attributes: z.record(z.string()),
  publishTime: z.string(),
  deliveryAttempt: z.number().int().nullable(),
});
export type ReceivedMessage = z.infer<typeof ReceivedMessageSchema>;

export const PullResponseSchema = z.object({
  messages: z.array(ReceivedMessageSchema),
  traceId: z.string().uuid(),
});
export type PullResponse = z.infer<typeof PullResponseSchema>;

/** Acknowledge -------------------------------------------------------------- */

export const AckRequestSchema = z.object({
  ackIds: z.array(z.string().min(1)).min(1, 'ackIds must not be empty.'),
});
export type AckRequest = z.infer<typeof AckRequestSchema>;

export const AckResponseSchema = z.object({
  acknowledged: z.array(z.string()),
  expired: z.array(z.string()),
  traceId: z.string().uuid(),
});
export type AckResponse = z.infer<typeof AckResponseSchema>;
