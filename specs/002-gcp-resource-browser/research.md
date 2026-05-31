# Research: GCP Resource Browser

**Branch**: `002-gcp-resource-browser` | **Date**: 2026-05-31

All NEEDS CLARIFICATION items from `plan.md` Technical Context resolved below.

---

## R1 — Pub/Sub SDK: `@google-cloud/pubsub` vs direct REST for topic/subscription listing

**Decision**: Use `@google-cloud/pubsub` official SDK.

**Rationale**: The constitution (`Technology Constraints`) mandates
`@google-cloud/pubsub` as the only supported Pub/Sub client. Beyond compliance,
the SDK handles:
- Automatic proto-to-JS unmarshalling for topic/subscription responses.
- Built-in retry with exponential backoff on transient errors (5xx).
- Credential refresh via the `google-auth-library` credential chain already
  in use by the project.
- Pagination via `autoPaginate: true` (default) — returns full lists without
  manual page-token iteration.

**Alternatives considered**:
- **Direct REST to `pubsub.googleapis.com`**: Avoids the SDK but requires
  manual proto-JSON deserialization, manual retry logic, and manual pagination.
  More fragile and more code to maintain. Rejected.

**Consequence**: `@google-cloud/pubsub` is added as a runtime dependency.
PR description MUST include this justification per Principle V.

---

## R2 — Project listing API: `@google-cloud/resource-manager` vs CRM v3 REST via `google-auth-library`

**Decision**: Use the Cloud Resource Manager v3 REST API directly, authenticated
via `google-auth-library` (already a runtime dependency).

**Rationale**: The CRM v3 REST API is a standard JSON/REST endpoint:
`GET https://cloudresourcemanager.googleapis.com/v3/projects`. The response is
plain JSON (not proto-binary), so no SDK unmarshalling is needed. Using
`google-auth-library`'s `GoogleAuth.getIdTokenClient()` or
`GoogleAuth.getAccessToken()` + `fetch` (Node ≥ 18 built-in) is sufficient and
adds zero new dependencies. Pagination is handled with a simple `nextPageToken`
loop.

**Alternatives considered**:
- **`@google-cloud/resource-manager`**: Would work but adds another SDK
  dependency for a single REST call. Rejected per Principle V (YAGNI).

**Implementation note**: Use `google-auth-library`'s `GoogleAuth` to obtain an
access token, then call the CRM v3 REST endpoint with `fetch`. Parse and validate
the response with the `GcpProject` zod schema before returning.

---

## R3 — `@google-cloud/pubsub` client lifecycle: one client per request vs singleton

**Decision**: Instantiate a new `PubSub` client per incoming request.

**Rationale**: Each request can target a different `projectId`. The `PubSub`
constructor accepts `{ projectId }` — a singleton would need to be re-configured
per project, which is not thread-safe or clean. Per-request instantiation is
stateless, GC-friendly, and avoids any cross-request state leakage.
For a developer tool with at most a few dozen requests per session, the
instantiation overhead (~1 ms) is negligible compared to the network RTT to
the Pub/Sub API.

**Alternatives considered**:
- **`Map<projectId, PubSub>` singleton cache**: Reduces instantiation overhead
  but introduces a persistent in-process cache that could hold stale credentials
  after token refresh. Rejected for simplicity; revisit if profiling shows
  measurable overhead.

---

## R4 — Client-side state management for ResourceContext (per-project hashmap)

**Decision**: React Context + `useReducer`. No external state management library.

**Rationale**: The ResourceContext state shape is simple:
`Map<projectId, {selectedTopicName?: string, selectedSubscriptionName?: string}>`.
Three action types suffice: `SELECT_TOPIC`, `SELECT_SUBSCRIPTION`, `CLEAR_PROJECT`.
`useReducer` handles this cleanly with zero new dependencies. The context is
scoped to the React tree; no cross-component framework is needed.

**Alternatives considered**:
- **Zustand**: Good ergonomics but adds a runtime dependency for a 20-line
  reducer. Rejected per Principle V (YAGNI).
- **Plain `useState` in `App.tsx`**: Would prop-drill the context through multiple
  levels. Rejected for maintainability.

---

## R5 — Client-side filter implementation

**Decision**: Native `String.prototype.toLowerCase().includes()` applied inside
a `useMemo`. No fuzzy search library.

**Rationale**: GCP resource names are structured (`projects/my-proj/topics/my-topic`)
with predictable patterns. Users search by exact substring (e.g., `"payments"` to
find `payments-topic`). Fuzzy matching would produce confusing results for
structured names. The simple approach is also O(n) on the already-small list with
zero dependency surface.

For match highlighting: split the item's display name on the matched substring
(case-insensitive) and wrap the matching segment in a `<mark>` element. Custom
render function, ~15 lines, no library needed.

**Alternatives considered**:
- **`fuse.js`**: Fuzzy search — wrong UX for structured names. Rejected.
- **`minisearch`**: Full-text search index — overkill for <500 items. Rejected.

---

## R6 — Quota-exceeded (429) error detection and message format

**Decision**: Inspect the HTTP status (429) and, if available, the
`error.details[].@type === "type.googleapis.com/google.rpc.ErrorInfo"` field
from the GCP error body. The `reason` field in `ErrorInfo` typically contains
the quota metric name (e.g., `"RATE_LIMIT_EXCEEDED"`) and `metadata.quota_metric`
contains the full metric path (e.g., `"pubsub.googleapis.com/default"`).

Map this to a user-facing message: `"API quota exceeded: {quota_metric}. Retry manually or wait for quota reset."`.

For `@google-cloud/pubsub` SDK errors, inspect the `err.code` (gRPC status codes:
`8 = RESOURCE_EXHAUSTED`) and `err.details` string.

**Alternatives considered**:
- **Generic 429 message without quota name**: Simpler but violates FR-025
  (must identify the quota). Rejected.

---

## R7 — Subscription delivery type: surface pull/push in UI?

**Decision**: Surface delivery type in the subscription list item as a badge
(`Pull` / `Push`), derived from whether the subscription has a `pushConfig.pushEndpoint`
set. This is read from the `@google-cloud/pubsub` subscription metadata without
an extra API call (returned in the `getSubscriptions()` response).

**Note**: Push endpoint URLs are NOT displayed in the UI to avoid exposing
potentially sensitive infrastructure URLs in screenshots/demos.

---

## R8 — Pagination of GCP API responses

**Decision**: Fetch all pages in a single server request, concatenate, and return
the full list. Client pagination is not implemented (FR-022 specifies client-side
filtering only, no server pagination).

**Rationale**: The spec assumption states projects with >100 resources are handled
by client-side filter. Server-side pagination would require the client to implement
cursor management, adding complexity for marginal benefit at the expected scale
(<500 items). `@google-cloud/pubsub` handles page-token iteration internally when
`autoPaginate: true` (default).

For CRM v3 projects, iterate `nextPageToken` manually (max 500 projects per page,
typical user has <50 projects).

**Timeout guard**: If cumulative page fetching exceeds 8 s, abort and return a
`504` with a timeout error.
