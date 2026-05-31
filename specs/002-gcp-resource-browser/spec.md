# Feature Specification: GCP Resource Browser

**Feature Branch**: `002-gcp-resource-browser`

**Created**: 2026-05-31

**Status**: Clarified (ready for `/speckit.plan`)

**Input**: User description: "Project browsing de los proyectos disponibles con el usuario GCP y en cada proyecto Topic/Subscription Browsing, para luego con el topic/sub elegido poder hacer publish o subscribe. En desarrollos posteriores componer JSON messages para publish o copiar los que llegan en las subs."

## Clarifications

### Session 2026-05-31

- **Q: Does each project maintain its own independent topic/subscription selection in memory?** → A: Yes — the Resource Context is a per-project hashmap (`projectId → {topic, subscription}`). Navigating back to a previously visited project restores its last selection. Switching to a different project starts fresh for that project but does not clear the context of the one just left.
- **Q: When the user filters topics, does the subscription panel also get filtered?** → A: No — the two filter inputs are fully independent. Each panel filters only its own list. A user who wants to see subscriptions for a specific topic uses the subscription filter directly (which already matches by parent topic name, per FR-017).
- **Q: Can users refresh the resource lists without navigating away from the project?** → A: Yes — each panel (topics and subscriptions independently) has an explicit refresh button. Triggering a refresh re-fetches from the API but preserves any active filter text and does not clear the active-context selection.
- **Q: Should HTTP 429 / quota-exceeded errors from the GCP API be treated differently from generic errors?** → A: Yes — quota-exceeded errors MUST show a specific message that identifies the quota name (e.g., `pubsub.googleapis.com/ListTopics`) and a manual retry action, distinct from the generic error state.
- **Q: Should the list of topics or subscriptions be virtualized when the count is high?** → A: No — render all items without virtualization in v1. Client-side filtering reduces the visible set quickly enough that DOM performance is not a concern at typical Pub/Sub project scales (<500 resources). Revisit if a concrete performance issue is reported.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Browse and Search Available GCP Projects (Priority: P1)

An authenticated user opens the dashboard and sees a searchable list of all Google Cloud projects they have access to under their current ADC identity. They can type part of the project name or ID to instantly narrow the list and navigate into the right project without scrolling through hundreds of entries.

**Why this priority**: Without project discovery the rest of the feature cannot function. It is the entry point for every Pub/Sub operation. Fast search is critical when users manage dozens or hundreds of projects.

**Independent Test**: A user with multiple accessible projects opens the dashboard, types a partial project name, sees the list narrow instantly to matching projects, and selects one to transition to its resource view. Delivers immediate, standalone value.

**Acceptance Scenarios**:

1. **Given** the user is authenticated with ADC, **When** the dashboard loads, **Then** a list of accessible GCP projects (project ID + display name) is shown within 3 seconds.
2. **Given** the project list is loaded, **When** the user types in the project search input, **Then** the list filters in real time to show only projects whose name or ID contains the typed text (case-insensitive).
3. **Given** the project list is filtered, **When** the user selects a project from the filtered results, **Then** the dashboard transitions to the resource view for that project.
4. **Given** the user types text that matches no project, **When** the list updates, **Then** a "No matching projects" state is shown, visually distinct from the "no projects at all" empty state.
5. **Given** the user has no accessible projects, **When** the dashboard loads, **Then** an empty state is shown with guidance on how to grant access.
6. **Given** the ADC credentials lack the necessary permissions to list projects, **When** the dashboard loads, **Then** a clear permission-error message is displayed with the missing permission name.

---

### User Story 2 — Browse and Filter Topics and Subscriptions Within a Project (Priority: P2)

After selecting a project, the user sees two filterable lists: the Pub/Sub topics and the subscriptions for that project. Each panel has its own search input; typing instantly narrows the list. Each subscription shows which topic it is attached to, and filtering topics also highlights the matching subscriptions.

**Why this priority**: This is the core browsing value — identifying the exact resource to work with before performing any operation. Real-time filtering is essential in projects with hundreds of topics or subscriptions.

**Independent Test**: Given a selected project, the user types a partial topic name and sees the topic list narrow instantly to matches. Separately, they type a subscription name and see only matching subscriptions. They can identify any resource by name without scrolling.

**Acceptance Scenarios**:

