# Data Model: GCP Resource Browser

**Branch**: `002-gcp-resource-browser` | **Date**: 2026-05-31

Canonical zod schemas live in `src/server/schemas/pubsub.ts`. TypeScript types
are inferred from schemas — the schema IS the source of truth; no duplicate type
declarations.

---

## Server-side schemas (`src/server/schemas/pubsub.ts`)

### GcpProject

```ts
export const GcpProjectSchema = z.object({
  projectId:   z.string(),          // e.g. "my-project-123"
  displayName: z.string(),          // e.g. "My Project"
  state:       z.enum(['ACTIVE', 'DELETE_REQUESTED', 'DELETE_IN_PROGRESS']),
});
export type GcpProject = z.infer<typeof GcpProjectSchema>;

export const ProjectsResponseSchema = z.object({
  projects: z.array(GcpProjectSchema),
});
export type ProjectsResponse = z.infer<typeof ProjectsResponseSchema>;
```

**Source**: Cloud Resource Manager v3 `GET /v3/projects` response fields
`projectId`, `displayName`, `state`.

**Notes**:
- `state` is surfaced so the UI can visually flag non-`ACTIVE` projects.
- `parent` (folder/org hierarchy) is intentionally omitted in v1 to keep the UI simple.

---

### Topic

```ts
export const TopicSchema = z.object({
  name:        z.string(),   // full resource path: "projects/{proj}/topics/{topic}"
  displayName: z.string(),   // short name extracted from `name` (last segment)
});
export type Topic = z.infer<typeof TopicSchema>;

export const TopicsResponseSchema = z.object({
  topics: z.array(TopicSchema),
});
export type TopicsResponse = z.infer<typeof TopicsResponseSchema>;
```

**Source**: `@google-cloud/pubsub` `pubsub.getTopics()` — each item is a
`Topic` object; `topic.name` is the full resource path.

**Notes**:
- `displayName` is derived server-side: `name.split('/').at(-1) ?? name`.
- Message retention, schema config, and labels are excluded from v1 response.

---

### Subscription

```ts
export const SubscriptionSchema = z.object({
  name:         z.string(),        // "projects/{proj}/subscriptions/{sub}"
  displayName:  z.string(),        // short name (last segment of `name`)
  topicName:    z.string(),        // full resource path of parent topic
                                   // or "_deleted-topic_" if topic was deleted
  deliveryType: z.enum(['pull', 'push']),
});
export type Subscription = z.infer<typeof SubscriptionSchema>;

export const SubscriptionsResponseSchema = z.object({
  subscriptions: z.array(SubscriptionSchema),
});
export type SubscriptionsResponse = z.infer<typeof SubscriptionsResponseSchema>;
```

**Source**: `@google-cloud/pubsub` `pubsub.getSubscriptions()`.

**Notes**:
- `deliveryType`: `'push'` if `sub.metadata?.pushConfig?.pushEndpoint` is a
  non-empty string, otherwise `'pull'`.
- Push endpoint URL is deliberately NOT included in the response (privacy/security).
- `topicName === '_deleted-topic_'` is the sentinel value returned by the Pub/Sub
  API when the parent topic has been deleted; the UI renders this as
  "Topic deleted" with a warning indicator.

---

### API Error shape

```ts
export const PubSubErrorSchema = z.object({
  code:       z.string(),           // e.g. "PERMISSION_DENIED", "QUOTA_EXCEEDED", "NOT_FOUND", "TIMEOUT"
  message:    z.string(),           // human-readable, actionable text
  traceId:    z.string(),           // propagated from pino trace middleware
  quotaName:  z.string().optional(), // present only when code === "QUOTA_EXCEEDED"
});
export type PubSubError = z.infer<typeof PubSubErrorSchema>;
```

**HTTP status → error code mapping**:

| HTTP status | `code` | `quotaName` present |
|-------------|--------|---------------------|
| 401 / 403   | `PERMISSION_DENIED` | No |
| 429         | `QUOTA_EXCEEDED`    | Yes — from GCP `ErrorInfo.metadata.quota_metric` |
| 404         | `NOT_FOUND`         | No |
| 504 / timeout | `TIMEOUT`         | No |
| 5xx         | `INTERNAL_ERROR`   | No |

---

## Client-side state (`src/client/lib/resourceContext.ts`)

### ResourceContext

```ts
// Per-project selection state
interface ProjectContext {
  selectedTopicName?: string;        // full resource path or undefined
  selectedSubscriptionName?: string; // full resource path or undefined
}

// Reducer state
interface ResourceContextState {
  activeProjectId?: string;
  contextMap: Map<string, ProjectContext>; // projectId → ProjectContext
}

// Actions
type ResourceContextAction =
  | { type: 'SELECT_PROJECT';      projectId: string }
  | { type: 'SELECT_TOPIC';        projectId: string; topicName: string }
  | { type: 'DESELECT_TOPIC';      projectId: string }
  | { type: 'SELECT_SUBSCRIPTION'; projectId: string; subscriptionName: string }
  | { type: 'DESELECT_SUBSCRIPTION'; projectId: string }
  | { type: 'NAVIGATE_BACK' };     // clears activeProjectId, preserves contextMap
```

**Invariants**:
- `contextMap` entries are never removed during a session — navigating away from
  a project does NOT clear its entry.
- `SELECT_PROJECT` sets `activeProjectId` and initialises an empty `ProjectContext`
  in `contextMap` if the key doesn't exist yet.
- `NAVIGATE_BACK` sets `activeProjectId` to `undefined`; `contextMap` is unchanged.

---

## Entity relationships

```
GcpProject  (1) ──────────── (N)  Topic
            (1) ──────────── (N)  Subscription
                                      │
Subscription (N) ─────────── (1)  Topic   [via topicName foreign key]

ResourceContextState
  └── contextMap: Map<projectId, {selectedTopicName?, selectedSubscriptionName?}>
```

---

## State transitions for ResourceContext

```
Initial state
  activeProjectId: undefined
  contextMap: {}

─── SELECT_PROJECT(projectId) ───────────────────────────────────────────────►
  activeProjectId: projectId
  contextMap: { [projectId]: {} }   (if not already present)

─── SELECT_TOPIC(projectId, topicName) ──────────────────────────────────────►
  contextMap[projectId].selectedTopicName = topicName

─── SELECT_SUBSCRIPTION(projectId, subscriptionName) ────────────────────────►
  contextMap[projectId].selectedSubscriptionName = subscriptionName

─── NAVIGATE_BACK ───────────────────────────────────────────────────────────►
  activeProjectId: undefined
  contextMap: unchanged   ← per-project context is preserved

─── SELECT_PROJECT(differentProjectId) ─────────────────────────────────────►
  activeProjectId: differentProjectId
  contextMap[originalProjectId]: unchanged (previous selection preserved)
  contextMap[differentProjectId]: {} or existing entry restored
```
