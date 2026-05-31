import { z } from 'zod';

export const GcpProjectSchema = z.object({
  projectId: z.string(),
  displayName: z.string(),
  state: z.enum(['ACTIVE', 'DELETE_REQUESTED', 'DELETE_IN_PROGRESS']),
});
export type GcpProject = z.infer<typeof GcpProjectSchema>;

export const ProjectsResponseSchema = z.object({
  projects: z.array(GcpProjectSchema),
  traceId: z.string().uuid(),
});
export type ProjectsResponse = z.infer<typeof ProjectsResponseSchema>;

export const TopicSchema = z.object({
  name: z.string(),
  displayName: z.string(),
});
export type Topic = z.infer<typeof TopicSchema>;

export const TopicsResponseSchema = z.object({
  topics: z.array(TopicSchema),
  traceId: z.string().uuid(),
});
export type TopicsResponse = z.infer<typeof TopicsResponseSchema>;

export const SubscriptionSchema = z.object({
  name: z.string(),
  displayName: z.string(),
  topicName: z.string(),
  deliveryType: z.enum(['pull', 'push']),
});
export type Subscription = z.infer<typeof SubscriptionSchema>;

export const SubscriptionsResponseSchema = z.object({
  subscriptions: z.array(SubscriptionSchema),
  traceId: z.string().uuid(),
});
export type SubscriptionsResponse = z.infer<typeof SubscriptionsResponseSchema>;

export const PubSubErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  traceId: z.string().uuid(),
  quotaName: z.string().optional(),
});
export type PubSubError = z.infer<typeof PubSubErrorSchema>;