1. **Given** a project is selected, **When** the resource view loads, **Then** all topics and all subscriptions for that project are displayed within 5 seconds.
2. **Given** the resource view is loaded, **When** the user types in the topic filter input, **Then** the topic list narrows in real time to items whose name contains the typed text (case-insensitive).
3. **Given** the resource view is loaded, **When** the user types in the subscription filter input, **Then** the subscription list narrows in real time to items whose name or parent topic name contains the typed text (case-insensitive).
4. **Given** either filter is active, **When** the filter text is cleared, **Then** the full list is immediately restored.
5. **Given** a filter yields no matching items, **When** the list updates, **Then** a "No matching [topics/subscriptions]" state is shown, visually distinct from the "project has none" empty state.
6. **Given** the resource view is loaded, **When** the user scans the subscription list, **Then** each subscription item shows the name of its parent topic.
7. **Given** a project has no topics, **When** the resource view loads, **Then** the topics section shows an empty state ("No topics found in this project").
8. **Given** a project has no subscriptions, **When** the resource view loads, **Then** the subscriptions section shows an empty state ("No subscriptions found in this project").
9. **Given** the resource lists are loading, **When** an API error occurs, **Then** an error state with a retry action is displayed; other sections remain unaffected.

---

### User Story 3 — Select a Topic or Subscription as Active Context (Priority: P3)

The user clicks on a topic or a subscription to mark it as the "active" resource. The selection is visually confirmed and held as the context for future publish or subscribe operations that will be added in subsequent features.

**Why this priority**: Without a selection mechanism the browsing feature has no forward path. Setting active context is the bridge to publish/subscribe.

**Independent Test**: The user selects a topic and a subscription; both are highlighted in the UI and their names are shown in a persistent "current context" indicator. No further action is required for this story to deliver value.

**Acceptance Scenarios**:

1. **Given** the resource view is loaded, **When** the user clicks a topic, **Then** the topic is highlighted and its resource path is shown in the active-context indicator.
2. **Given** the resource view is loaded, **When** the user clicks a subscription, **Then** the subscription is highlighted and its resource path is shown in the active-context indicator.
3. **Given** a topic is already selected, **When** the user clicks a different topic, **Then** the previous selection is cleared and the new topic becomes active.
4. **Given** an active context is set, **When** the user navigates back to the project list, **Then** the context is preserved and re-displayed when the user returns to the same project.
5. **Given** the user has visited Project A (topic T1 selected) and then visits Project B (sub S1 selected), **When** the user navigates back to Project A, **Then** topic T1 is still shown as the active context for Project A.

---

### User Story 4 — Find a Resource by Name Across a Project (Priority: P2)

A developer knows the name (or partial name) of the topic or subscription they want to work with but does not want to scroll through a long list. They type directly into the filter input and reach the exact resource within seconds.

**Why this priority**: In real-world projects with dozens to hundreds of Pub/Sub resources, scrolling is not viable. Instant search is the primary navigation mechanism for experienced users.

**Independent Test**: A user with 50+ topics in a project types a 3-character substring of a topic name and sees only matching topics. They select one in a single click. Total time from typing to selection under 5 seconds.

**Acceptance Scenarios**:

1. **Given** a project with many topics, **When** the user types a partial name in the topic filter, **Then** only matching topics are shown and the match is highlighted within the item text.
2. **Given** a project with many subscriptions, **When** the user types the name of the associated topic in the subscription filter, **Then** only subscriptions attached to that topic are shown.
3. **Given** the user types and then clears the filter, **When** the input becomes empty, **Then** the full list is restored without any additional interaction.

---

### Edge Cases

