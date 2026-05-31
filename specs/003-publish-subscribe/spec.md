# Feature Specification: Publish & Subscribe

**Feature Branch**: `003-publish-subscribe`

**Created**: 2026-05-31

**Status**: Clarified (ready for `/speckit-plan`)

**Input**: User description: "Vamos a desarrollar la siguiente feature mirando `docs/extension-points.md` y lo ya construido con spec kit. Sobre el active context que dejó lista la feature 002 (proyecto + topic/subscription elegidos), implementar el ciclo completo de mensajería: **publicar** un mensaje al topic activo y **recibir/pull** mensajes de la subscription activa, viendo payload y atributos. La composición avanzada de JSON y el 'copiar mensaje recibido para republicar' quedan para un desarrollo posterior (feature 004)."

## Clarifications

### Session 2026-05-31

- **Q: What is the fixed maximum number of messages retrieved per pull (FR-011)?** → A: 10 messages per pull. A small, readable batch for a debugging dashboard; the user re-triggers a pull to retrieve the next batch. Matches the typical GCP synchronous-pull default.
- **Q: How do successive pulls behave in the receive panel (US2 AS7)?** → A: Accumulate into a running list. Each pull appends newly retrieved messages to the existing list; an explicit "Clear" action empties the panel. Nothing is discarded without the user's intent; message ID makes redeliveries identifiable.
- **Q: How is a received payload that is valid JSON rendered (FR-012)?** → A: Auto pretty-print. If the decoded payload parses as JSON, it is shown formatted/indented; otherwise it is shown as plain text. This is display-only — no editing or structured composition/validation (that is feature 004).

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Publish a Message to the Active Topic (Priority: P1)

A user who has selected a topic as their active context (via feature 002) opens a publish panel, types the body of a message, optionally adds key/value attributes, and sends it. The dashboard confirms the message was accepted and shows the resulting message ID returned by the messaging service.

**Why this priority**: Publishing is half of the complete messaging cycle and the primary reason a developer reaches for this tool — to push a test or real message into a topic and confirm it was accepted. Without it, the active-topic selection from feature 002 has no actionable outcome.

**Independent Test**: With a topic set as the active context, the user types a message body, clicks send, and receives a visible confirmation containing a message ID. Fully testable on its own and delivers immediate value (a developer can inject a message into any topic they have access to).

**Acceptance Scenarios**:

1. **Given** a topic is set as the active context, **When** the user opens the publish panel, **Then** the panel shows the target topic's resource path and an editable message-body input.
2. **Given** the user has typed a non-empty message body, **When** they submit the publish action, **Then** the message is sent to the active topic and a success confirmation showing the returned message ID is displayed.
3. **Given** the user submits with an empty message body, **When** the publish action is attempted, **Then** the system blocks submission and shows an inline validation message; no request is sent to the messaging service.
4. **Given** the user is publishing, **When** the messaging service rejects the request due to insufficient permissions, **Then** a clear error is shown naming the missing publish permission, and the composed message body is preserved for retry.
5. **Given** no topic is set as the active context, **When** the user navigates to the publish panel, **Then** the panel shows a guidance state instructing the user to select a topic first, with no message-body input enabled.
6. **Given** a publish has just succeeded, **When** the confirmation is shown, **Then** the message body and attributes remain available so the user can publish the same or an edited message again without retyping.

---

### User Story 2 — Pull and Read Messages from the Active Subscription (Priority: P1)

A user who has selected a subscription as their active context requests messages from it. The dashboard pulls a batch of available messages and displays, for each one, its decoded payload, its attributes, and its delivery metadata (message ID, publish time, delivery attempt). By default the messages are only peeked — they are not removed from the subscription — so the tool is safe to point at a shared subscription.

**Why this priority**: Receiving is the other half of the complete messaging cycle. Inspecting what is actually flowing through a subscription is the single most common debugging task for a Pub/Sub developer. Pairing it with publish in the same release delivers the full end-to-end loop.

**Independent Test**: With a subscription set as the active context and at least one message available, the user clicks "pull messages" and sees a list of received messages, each showing its payload and attributes. Fully testable on its own.

**Acceptance Scenarios**:

