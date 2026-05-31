# HTTP API Contracts: GCP Resource Browser

**Branch**: `002-gcp-resource-browser` | **Date**: 2026-05-31

Three new read-only endpoints added to the Hono server. All endpoints:
- Require an active ADC session (return `401` if ADC is invalid/expired).
- Return JSON with `Content-Type: application/json`.
- Include the request `traceId` in every response (success and error).
- Are registered in `buildServer()` via `registerProjects()` and `registerPubSub()`,
  following the extension contract in `docs/extension-points.md`.

---

## `GET /api/projects`

List all GCP projects accessible to the authenticated user.

**Auth**: ADC (via `google-auth-library`). No additional params.

**Request**: No body, no query parameters.

**Success `200`**:
```json
{
  "projects": [
    {
      "projectId":   "my-project-123",
      "displayName": "My Project",
      "state":       "ACTIVE"
    }
  ],
  "traceId": "abc-123"
}
```
Schema: `ProjectsResponseSchema & { traceId: string }`

**Error responses**:

| Status | `code` | When |
|--------|--------|------|
| 401    | `PERMISSION_DENIED` | ADC credentials expired or missing `resourcemanager.projects.list` permission |
| 429    | `QUOTA_EXCEEDED`    | CRM API quota exceeded |
| 504    | `TIMEOUT`           | All pages not received within 8 s |
| 500    | `INTERNAL_ERROR`    | Unexpected server error |

**Error body** (all non-2xx):
```json
{
  "code":      "QUOTA_EXCEEDED",
  "message":   "API quota exceeded: cloudresourcemanager.googleapis.com/read_requests_per_minute_per_project. Retry manually or wait for quota reset.",
  "traceId":   "abc-123",
  "quotaName": "cloudresourcemanager.googleapis.com/read_requests_per_minute_per_project"
}
```
Schema: `PubSubErrorSchema`

---

## `GET /api/projects/:projectId/topics`

List all Pub/Sub topics for a project.

**Path param**: `projectId` — the GCP project ID (e.g., `my-project-123`).
Validated as a non-empty string; returns `400` if blank.

**Request**: No body, no query parameters.

**Success `200`**:
```json
{
  "topics": [
    {
      "name":        "projects/my-project-123/topics/payments-topic",
      "displayName": "payments-topic"
    }
  ],
  "traceId": "abc-123"
}
```
Schema: `TopicsResponseSchema & { traceId: string }`

**Error responses**:

| Status | `code` | When |
|--------|--------|------|
| 400    | `INVALID_QUERY`     | `projectId` is empty or contains invalid characters |
| 401    | `PERMISSION_DENIED` | Missing `roles/pubsub.viewer` or `pubsub.topics.list` permission |
| 403    | `PERMISSION_DENIED` | IAM permission denied on the specified project |
| 404    | `NOT_FOUND`         | Project does not exist or is not accessible |
| 429    | `QUOTA_EXCEEDED`    | Pub/Sub API quota exceeded |
| 504    | `TIMEOUT`           | Full topic list not received within 8 s |
| 500    | `INTERNAL_ERROR`    | Unexpected error |

---

## `GET /api/projects/:projectId/subscriptions`

List all Pub/Sub subscriptions for a project.

**Path param**: `projectId` — same validation as `/topics`.

**Request**: No body, no query parameters.

**Success `200`**:
```json
{
  "subscriptions": [
    {
      "name":         "projects/my-project-123/subscriptions/payments-sub",
      "displayName":  "payments-sub",
      "topicName":    "projects/my-project-123/topics/payments-topic",
      "deliveryType": "pull"
    },
    {
      "name":         "projects/my-project-123/subscriptions/push-sub",
      "displayName":  "push-sub",
      "topicName":    "_deleted-topic_",
      "deliveryType": "push"
    }
  ],
  "traceId": "abc-123"
}
```
Schema: `SubscriptionsResponseSchema & { traceId: string }`

**Notes**:
- `topicName: "_deleted-topic_"` is the sentinel returned by the Pub/Sub API
  when the parent topic has been deleted. The UI renders this as "Topic deleted".
- Push endpoint URLs are intentionally excluded from the response body.

**Error responses**: Same status/code mapping as `/topics`.

---

## Common error behavior

- All errors follow `PubSubErrorSchema`; the client can discriminate on `code`.
- `PERMISSION_DENIED` (401/403): message includes the missing IAM permission
  or role name and a copy-pastable `gcloud` command to grant it.
- `QUOTA_EXCEEDED` (429): `quotaName` field is always populated.
- `TIMEOUT` (504): message includes the affected endpoint and suggests retrying
  or checking network connectivity to `*.googleapis.com`.
- The existing `app.all('/api/*')` catch-all in `buildServer` covers any
  unregistered sub-paths under `/api/projects/` with a `404 INVALID_QUERY`.

---

## Registration in `buildServer`

```ts
// src/server/server.ts (additions only — follows extension-points.md)
import { registerProjects } from './routes/projects.js';
import { registerPubSub }   from './routes/pubsub.js';

// Inside buildServer(), after registerDiagnostics():
registerProjects(app, { auth: deps.auth });
registerPubSub(app,   { auth: deps.auth });
```

`deps.auth` is the `GoogleAuth` instance injected by `boot.ts`, the same
credential chain already used by `registerSession`.