- What happens when the project list returns hundreds of projects? The search input filters the already-loaded list client-side with no additional API calls.
- What happens to the active context when the user refreshes a panel? The topic/subscription selection is preserved; only the list content is re-fetched.
- Are the topic filter and subscription filter linked? No — they are fully independent; each filters only its own panel.
- What if a GCP API returns a quota-exceeded error (429)? A specific error message with the quota name is shown, distinct from generic errors.
- How does the system handle a topic that has been deleted between page load and selection? An error state is shown on the detail view; the list auto-refreshes on retry.
- What if the ADC token expires while the user is browsing? The dashboard shows a session-expired error and prompts the user to re-authenticate via the CLI.
- What if a subscription's parent topic has been deleted? The subscription is still shown but the topic reference is displayed as "topic deleted".
- What if topics or subscriptions take longer than 10 seconds to load? A timeout error is shown with a retry action.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST list all GCP projects accessible to the authenticated user's ADC credentials.
- **FR-002**: System MUST display each project with at minimum its project ID and display name.
- **FR-003**: Users MUST be able to select a project to transition to its Pub/Sub resource view.
- **FR-004**: System MUST list all Pub/Sub topics within the selected project.
- **FR-005**: System MUST list all Pub/Sub subscriptions within the selected project.
- **FR-006**: System MUST display, for each subscription, the name of its parent topic.
- **FR-007**: Users MUST be able to select any topic as the active context for future operations.
- **FR-008**: Users MUST be able to select any subscription as the active context for future operations.
- **FR-009**: System MUST display a persistent active-context indicator showing the currently selected project, topic (if any), and subscription (if any).
- **FR-010**: System MUST display a clear, actionable error state when resources cannot be loaded due to insufficient permissions, including the name of the missing IAM permission.
- **FR-011**: System MUST display an empty state with descriptive text when a project contains no topics or no subscriptions.
- **FR-012**: System MUST provide a retry action on any resource-loading error.
- **FR-013**: Users MUST be able to navigate back to the project list from the resource view without losing their active-context selection.
- **FR-014**: All resource-browsing operations MUST be read-only; the system MUST NOT create, modify, or delete any GCP resource.
- **FR-015**: System MUST provide a real-time search input for the project list that filters by project ID and display name simultaneously.
- **FR-016**: System MUST provide a real-time filter input for the topics list within a project that filters by topic name.
- **FR-017**: System MUST provide a real-time filter input for the subscriptions list within a project that filters by subscription name and by parent topic name.
- **FR-018**: All filtering MUST be case-insensitive and match partial strings at any position within the resource name.
- **FR-019**: Matched text within a filtered result MUST be visually highlighted so the user can confirm what portion of the name matched their query.
- **FR-020**: When a filter input yields no results, the system MUST show a "No matching [resources]" state that is visually distinct from the "project contains no resources" empty state.
- **FR-021**: Clearing a filter input MUST immediately restore the full, unfiltered list with no additional user interaction.
- **FR-022**: All filtering operations MUST be performed entirely client-side on already-loaded data; no additional API calls are triggered by typing in a filter.
- **FR-023**: The system MUST maintain independent resource context (selected topic + selected subscription) per project visited during the session, stored as a per-project map; navigating back to a previously visited project MUST restore its last selected topic and subscription without requiring re-selection.
- **FR-024**: Each resource panel (topics and subscriptions independently) MUST provide an explicit refresh action that re-fetches its list from the API while preserving any active filter text and without clearing the active-context selection.
- **FR-025**: When a GCP API request fails with a quota-exceeded error (HTTP 429), the system MUST display a specific error message that identifies the quota name (e.g., the API method that was rate-limited), distinct from the generic error state, with a manual retry action.

### Key Entities

- **GCP Project**: A Google Cloud project accessible to the user. Key attributes: project ID, display name, lifecycle state.
- **Topic**: A Pub/Sub topic belonging to a project. Key attributes: resource name (full path), short display name, project.
- **Subscription**: A Pub/Sub subscription belonging to a project. Key attributes: resource name, short display name, parent topic resource name, delivery type (pull/push).
- **Resource Context**: The user's current navigation state. Implemented as a per-project map (`projectId → {selectedTopic, selectedSubscription}`). Each project maintains its own independent selection; navigating between projects does not clear previously stored selections. Scoped to the current browser session (not persisted across page refreshes).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: User can identify and select any accessible GCP project within 3 seconds of the project list loading.
- **SC-002**: Topics and subscriptions for a selected project load and render within 5 seconds under normal network conditions.
- **SC-003**: User can navigate from project list to a specific topic or subscription selection in 3 or fewer interactions, or locate a named resource within a loaded list in under 5 seconds by using the search/filter inputs.
- **SC-004**: Every error state includes an actionable description that allows the user to self-diagnose the problem (e.g., missing permission name, retry button).
- **SC-005**: The active context (selected project / topic / subscription) is always visible on screen when a resource view is active, with no ambiguity about which resource is selected.
- **SC-006**: The feature operates entirely within the existing auth boundary: no auth-related code outside the `auth/index.ts` barrel is introduced or modified.

## Assumptions

- The user is already authenticated via ADC when they open the dashboard (established by feature 001).
- The dashboard serves a single authenticated Google identity at a time; multi-identity switching is out of scope.
- Resource lists (topics, subscriptions) are fetched on-demand when a project is selected; no background pre-fetching.
- The active context (selected project / topic / subscription) is held in client-side memory for the duration of the browser session and is not persisted across page refreshes.
- Projects with very large numbers of topics or subscriptions display all items without server-side pagination; search/filter is client-side over the already-fetched data set.
- The required GCP IAM roles for listing projects (`resourcemanager.projects.list`) and Pub/Sub resources (`roles/pubsub.viewer`) are the responsibility of the user to configure; the dashboard surfaces missing-permission errors but does not grant roles.
- This feature does not implement publish or subscribe functionality; it only establishes the resource-selection context that future features will consume.