1. **Given** a subscription is set as the active context, **When** the user triggers a pull, **Then** up to 10 currently available messages are retrieved and displayed within 5 seconds.
2. **Given** messages are retrieved, **When** the list renders, **Then** each message shows its decoded payload (JSON payloads pretty-printed, non-JSON shown as plain text), its attributes (if any), its message ID, and its publish time.
3. **Given** the subscription has no messages available, **When** the user triggers a pull, **Then** an "empty pull — no messages currently available" state is shown, visually distinct from an error state.
4. **Given** a pulled message's payload is not valid UTF-8 text, **When** the message renders, **Then** the raw payload is presented in a safe fallback representation and labelled as non-text, without breaking the rest of the list.
5. **Given** the user pulls messages, **When** the messaging service rejects the request due to insufficient permissions, **Then** a clear error is shown naming the missing subscribe/pull permission, with a retry action.
6. **Given** no subscription is set as the active context, **When** the user navigates to the receive panel, **Then** the panel shows a guidance state instructing the user to select a subscription first, with the pull action disabled.
7. **Given** a pull returns messages, **When** the user triggers another pull, **Then** the newly retrieved messages are appended to the running list of already-displayed messages, and none are discarded until the user invokes the explicit "Clear" action.
8. **Given** a running list of pulled messages is displayed, **When** the user invokes the "Clear" action, **Then** the panel is emptied, and the next pull starts a fresh list.

---

### User Story 3 — Attach Attributes to a Published Message (Priority: P2)

While composing a message to publish, the user adds one or more key/value attribute pairs alongside the message body. The attributes are sent with the message and, when the message is later received, appear in the receive panel.

**Why this priority**: Attributes are how real Pub/Sub messages carry routing and metadata. A publish tool that can only send a body is incomplete for realistic testing, but the core publish loop (US1) already delivers value without it, so this is P2.

**Independent Test**: The user adds two attribute pairs to a message, publishes it, and (using US2 against a subscription on the same topic) confirms both attributes are visible on the received message.

**Acceptance Scenarios**:

1. **Given** the publish panel is open, **When** the user adds an attribute row, **Then** an empty key input and value input appear for that attribute.
2. **Given** the user has entered one or more complete attribute pairs, **When** they publish, **Then** all attributes are sent with the message.
3. **Given** the user has entered an attribute with a key but no value (or a value but no key), **When** they attempt to publish, **Then** an inline validation message identifies the incomplete attribute and blocks submission.
4. **Given** the user has added the same attribute key twice, **When** they attempt to publish, **Then** a validation message flags the duplicate key and blocks submission.
5. **Given** attribute rows exist, **When** the user removes an attribute row, **Then** that attribute is excluded from the published message.

---

### User Story 4 — Acknowledge (Remove) Received Messages (Priority: P3)

After reviewing a pulled message, the user can explicitly acknowledge it to remove it from the subscription. Acknowledgement is always an explicit, opt-in action — pulling alone never removes messages — so the user controls whether the tool affects a shared subscription's backlog.

**Why this priority**: Most debugging is read-only peeking (US2), which is non-destructive by default. Explicit acknowledgement is a power-user action needed to drain test messages, but it is not required for the core inspect loop, so it is P3. Keeping it explicit and separate protects shared subscriptions from accidental data loss.

**Independent Test**: The user pulls a message, clicks acknowledge on it, then pulls again and confirms that the acknowledged message is no longer redelivered (while unacknowledged messages return after their deadline).

**Acceptance Scenarios**:

1. **Given** a pulled message is displayed, **When** the user invokes its acknowledge action, **Then** the message is acknowledged against the subscription and visually marked as acknowledged.
2. **Given** a message has been acknowledged, **When** the user pulls again after the redelivery window, **Then** that message is not redelivered.
3. **Given** pulled messages are displayed and none are acknowledged, **When** the user does nothing and the redelivery window elapses, **Then** the messages remain available in the subscription for the next pull (non-destructive default).
4. **Given** the user attempts to acknowledge a message whose acknowledgement window has already expired, **When** the action fails, **Then** a clear, non-fatal message explains the message must be pulled again, without breaking the rest of the panel.

---

### Edge Cases

- **No active context**: If neither a topic nor a subscription is selected, both panels show guidance to select a resource first; no messaging request can be triggered.
- **Active context changes mid-task**: If the user switches the active topic/subscription while a composed message or a pulled batch is on screen, the panel reflects the new target and clearly indicates the change rather than silently publishing to or pulling from the wrong resource.
- **Large message body**: When a message body exceeds the messaging service's per-message size limit, the system blocks publish with a clear size-limit message before sending.
- **Quota exceeded (429)**: When publish or pull fails with a quota/rate-limit error, a specific message identifies the rate-limited operation and offers manual retry, distinct from the generic error state (consistent with feature 002's FR-025 behavior).
- **Credentials expire mid-session**: A session-expired error prompts the user to re-authenticate via the CLI; the composed message body and attributes are preserved.
- **Topic deleted between selection and publish**: Publish fails with a "target topic no longer exists" error and prompts the user to re-select.
- **Binary / non-UTF-8 payloads on receive**: Rendered in a safe fallback representation and labelled, never breaking the list.
- **Very large pulled batch**: Each pull is bounded to a fixed maximum of 10 messages so a high-volume subscription cannot flood the panel in a single pull; the running list grows only as the user re-triggers pulls, and "Clear" resets it.
- **Duplicate redelivery**: The same message may legitimately be redelivered across pulls; the panel does not crash or de-duplicate destructively, and message ID makes redeliveries identifiable.

## Requirements *(mandatory)*

### Functional Requirements

**Publish**

- **FR-001**: System MUST allow the user to publish a message to the topic currently set as the active context.
- **FR-002**: System MUST provide an editable message-body input for the message being published.
- **FR-003**: System MUST reject a publish attempt with an empty message body and surface an inline validation message without sending any request.
- **FR-004**: System MUST display a success confirmation that includes the message ID returned by the messaging service after a successful publish.
- **FR-005**: System MUST allow the user to attach zero or more key/value attribute pairs to a published message.
- **FR-006**: System MUST validate attributes before publishing: every attribute MUST have both a non-empty key and a value, and attribute keys MUST be unique within a single message; violations block submission with an inline message.
- **FR-007**: System MUST preserve the composed message body and attributes after a successful publish so the user can republish or edit without retyping.
- **FR-008**: System MUST preserve the composed message body and attributes when a publish fails, enabling retry.
- **FR-009**: System MUST disable or guard the publish action when no topic is set as the active context, showing guidance to select a topic first.

**Receive (Pull)**

- **FR-010**: System MUST allow the user to pull currently available messages from the subscription set as the active context, on explicit user action.
- **FR-011**: Each pull MUST be bounded to a fixed maximum of 10 messages so a single pull cannot flood the interface; the user re-triggers a pull to retrieve the next batch.
- **FR-012**: System MUST display, for each received message, its decoded payload, its attributes (if any), its message ID, and its publish time.
- **FR-013**: System MUST present a distinct "no messages currently available" state when a pull returns zero messages, separate from any error state.
- **FR-014**: System MUST render payloads that are not valid UTF-8 text in a safe fallback representation, labelled as non-text, without breaking the rest of the list.
- **FR-015**: System MUST disable or guard the pull action when no subscription is set as the active context, showing guidance to select a subscription first.
- **FR-016**: A pull MUST NOT remove messages from the subscription by default; pulled-but-unacknowledged messages MUST return to the subscription after their redelivery window.
- **FR-026**: Successive pulls MUST append newly retrieved messages to a running list of already-displayed messages rather than replacing it; the system MUST provide an explicit "Clear" action that empties the list, after which the next pull starts fresh. The system MUST NOT discard displayed messages without the user invoking "Clear".
- **FR-027**: When a received payload's decoded text parses as valid JSON, the system MUST display it pretty-printed (formatted/indented); otherwise it MUST display the decoded text as plain text. This is display-only; the system MUST NOT offer editing or structured composition of received payloads (deferred to feature 004).

**Acknowledge**

- **FR-017**: System MUST allow the user to explicitly acknowledge an individual received message, removing it from the subscription.
- **FR-018**: System MUST NEVER acknowledge messages automatically as a side effect of pulling; acknowledgement MUST always be an explicit user action.
- **FR-019**: System MUST visually mark a message as acknowledged after a successful acknowledgement.
- **FR-020**: When an acknowledgement fails because its window has expired, the system MUST show a clear, non-fatal message instructing the user to pull again, without breaking the panel.

**Cross-cutting**

- **FR-021**: System MUST surface a clear, actionable error when a publish, pull, or acknowledge operation fails due to insufficient permissions, including the name of the missing permission.
- **FR-022**: System MUST treat quota-exceeded (rate-limit) failures distinctly from generic errors, identifying the rate-limited operation and offering manual retry, consistent with feature 002's error-handling behavior.
- **FR-023**: System MUST reflect the current active context (project, topic, subscription) in both the publish and receive panels, and MUST clearly indicate when the active context changes while content is on screen, rather than acting on a stale target.
- **FR-024**: The publish and receive capabilities MUST consume the active resource selection established by feature 002 without reintroducing or modifying authentication logic outside the existing auth barrier (`auth/index.ts`).
- **FR-025**: The feature MUST be added as a new dashboard section following the documented extension surface (new route, new schema, new UI component, registered in the app composition) without modifying the boot path or the auth resolution internals (per `docs/extension-points.md`).

### Key Entities

- **Outbound Message**: A message the user composes to publish. Key attributes: body (free-text payload), zero or more attribute key/value pairs, target topic (from active context). Result of a successful publish: a message ID.
- **Received Message**: A message pulled from a subscription. Key attributes: message ID, decoded payload, attributes (key/value pairs), publish time, delivery/redelivery indicator, acknowledgement identifier (used to acknowledge), acknowledged state.
- **Attribute**: A single key/value pair carried by a message. Keys are unique within one message; both key and value are required.
- **Pull Result**: The outcome of a pull request. Either a bounded batch of Received Messages, an empty result, or an error (permission, quota, timeout, session-expired).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: With a topic selected as the active context, a user can publish a message and see a confirmation with its message ID in 3 or fewer interactions.
- **SC-002**: A published message — body and all attached attributes — appears intact when later received from a subscription on the same topic, with no loss or alteration of body or attribute content.
- **SC-003**: With a subscription selected, a user can pull and view available messages, including payload and attributes, within 5 seconds under normal network conditions.
- **SC-004**: Pulling messages never removes them from the subscription unless the user explicitly acknowledges them; in usability testing, zero accidental message removals occur from pulling alone.
- **SC-005**: Every publish, pull, and acknowledge error state includes an actionable description (missing permission name, retry action, or re-selection guidance) that lets the user self-diagnose without leaving the dashboard.
- **SC-006**: The feature operates entirely within the existing auth boundary and extension surface: no auth code outside the `auth/index.ts` barrel and no boot-path code is introduced or modified.
- **SC-007**: A developer can complete a full round trip — publish a message to the active topic, then pull and read that same message from a subscription on that topic — without leaving the dashboard.

## Assumptions

- The user has already selected a project and a topic and/or subscription as the active context, as delivered by feature 002; this feature consumes that context and does not re-implement browsing or selection.
- The user is authenticated via ADC, as established by feature 001; the dashboard serves a single authenticated Google identity at a time.
- **Acknowledgement is explicit and opt-in by default.** A pull peeks messages without acknowledging them, so the tool is safe to point at a shared subscription. This non-destructive default is chosen deliberately over auto-acknowledge to prevent accidental data loss; users who want to drain messages acknowledge them explicitly (US4).
- Publishing sends the message body as-is (free text, which may be JSON or any payload the user types). **Structured/templated JSON composition with validation, and "copy a received message to republish", are explicitly out of scope for this feature and deferred to feature 004**, per the original feature-002 forward-looking note.
- Pull is on-demand (user-triggered), not a continuous stream or background poll; each pull retrieves up to 10 currently available messages and appends them to a running list that the user clears explicitly.
- Push-delivery subscriptions, message ordering keys, dead-letter inspection, and server-side message filtering are out of scope for v1.
- The required IAM permissions for publishing (`pubsub.topics.publish`) and for pulling/acknowledging (`pubsub.subscriptions.consume`) are the user's responsibility to configure; the dashboard surfaces missing-permission errors but does not grant roles.
- Composed messages and pulled batches are held in client-side memory for the browser session and are not persisted across page refreshes.
- This feature performs write operations (publish) and state-changing operations (acknowledge) against the messaging service, which is an intentional and explicit departure from the read-only constraint of feature 002 (FR-014). Read-only browsing remains read-only; only the new publish/acknowledge actions mutate state, and acknowledge only on explicit user action.
